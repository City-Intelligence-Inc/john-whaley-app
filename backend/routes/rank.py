"""
Universal ranker — classifies and scores applicants using whatever data is available.
No AI calls, no streaming, no API keys. Pure pattern matching + scoring.

POST /rank/{session_id}                          Rank with auto-detected algorithm
POST /rank/{session_id}?algorithm=sales          Force sales algorithm
POST /rank/{session_id}?algorithm=startup        Force startup/event algorithm
POST /rank/{session_id}?algorithm=jd             Score against job description (pass JD in body)
POST /rank/{session_id}?algorithm=judge&judge=closer  Use a judge personality

Scoring breakdown (0–100):
  Experience    0–20
  Performance   0–25
  Companies     0–20
  Skills        0–20
  Profile       0–15
"""

import json
import re
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from db import scan_all_applicants, update_applicant_fields, get_session_or_404

router = APIRouter(prefix="/rank", tags=["rank"])


# ── Request model ──

class RankRequest(BaseModel):
    job_description: Optional[str] = None
    judge: Optional[str] = None


# ══════════════════════════════════════════════════
# TITLE PATTERNS — used by both sales and startup
# ══════════════════════════════════════════════════

# Sales
SALES_LEADER_TITLES = [
    "vp sales", "vp of sales", "vice president sales", "vice president of sales",
    "cro", "chief revenue", "head of sales", "sales director", "director of sales",
    "svp sales", "evp sales", "general manager",
    "vp revenue", "head of revenue", "director of revenue",
    "vp business development", "head of business development",
    "regional vp", "area vp", "divisional vp",
    "director, gtm", "director of gtm", "head of gtm", "vp gtm",
    "director of growth", "head of growth", "vp growth",
]
AE_TITLES = [
    "account executive", "enterprise ae", "commercial ae", "mid-market ae",
    "strategic ae", "senior account executive",
    "sales representative", "sales rep", "outside sales",
    "enterprise sales", "field sales", "inside sales representative",
    "named account", "territory manager", "territory rep",
    "solutions consultant", "sales consultant",
    "founding ae", "founding account executive",
    "technical sales", "new business",
]
SDR_TITLES = [
    "sdr", "sales development", "bdr", "business development rep",
    "business development representative", "business developer",
    "business development associate", "business development intern",
    "outbound rep", "inbound rep", "lead generation",
    "prospecting", "appointment setter",
    "sales associate", "junior sales",
    "outbound acceleration",
]
GTM_TITLES = [
    "gtm", "go-to-market", "go to market",
    "growth associate", "growth manager", "growth lead",
    "growth analyst", "growth equity",
    "founding gtm", "gtm lead", "gtm strategy",
    "partnerships", "partner manager",
]
SALES_ENGINEER_TITLES = [
    "sales engineer", "solutions engineer", "pre-sales engineer",
    "solutions architect", "technical account manager",
    "presales", "pre-sales", "demo engineer",
]
ACCOUNT_MANAGER_TITLES = [
    "account manager", "customer success", "client success",
    "relationship manager", "client manager",
    "csm", "customer account", "renewals",
    "client partner", "client services",
]

# Startup / Event
FOUNDER_TITLES = [
    "founder", "co-founder", "cofounder", "ceo", "chief executive",
    "co-ceo", "managing director", "president",
]
ENGINEER_TITLES = [
    "engineer", "developer", "programmer", "swe", "sde",
    "software", "backend", "frontend", "fullstack", "full-stack",
    "devops", "sre", "infrastructure", "platform engineer",
    "machine learning engineer", "ml engineer", "ai engineer",
    "data engineer", "cto", "chief technology",
    "tech lead", "staff engineer", "principal engineer",
]
INVESTOR_TITLES = [
    "partner", "investor", "venture", "vc", "angel",
    "managing partner", "general partner", "principal",
    "associate", "analyst",
    "fund", "capital",
]
PM_TITLES = [
    "product manager", "program manager", "project manager",
    "product lead", "head of product", "vp product", "cpo",
]
RESEARCHER_TITLES = [
    "professor", "researcher", "scientist", "postdoc",
    "research fellow", "phd candidate", "phd student",
    "research engineer", "research scientist",
]
STUDENT_TITLES = [
    "student", "undergraduate", "grad student", "masters student",
    "mba candidate", "mba student", "pursuing", "studying",
    "class of 20", "expected 20", "intern",
]


