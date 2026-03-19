"""
Deterministic ranker — classifies and scores applicants using LinkedIn data.
No AI calls, no streaming, no API keys. Pure pattern matching.

POST /rank/{session_id}  — Rank all applicants in a session
"""

import re
from fastapi import APIRouter, HTTPException
from db import scan_all_applicants, update_applicant_fields, get_session_or_404
from config import VC_ROLE_TAXONOMY, VC_FUND_INDICATORS

router = APIRouter(prefix="/rank", tags=["rank"])

# ── Title patterns for classification ──

FOUNDER_TITLES = [
    "founder", "co-founder", "cofounder", "ceo", "chief executive",
    "co-ceo", "managing director", "president",
]

ENGINEER_TITLES = [
    "engineer", "developer", "programmer", "swe", "sde",
    "software", "backend", "frontend", "fullstack", "full-stack",
    "devops", "sre", "infrastructure", "platform engineer",
    "machine learning engineer", "ml engineer", "ai engineer",
    "data engineer", "ios developer", "android developer",
    "cto", "chief technology", "vp engineering", "head of engineering",
    "tech lead", "staff engineer", "principal engineer", "distinguished engineer",
]

PM_TITLES = [
    "product manager", "program manager", "project manager",
    "product lead", "head of product", "vp product", "cpo",
    "chief product", "product director", "director of product",
    "product owner", "technical program manager", "tpm",
]

RESEARCHER_TITLES = [
    "professor", "researcher", "scientist", "postdoc", "post-doc",
    "research fellow", "phd candidate", "phd student",
    "research engineer", "research scientist", "principal scientist",
    "faculty", "lecturer", "assistant professor", "associate professor",
    "research associate", "lab director", "pi ",
]

STUDENT_TITLES = [
    "student", "undergraduate", "grad student", "masters student",
    "mba candidate", "mba student", "pursuing", "studying",
    "class of 20", "expected 20", "intern",
]

# ── Seniority scoring within each category ──

FOUNDER_SENIORITY = [
    (100, ["ceo", "chief executive", "co-ceo"]),
    (95, ["co-founder", "cofounder", "founder"]),
    (85, ["cto", "chief technology", "cpo", "chief product"]),
    (80, ["managing director", "president"]),
    (70, ["vp", "vice president", "head of"]),
    (60, ["director"]),
]

ENGINEER_SENIORITY = [
    (100, ["cto", "chief technology"]),
    (95, ["distinguished engineer", "fellow"]),
    (90, ["vp engineering", "head of engineering"]),
    (85, ["principal engineer", "staff engineer"]),
    (75, ["senior staff", "tech lead", "engineering manager"]),
    (65, ["senior engineer", "senior developer", "senior swe", "sr."]),
    (50, ["engineer", "developer", "swe", "sde"]),
    (35, ["junior", "associate engineer", "new grad"]),
    (20, ["intern"]),
]

PM_SENIORITY = [
    (100, ["cpo", "chief product"]),
    (90, ["vp product", "head of product"]),
    (80, ["director of product", "product director", "senior director"]),
    (70, ["senior product manager", "senior pm", "group pm", "lead pm"]),
    (55, ["product manager", "program manager", "project manager", "tpm"]),
    (40, ["associate product manager", "apm", "associate pm"]),
    (20, ["intern"]),
]

RESEARCHER_SENIORITY = [
    (100, ["full professor", "professor emeritus"]),
    (90, ["associate professor", "professor"]),
    (80, ["assistant professor"]),
    (75, ["principal scientist", "lab director", "pi "]),
    (65, ["research scientist", "senior researcher"]),
    (55, ["postdoc", "post-doc", "research fellow"]),
    (45, ["research associate", "researcher"]),
    (35, ["phd candidate", "phd student"]),
    (20, ["research intern"]),
]

STUDENT_SENIORITY = [
    (80, ["phd", "doctoral"]),
    (65, ["mba"]),
    (55, ["masters", "ms ", "m.s.", "graduate student"]),
    (40, ["undergraduate", "bachelors", "bs ", "b.s."]),
    (30, ["student"]),
    (15, ["high school"]),
]


def _normalize(text: str) -> str:
    return text.lower().strip()


def _match_any(text: str, patterns: list[str]) -> bool:
    t = _normalize(text)
    return any(p in t for p in patterns)


def _get_seniority(text: str, tiers: list[tuple[int, list[str]]]) -> int:
    t = _normalize(text)
    for score, patterns in tiers:
        if any(p in t for p in patterns):
            return score
    return 50  # default mid-tier


def _is_vc(title: str, company: str, experience: str) -> tuple[bool, int, str]:
    """Check if someone is a VC. Returns (is_vc, score, role_name)."""
    combined = _normalize(f"{title} {company} {experience}")

    # Check if they work at a fund-like company
    has_fund = any(ind in _normalize(company) for ind in VC_FUND_INDICATORS) if company else False

    # Match against VC taxonomy
    best_score = 0
    best_role = ""
    for role_id, info in VC_ROLE_TAXONOMY.items():
        for t in info["titles"]:
            if t in _normalize(title) or t in combined[:200]:
                if info["seniority_score"] > best_score:
                    best_score = info["seniority_score"]
                    best_role = t.title()
                break

    if best_score > 0:
        # Bonus for being at a real fund
        if has_fund:
            best_score = min(100, best_score + 5)
        return True, best_score, best_role

    # Check for "investor" in title even without taxonomy match
    if "investor" in _normalize(title) or "venture" in _normalize(title):
        return True, 45, "Investor"

    return False, 0, ""