# ── Seniority tiers ──

SALES_LEADER_SENIORITY = [
    (100, ["cro", "chief revenue"]),
    (95,  ["svp sales", "evp sales"]),
    (90,  ["vp sales", "vice president sales", "vp of sales", "vp revenue"]),
    (85,  ["head of sales", "head of revenue", "head of business development"]),
    (75,  ["sales director", "director of sales", "director of revenue"]),
    (65,  ["regional vp", "area vp"]),
    (55,  ["general manager"]),
]
AE_SENIORITY = [
    (90, ["enterprise ae", "strategic ae", "enterprise sales", "named account"]),
    (80, ["senior account executive", "field sales"]),
    (70, ["mid-market ae", "commercial ae"]),
    (60, ["account executive", "territory manager"]),
    (50, ["sales representative", "sales rep", "inside sales"]),
    (40, ["sales consultant"]),
    (25, ["junior"]),
]
SDR_SENIORITY = [
    (85, ["senior sdr", "lead sdr", "sdr manager", "sdr lead"]),
    (70, ["senior bdr", "lead bdr"]),
    (55, ["sdr", "sales development"]),
    (45, ["bdr", "business development"]),
    (35, ["outbound rep", "lead generation"]),
    (20, ["sales associate", "junior sales"]),
]
SE_SENIORITY = [
    (90, ["solutions architect", "senior solutions engineer"]),
    (75, ["sales engineer", "solutions engineer"]),
    (60, ["pre-sales engineer", "presales"]),
    (40, ["demo engineer"]),
]
AM_SENIORITY = [
    (85, ["senior account manager", "client partner"]),
    (70, ["account manager", "relationship manager"]),
    (60, ["customer success manager", "csm", "customer success"]),
    (45, ["renewals"]),
    (30, ["junior account manager"]),
]
GTM_SENIORITY = [
    (90, ["head of gtm", "vp gtm", "director of growth", "head of growth"]),
    (80, ["director, gtm", "gtm strategy", "growth lead"]),
    (70, ["gtm lead", "founding gtm", "growth manager"]),
    (60, ["gtm", "go-to-market", "partnerships"]),
    (50, ["growth associate", "growth analyst"]),
    (40, ["growth equity"]),
    (30, ["partner manager"]),
]
STARTUP_SENIORITY = [
    (100, ["ceo", "chief executive", "co-ceo"]),
    (95, ["co-founder", "cofounder", "founder"]),
    (90, ["cto", "chief technology", "cpo", "vp engineering"]),
    (85, ["managing partner", "general partner"]),
    (80, ["partner", "principal"]),
    (75, ["distinguished engineer", "fellow"]),
    (70, ["staff engineer", "principal engineer", "director"]),
    (65, ["senior engineer", "senior developer", "tech lead"]),
    (55, ["engineer", "developer", "product manager"]),
    (45, ["associate", "analyst"]),
    (35, ["junior", "new grad"]),
    (20, ["intern", "student"]),
]


# ── Known companies & schools ──

TOP_COMPANIES = {
    "google", "meta", "facebook", "amazon", "apple", "microsoft", "salesforce",
    "oracle", "ibm", "cisco", "dell", "hp", "intel", "nvidia",
    "hubspot", "snowflake", "datadog", "cloudflare", "twilio", "stripe",
    "mongodb", "atlassian", "zendesk", "servicenow", "workday",
    "crowdstrike", "palo alto", "zscaler", "okta", "splunk",
    "gong", "outreach", "salesloft", "clari", "6sense", "zoominfo",
    "goldman sachs", "jp morgan", "jpmorgan", "morgan stanley", "citi",
    "deutsche bank", "ubs", "barclays", "credit suisse",
    "mckinsey", "bain", "bcg", "deloitte", "accenture", "pwc", "kpmg", "ey",
    "openai", "anthropic", "deepmind", "tesla", "spacex", "palantir",
    "coinbase", "rippling", "instacart", "airbnb", "uber", "lyft", "doordash",
    "figma", "notion", "vercel", "supabase", "linear",
    # Top VC firms
    "a16z", "sequoia", "accel", "benchmark", "greylock", "lightspeed",
    "y combinator", "yc", "first round", "index ventures", "general catalyst",
}

TOP_SCHOOLS = {
    "stanford", "harvard", "mit", "wharton", "columbia", "yale", "princeton",
    "uchicago", "chicago booth", "kellogg", "berkeley", "nyu", "cornell",
    "duke", "michigan", "virginia", "dartmouth", "brown", "upenn",
    "carnegie mellon", "georgetown", "northwestern", "caltech",
    "oxford", "cambridge", "imperial college", "eth zurich",
}


# ── Helpers ──

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
    return 50


def _parse_json_field(value) -> list | dict | None:
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return None
    return None


def _extract_crustdata(applicant: dict) -> dict:
    cd = _parse_json_field(applicant.get("crustdata_enrichment_data"))
    if isinstance(cd, list) and len(cd) > 0:
        return cd[0]
    if isinstance(cd, dict):
        return cd
    return {}


def _get_combined_text(applicant: dict) -> tuple[str, str, str]:
    """Returns (combined_title_text, headline, current_employer)."""
    cd = _extract_crustdata(applicant)
    headline = str(cd.get("headline") or applicant.get("linkedin_headline") or applicant.get("headline") or applicant.get("title") or "")
    all_titles = cd.get("all_titles") or []
    if isinstance(all_titles, list):
        title_text = " ".join(str(t) for t in all_titles)
    else:
        title_text = str(all_titles)
    combined = f"{headline} {title_text}"

    current_employer = ""
    cur_emps = cd.get("current_employers") or []
    if isinstance(cur_emps, list) and cur_emps:
        current_employer = str(cur_emps[0].get("employer_name", ""))
    if not current_employer:
        current_employer = str(applicant.get("company") or "")

    return combined, headline, current_employer


# ══════════════════════════════════════════════════
# SCORING FUNCTIONS — shared across algorithms
# ══════════════════════════════════════════════════

def _score_experience_sales(applicant: dict) -> int:
    try:
        years = int(applicant.get("total_years_sales_experience", 0) or 0)
    except (ValueError, TypeError):
        years = 0
    if years >= 10: return 20
    if years >= 7:  return 16
    if years >= 5:  return 12
    if years >= 3:  return 8
    if years >= 1:  return 4
    return 0


def _score_experience_general(applicant: dict) -> int:
    """Estimate years from crustdata employers or experience text."""
    cd = _extract_crustdata(applicant)
    employers = cd.get("all_employers") or []
    # Rough estimate: more employers = more experience
    n = len(set(str(e).lower() for e in employers)) if isinstance(employers, list) else 0
    if n >= 6: return 20
    if n >= 4: return 16
    if n >= 3: return 12
    if n >= 2: return 8
    if n >= 1: return 4
    return 0


def _score_performance(applicant: dict) -> int:
    score = 0
    try:
        rank_pct = int(applicant.get("ranking_within_team_new", 0) or 0)
        if rank_pct > 0:
            if   rank_pct <= 5:  score += 10
            elif rank_pct <= 10: score += 8
            elif rank_pct <= 25: score += 6
            elif rank_pct <= 50: score += 3
            else:                score += 1
    except (ValueError, TypeError):
        pass

    grade_pts = {"S": 8, "A": 7, "B": 5, "C": 3, "D": 1, "F": 0}
    sdr_g = grade_pts.get(str(applicant.get("sdr_grade", "")).strip().upper(), -1)
    ae_g  = grade_pts.get(str(applicant.get("ae_grade", "")).strip().upper(), -1)
    score += max(sdr_g, ae_g, 0)

    comps = _parse_json_field(applicant.get("competencies"))
    if isinstance(comps, list) and comps:
        nums = []
        for c in comps:
            try:
                nums.append(float(c["score"]))
            except (KeyError, ValueError, TypeError):
                pass
        if nums:
            avg = sum(nums) / len(nums)
            score += min(7, round(avg * 1.4))

    return min(25, score)