def classify_and_score(applicant: dict) -> dict:
    """Classify and score one applicant using their LinkedIn data."""
    title = str(applicant.get("title") or applicant.get("linkedin_headline") or "")
    company = str(applicant.get("company") or applicant.get("linkedin_company") or "")
    experience = str(applicant.get("experience") or applicant.get("linkedin_experience") or "")
    education = str(applicant.get("education") or applicant.get("linkedin_education") or "")
    headline = str(applicant.get("linkedin_headline") or title)
    combined = f"{title} {headline} {company} {experience}"

    # 1. Check VC first (highest priority detection)
    is_vc, vc_score, vc_role = _is_vc(title, company, experience)
    if is_vc and vc_score >= 30:
        detail = vc_role
        if company:
            detail = f"{vc_role} @ {company}"
        return {
            "attendee_type": "vc",
            "attendee_type_detail": detail,
            "rank_score": vc_score,
            "rank_reason": f"VC: {vc_role} (score {vc_score}/100). {company}",
        }

    # 2. Founder
    if _match_any(combined, FOUNDER_TITLES):
        score = _get_seniority(combined, FOUNDER_SENIORITY)
        detail = title[:60] if title else "Founder"
        return {
            "attendee_type": "founder",
            "attendee_type_detail": detail,
            "rank_score": score,
            "rank_reason": f"Founder: {title or 'founder role detected'} (score {score}/100). {company}",
        }

    # 3. PM
    if _match_any(combined, PM_TITLES):
        score = _get_seniority(combined, PM_SENIORITY)
        detail = title[:60] if title else "PM"
        return {
            "attendee_type": "pm",
            "attendee_type_detail": detail,
            "rank_score": score,
            "rank_reason": f"PM: {title} (score {score}/100). {company}",
        }

    # 4. Engineer
    if _match_any(combined, ENGINEER_TITLES):
        score = _get_seniority(combined, ENGINEER_SENIORITY)
        detail = title[:60] if title else "Engineer"
        return {
            "attendee_type": "engineer",
            "attendee_type_detail": detail,
            "rank_score": score,
            "rank_reason": f"Engineer: {title} (score {score}/100). {company}",
        }

    # 5. Researcher
    if _match_any(combined, RESEARCHER_TITLES):
        score = _get_seniority(combined, RESEARCHER_SENIORITY)
        detail = title[:60] if title else "Researcher"
        return {
            "attendee_type": "researcher",
            "attendee_type_detail": detail,
            "rank_score": score,
            "rank_reason": f"Researcher: {title} (score {score}/100).",
        }

    # 6. Student
    if _match_any(f"{combined} {education}", STUDENT_TITLES):
        score = _get_seniority(f"{combined} {education}", STUDENT_SENIORITY)
        detail = title[:60] if title else "Student"
        return {
            "attendee_type": "student",
            "attendee_type_detail": detail,
            "rank_score": score,
            "rank_reason": f"Student: {title or education[:60]} (score {score}/100).",
        }

    # 7. Other — still give a score based on whether they have data
    data_completeness = sum([
        bool(title), bool(company), bool(experience),
        bool(education), bool(applicant.get("about") or applicant.get("linkedin_about")),
    ])
    score = data_completeness * 10  # 0-50 based on data quality
    return {
        "attendee_type": "other",
        "attendee_type_detail": title[:60] if title else "Unknown",
        "rank_score": score,
        "rank_reason": f"Could not classify. Title: {title or 'none'}. Company: {company or 'none'}.",
    }


@router.post("/{session_id}")
def rank_session(session_id: str):
    """Classify and rank all applicants in a session using LinkedIn data."""
    session = get_session_or_404(session_id)
    applicants = scan_all_applicants(session_id)

    if not applicants:
        raise HTTPException(400, "No applicants in this session")

    results = {"total": len(applicants), "classified": 0, "by_type": {}}

    for a in applicants:
        classification = classify_and_score(a)
        # Only update if not user-overridden
        if not a.get("user_override_attendee_type"):
            update_applicant_fields(a["applicant_id"], classification)
            results["classified"] += 1
            t = classification["attendee_type"]
            results["by_type"][t] = results["by_type"].get(t, 0) + 1

    # Now assign ranks within each category
    # Re-fetch to get updated scores
    applicants = scan_all_applicants(session_id)
    by_type: dict[str, list] = {}
    for a in applicants:
        t = a.get("attendee_type", "other")
        by_type.setdefault(t, []).append(a)

    for t, group in by_type.items():
        group.sort(key=lambda x: int(x.get("rank_score", 0) or 0), reverse=True)
        for i, a in enumerate(group):
            update_applicant_fields(a["applicant_id"], {
                "rank": i + 1,
                "rank_total": len(group),
            })

    return results