def _score_companies(applicant: dict) -> int:
    score = 0
    cd = _extract_crustdata(applicant)
    employers = cd.get("all_employers") or []
    if isinstance(employers, str):
        employers = [employers]

    top_hits = 0
    for emp in employers:
        emp_l = _normalize(str(emp))
        if any(t in emp_l for t in TOP_COMPANIES):
            top_hits += 1
    if   top_hits >= 3: score += 12
    elif top_hits >= 2: score += 10
    elif top_hits >= 1: score += 7

    unique_emp = len(set(_normalize(str(e)) for e in employers))
    if   unique_emp >= 5: score += 4
    elif unique_emp >= 3: score += 3
    elif unique_emp >= 2: score += 2
    elif unique_emp >= 1: score += 1

    schools = cd.get("all_schools") or []
    for school in schools:
        if any(t in _normalize(str(school)) for t in TOP_SCHOOLS):
            score += 4
            break

    return min(20, score)


def _score_skills_sales(applicant: dict) -> int:
    score = 0
    industries = _parse_json_field(applicant.get("industries"))
    if isinstance(industries, list) and industries:
        score += min(5, len(industries) + 1)
    kpis = _parse_json_field(applicant.get("sales_kpis"))
    if isinstance(kpis, list):
        score += min(4, len(kpis))
    tools = _parse_json_field(applicant.get("sales_tool_experience"))
    if isinstance(tools, list):
        score += min(4, len(tools))
    try:
        deal = int(applicant.get("deal_size", 0) or 0)
        if   deal >= 500_000: score += 4
        elif deal >= 100_000: score += 3
        elif deal >= 25_000:  score += 2
        elif deal >= 5_000:   score += 1
    except (ValueError, TypeError):
        pass
    cd = _extract_crustdata(applicant)
    skills = cd.get("skills") or []
    if isinstance(skills, list):
        if   len(skills) >= 10: score += 3
        elif len(skills) >= 5:  score += 2
        elif len(skills) >= 1:  score += 1
    return min(20, score)


def _score_skills_general(applicant: dict) -> int:
    """Score skills breadth from LinkedIn skills, bio, interests."""
    score = 0
    cd = _extract_crustdata(applicant)
    skills = cd.get("skills") or []
    if isinstance(skills, list):
        if   len(skills) >= 15: score += 8
        elif len(skills) >= 10: score += 6
        elif len(skills) >= 5:  score += 4
        elif len(skills) >= 1:  score += 2

    # Bio/interest/about richness
    about = str(applicant.get("about") or applicant.get("bio") or "")
    if len(about) > 200: score += 5
    elif len(about) > 50: score += 3
    elif len(about) > 0: score += 1

    interests = str(applicant.get("interest") or "")
    if interests: score += 3

    hobbies = str(applicant.get("hobbies") or "")
    if hobbies: score += 2

    github = str(applicant.get("github_url") or "")
    if github: score += 2

    return min(20, score)


def _score_completeness_sales(applicant: dict) -> int:
    fields = [
        "total_years_sales_experience", "industries", "sales_kpis",
        "sales_tool_experience", "company_experience_new", "buyer_personas",
        "departments_sold_to", "products_sold", "sales_cycle_description",
        "highlights", "competencies", "ranking_within_team_new",
        "resume_text", "current_location", "preferred_working_style_new",
    ]
    filled = sum(
        1 for f in fields
        if applicant.get(f) and str(applicant[f]).strip() not in ("", "[]", "null", "0")
    )
    return min(15, filled)


def _score_completeness_general(applicant: dict) -> int:
    fields = [
        "name", "headline", "about", "experience", "education",
        "skills", "company", "location", "connections", "photo_url",
        "bio", "interest", "github_url", "email", "resume_text",
    ]
    filled = sum(
        1 for f in fields
        if applicant.get(f) and str(applicant[f]).strip() not in ("", "[]", "null", "0")
    )
    return min(15, filled)


# ══════════════════════════════════════════════════
# JD MATCHING — keyword overlap scoring
# ══════════════════════════════════════════════════

def _score_jd_match(applicant: dict, jd: str) -> int:
    """Score 0-100 based on keyword overlap with job description."""
    jd_lower = _normalize(jd)
    jd_words = set(re.findall(r'\b[a-z]{3,}\b', jd_lower))

    # Build candidate text from all available fields
    cd = _extract_crustdata(applicant)
    parts = [
        str(applicant.get("headline") or cd.get("headline") or ""),
        str(applicant.get("experience") or ""),
        str(applicant.get("about") or applicant.get("bio") or ""),
        str(applicant.get("skills") or ""),
        str(applicant.get("education") or ""),
        str(applicant.get("competencies") or ""),
        str(applicant.get("sales_cycle_description") or ""),
        " ".join(cd.get("all_titles") or []),
        " ".join(cd.get("all_employers") or []),
    ]
    candidate_text = _normalize(" ".join(parts))
    candidate_words = set(re.findall(r'\b[a-z]{3,}\b', candidate_text))

    # Remove common stop words
    stop = {"the", "and", "for", "are", "but", "not", "you", "all", "can",
            "her", "was", "one", "our", "out", "has", "have", "with", "this",
            "that", "from", "they", "been", "said", "each", "which", "their"}
    jd_words -= stop
    candidate_words -= stop

    if not jd_words:
        return 50

    overlap = jd_words & candidate_words
    score = int(len(overlap) / len(jd_words) * 100)
    return min(100, score)


# ══════════════════════════════════════════════════
# JUDGE PERSONALITIES
# ══════════════════════════════════════════════════

JUDGE_CONFIGS = {
    "closer": {
        "name": "The Closer",
        "description": "Values deal closing, quota attainment, enterprise selling",
        "weights": {"experience": 1.5, "performance": 2.0, "companies": 1.0, "skills": 1.5, "completeness": 0.5},
        "bonus_titles": ["account executive", "enterprise", "closing", "strategic"],
        "bonus_points": 10,
    },
    "hunter": {
        "name": "The Hunter",
        "description": "Values prospecting, pipeline generation, outbound hustle",
        "weights": {"experience": 1.0, "performance": 1.5, "companies": 0.5, "skills": 2.0, "completeness": 1.0},
        "bonus_titles": ["sdr", "bdr", "outbound", "prospecting", "lead generation"],
        "bonus_points": 10,
    },
    "pedigree": {
        "name": "The Pedigree Scout",
        "description": "Values top companies, top schools, brand names",
        "weights": {"experience": 0.5, "performance": 0.5, "companies": 3.0, "skills": 1.0, "completeness": 0.5},
        "bonus_titles": [],
        "bonus_points": 0,
    },
    "scrappy": {
        "name": "The Scrappy Builder",
        "description": "Values startup experience, founding roles, hustle over pedigree",
        "weights": {"experience": 1.0, "performance": 1.5, "companies": 0.5, "skills": 1.5, "completeness": 1.5},
        "bonus_titles": ["founder", "founding", "startup", "growth", "0-1"],
        "bonus_points": 15,
    },
    "technical": {
        "name": "The Technical Evaluator",
        "description": "Values engineering depth, technical skills, research",
        "weights": {"experience": 1.0, "performance": 0.5, "companies": 1.5, "skills": 2.0, "completeness": 1.0},
        "bonus_titles": ["engineer", "cto", "architect", "ml", "ai", "research", "phd"],
        "bonus_points": 10,
    },
    "investor": {
        "name": "The Investor Eye",
        "description": "Values fund affiliation, deal flow, investment track record",
        "weights": {"experience": 1.0, "performance": 0.5, "companies": 2.0, "skills": 1.0, "completeness": 0.5},
        "bonus_titles": ["partner", "investor", "venture", "vc", "angel", "fund"],
        "bonus_points": 15,
    },
}


# ══════════════════════════════════════════════════
# CLASSIFY + SCORE — per algorithm
# ══════════════════════════════════════════════════

def _classify_sales(combined: str, headline: str, current_employer: str) -> tuple[str, int, str]:
    if _match_any(combined, SALES_LEADER_TITLES):
        return "sales_leader", _get_seniority(combined, SALES_LEADER_SENIORITY), "Sales Leader"
    elif _match_any(combined, SALES_ENGINEER_TITLES):
        return "sales_engineer", _get_seniority(combined, SE_SENIORITY), "Sales Engineer"
    elif _match_any(combined, AE_TITLES):
        return "ae", _get_seniority(combined, AE_SENIORITY), "Account Executive"
    elif _match_any(combined, ACCOUNT_MANAGER_TITLES):
        return "account_manager", _get_seniority(combined, AM_SENIORITY), "Account Manager"
    elif _match_any(combined, SDR_TITLES):
        return "sdr", _get_seniority(combined, SDR_SENIORITY), "SDR"
    elif _match_any(combined, GTM_TITLES):
        return "ae", _get_seniority(combined, GTM_SENIORITY), "GTM / Growth"
    else:
        return "other", 30, headline[:60] or "Other"


def _classify_startup(combined: str, headline: str, current_employer: str) -> tuple[str, int, str]:
    if _match_any(combined, INVESTOR_TITLES) and any(w in _normalize(combined) for w in ["fund", "capital", "venture", "vc", "partner"]):
        return "vc", _get_seniority(combined, STARTUP_SENIORITY), "Investor"
    elif _match_any(combined, FOUNDER_TITLES):
        return "founder", _get_seniority(combined, STARTUP_SENIORITY), "Founder"
    elif _match_any(combined, ENGINEER_TITLES):
        return "engineer", _get_seniority(combined, STARTUP_SENIORITY), "Engineer"
    elif _match_any(combined, PM_TITLES):
        return "pm", _get_seniority(combined, STARTUP_SENIORITY), "PM"
    elif _match_any(combined, RESEARCHER_TITLES):
        return "researcher", _get_seniority(combined, STARTUP_SENIORITY), "Researcher"
    elif _match_any(combined, STUDENT_TITLES):
        return "student", _get_seniority(combined, STARTUP_SENIORITY), "Student"
    elif _match_any(combined, SALES_LEADER_TITLES + AE_TITLES + SDR_TITLES):
        return "sales", _get_seniority(combined, STARTUP_SENIORITY), "Sales"
    else:
        return "other", 30, headline[:60] or "Other"


def _detect_algorithm(applicants: list[dict]) -> str:
    """Auto-detect: if most applicants have sales fields, use sales. Otherwise startup."""
    sales_fields = 0
    for a in applicants[:20]:  # sample first 20
        if a.get("total_years_sales_experience") or a.get("sdr_grade") or a.get("sales_kpis"):
            sales_fields += 1
    return "sales" if sales_fields > len(applicants[:20]) * 0.3 else "startup"


def classify_and_score(applicant: dict, algorithm: str = "auto", job_description: str = None, judge: str = None) -> dict:
    """Universal classifier + scorer."""
    combined, headline, current_employer = _get_combined_text(applicant)

    # Classify
    if algorithm == "sales":
        role, seniority, label = _classify_sales(combined, headline, current_employer)
    elif algorithm in ("startup", "event"):
        role, seniority, label = _classify_startup(combined, headline, current_employer)
    else:
        # Auto — try sales first, fall back to startup
        role, seniority, label = _classify_sales(combined, headline, current_employer)
        if role == "other":
            role, seniority, label = _classify_startup(combined, headline, current_employer)

    detail = headline[:60] if headline else label
    if current_employer:
        detail = f"{detail} @ {current_employer}"

    # Score
    if algorithm == "sales":
        exp   = _score_experience_sales(applicant)
        skill = _score_skills_sales(applicant)
        prof  = _score_completeness_sales(applicant)
    else:
        exp   = _score_experience_general(applicant)
        skill = _score_skills_general(applicant)
        prof  = _score_completeness_general(applicant)

    perf = _score_performance(applicant)
    comp = _score_companies(applicant)

    # JD matching — override total score
    if algorithm == "jd" and job_description:
        jd_score = _score_jd_match(applicant, job_description)
        total = int(jd_score * 0.5 + (exp + perf + comp) * 0.5 / 65 * 100)
        total = min(100, total)
        reason = f"JD Match: {jd_score}% | Exp: {exp}/20 | Perf: {perf}/25 | Companies: {comp}/20"
        return {
            "attendee_type": role,
            "attendee_type_detail": detail[:80],
            "rank_score": total,
            "rank_reason": reason,
        }

    # Judge personality — apply weights
    if algorithm == "judge" and judge and judge in JUDGE_CONFIGS:
        cfg = JUDGE_CONFIGS[judge]
        w = cfg["weights"]
        weighted = (
            exp * w["experience"] +
            perf * w["performance"] +
            comp * w["companies"] +
            skill * w["skills"] +
            prof * w["completeness"]
        )
        # Normalize to 0-100
        max_possible = 20 * w["experience"] + 25 * w["performance"] + 20 * w["companies"] + 20 * w["skills"] + 15 * w["completeness"]
        total = int(weighted / max_possible * 100) if max_possible > 0 else 0

        # Bonus for matching titles
        if cfg["bonus_titles"] and _match_any(combined, cfg["bonus_titles"]):
            total = min(100, total + cfg["bonus_points"])

        reason = f"Judge: {cfg['name']} | Exp: {exp} | Perf: {perf} | Co: {comp} | Skills: {skill} | Prof: {prof}"
        return {
            "attendee_type": role,
            "attendee_type_detail": detail[:80],
            "rank_score": total,
            "rank_reason": reason,
        }

    # Standard scoring
    total = exp + perf + comp + skill + prof
    reason = (
        f"Role: {label} (seniority {seniority}/100) | "
        f"Exp: {exp}/20 | Perf: {perf}/25 | "
        f"Companies: {comp}/20 | Skills: {skill}/20 | Profile: {prof}/15"
    )
    return {
        "attendee_type": role,
        "attendee_type_detail": detail[:80],
        "rank_score": total,
        "rank_reason": reason,
    }


# ══════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════

@router.get("/algorithms")
def list_algorithms():
    """List available ranking algorithms and judges."""
    return {
        "algorithms": [
            {"id": "auto", "name": "Auto-Detect", "description": "Automatically picks sales or startup based on data"},
            {"id": "sales", "name": "Sales", "description": "SDR/AE/Sales Leader classification, sales-specific scoring"},
            {"id": "startup", "name": "Startup / Event", "description": "Founder/Engineer/Investor/PM classification"},
            {"id": "jd", "name": "Job Description Match", "description": "Score against a pasted job description"},
            {"id": "judge", "name": "Judge Personality", "description": "Score with weighted personality (closer, hunter, etc.)"},
        ],
        "judges": [
            {"id": k, "name": v["name"], "description": v["description"]}
            for k, v in JUDGE_CONFIGS.items()
        ],
    }


@router.post("/{session_id}")
def rank_session(
    session_id: str,
    algorithm: str = Query("auto"),
    body: Optional[RankRequest] = None,
):
    """Classify and rank all applicants in a session."""
    session = get_session_or_404(session_id)
    applicants = scan_all_applicants(session_id)

    if not applicants:
        raise HTTPException(400, "No applicants in this session")

    # Auto-detect algorithm
    algo = algorithm
    if algo == "auto":
        algo = _detect_algorithm(applicants)

    jd = body.job_description if body else None
    judge = body.judge if body else None

    if algo == "jd" and not jd:
        raise HTTPException(400, "Pass job_description in body for JD matching")
    if algo == "judge" and (not judge or judge not in JUDGE_CONFIGS):
        raise HTTPException(400, f"Pass judge in body. Available: {list(JUDGE_CONFIGS.keys())}")

    results = {"total": len(applicants), "classified": 0, "by_type": {}, "algorithm": algo}
    if algo == "judge" and judge:
        results["judge"] = JUDGE_CONFIGS[judge]["name"]

    for a in applicants:
        classification = classify_and_score(a, algorithm=algo, job_description=jd, judge=judge)
        if not a.get("user_override_attendee_type"):
            update_applicant_fields(a["applicant_id"], classification)
            results["classified"] += 1
            t = classification["attendee_type"]
            results["by_type"][t] = results["by_type"].get(t, 0) + 1

    # Assign ranks within each category
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
