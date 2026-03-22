"""
Deterministic ranker for sales candidates.
No AI calls, no streaming, no API keys. Pure pattern matching + scoring.

POST /rank/{session_id}  — Rank all applicants in a session

Scoring breakdown (0–100):
  Experience    0–20   years of sales experience
  Performance   0–25   team ranking, grades, competency scores
  Companies     0–20   employer quality, education, breadth
  Skills        0–20   industries, KPIs, tools, deal size
  Profile       0–15   data completeness
"""

import json
import re
from fastapi import APIRouter, HTTPException
from db import scan_all_applicants, update_applicant_fields, get_session_or_404

router = APIRouter(prefix="/rank", tags=["rank"])

# ── Sales role title patterns ──

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

# GTM / Growth roles — catch-all for go-to-market and growth titles
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

# ── Seniority tiers within each role ──

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

# ── Known strong employers & schools ──

TOP_COMPANIES = {
    # Tech giants
    "google", "meta", "facebook", "amazon", "apple", "microsoft", "salesforce",
    "oracle", "ibm", "cisco", "dell", "hp", "intel", "nvidia",
    # Top SaaS / sales orgs
    "hubspot", "snowflake", "datadog", "cloudflare", "twilio", "stripe",
    "mongodb", "atlassian", "zendesk", "servicenow", "workday",
    "crowdstrike", "palo alto", "zscaler", "okta", "splunk",
    "gong", "outreach", "salesloft", "clari", "6sense", "zoominfo",
    # Finance (strong sales culture)
    "goldman sachs", "jp morgan", "jpmorgan", "morgan stanley", "citi",
    "deutsche bank", "ubs", "barclays", "credit suisse",
    # Consulting
    "mckinsey", "bain", "bcg", "deloitte", "accenture", "pwc", "kpmg", "ey",
}

TOP_SCHOOLS = {
    "stanford", "harvard", "mit", "wharton", "columbia", "yale", "princeton",
    "uchicago", "chicago booth", "kellogg", "berkeley", "nyu", "cornell",
    "duke", "michigan", "virginia", "dartmouth", "brown", "upenn",
    "carnegie mellon", "georgetown", "northwestern",
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
    """Parse a JSON string, or return as-is if already parsed."""
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return None
    return None


def _extract_crustdata(applicant: dict) -> dict:
    """Pull the first object out of crustdata_enrichment_data."""
    cd = _parse_json_field(applicant.get("crustdata_enrichment_data"))
    if isinstance(cd, list) and len(cd) > 0:
        return cd[0]
    if isinstance(cd, dict):
        return cd
    return {}


# ── Scoring functions (each returns 0–max) ──

def _score_experience(applicant: dict) -> int:
    """Years of sales experience → 0-20 pts."""
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


def _score_performance(applicant: dict) -> int:
    """Team ranking + grades + competency scores → 0-25 pts."""
    score = 0

    # Team ranking (0-10): lower percentile = better
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

    # Best of SDR / AE grade (0-8)
    grade_pts = {"S": 8, "A": 7, "B": 5, "C": 3, "D": 1, "F": 0}
    sdr_g = grade_pts.get(str(applicant.get("sdr_grade", "")).strip().upper(), -1)
    ae_g  = grade_pts.get(str(applicant.get("ae_grade", "")).strip().upper(), -1)
    score += max(sdr_g, ae_g, 0)

    # Competency average (0-7)
    comps = _parse_json_field(applicant.get("competencies"))
    if isinstance(comps, list) and comps:
        nums = []
        for c in comps:
            try:
                nums.append(float(c["score"]))
            except (KeyError, ValueError, TypeError):
                pass
        if nums:
            avg = sum(nums) / len(nums)          # 1–5 scale
            score += min(7, round(avg * 1.4))     # maps 5 → 7

    return min(25, score)


def _score_companies(applicant: dict) -> int:
    """Employer quality + education → 0-20 pts."""
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

    # Breadth: number of distinct employers (0-4)
    unique_emp = len(set(_normalize(str(e)) for e in employers))
    if   unique_emp >= 5: score += 4
    elif unique_emp >= 3: score += 3
    elif unique_emp >= 2: score += 2
    elif unique_emp >= 1: score += 1

    # Education bonus (0-4)
    schools = cd.get("all_schools") or []
    for school in schools:
        if any(t in _normalize(str(school)) for t in TOP_SCHOOLS):
            score += 4
            break

    return min(20, score)


def _score_skills(applicant: dict) -> int:
    """Industries, KPIs, tools, deal size, LinkedIn skills → 0-20 pts."""
    score = 0

    # Industries (0-5)
    industries = _parse_json_field(applicant.get("industries"))
    if isinstance(industries, list) and industries:
        score += min(5, len(industries) + 1)

    # KPIs (0-4)
    kpis = _parse_json_field(applicant.get("sales_kpis"))
    if isinstance(kpis, list):
        score += min(4, len(kpis))

    # Tools (0-4)
    tools = _parse_json_field(applicant.get("sales_tool_experience"))
    if isinstance(tools, list):
        score += min(4, len(tools))

    # Deal size (0-4)
    try:
        deal = int(applicant.get("deal_size", 0) or 0)
        if   deal >= 500_000: score += 4
        elif deal >= 100_000: score += 3
        elif deal >= 25_000:  score += 2
        elif deal >= 5_000:   score += 1
    except (ValueError, TypeError):
        pass

    # LinkedIn skills breadth (0-3)
    cd = _extract_crustdata(applicant)
    skills = cd.get("skills") or []
    if isinstance(skills, list):
        if   len(skills) >= 10: score += 3
        elif len(skills) >= 5:  score += 2
        elif len(skills) >= 1:  score += 1

    return min(20, score)


def _score_completeness(applicant: dict) -> int:
    """How much profile data is filled → 0-15 pts (1 pt per filled field)."""
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


# ── Main classify + score ──

def classify_and_score(applicant: dict) -> dict:
    """Classify a sales candidate by role and compute a 0–100 score."""
    cd = _extract_crustdata(applicant)

    headline = str(cd.get("headline") or applicant.get("linkedin_headline") or "")
    all_titles = cd.get("all_titles") or []
    if isinstance(all_titles, list):
        title_text = " ".join(str(t) for t in all_titles)
    else:
        title_text = str(all_titles)
    combined = f"{headline} {title_text}"

    # Current employer for detail string
    current_employer = ""
    cur_emps = cd.get("current_employers") or []
    if isinstance(cur_emps, list) and cur_emps:
        current_employer = str(cur_emps[0].get("employer_name", ""))

    # Classify by role (order matters — check more specific roles first)
    if _match_any(combined, SALES_LEADER_TITLES):
        role, seniority, label = "sales_leader", _get_seniority(combined, SALES_LEADER_SENIORITY), "Sales Leader"
    elif _match_any(combined, SALES_ENGINEER_TITLES):
        role, seniority, label = "sales_engineer", _get_seniority(combined, SE_SENIORITY), "Sales Engineer"
    elif _match_any(combined, AE_TITLES):
        role, seniority, label = "ae", _get_seniority(combined, AE_SENIORITY), "Account Executive"
    elif _match_any(combined, ACCOUNT_MANAGER_TITLES):
        role, seniority, label = "account_manager", _get_seniority(combined, AM_SENIORITY), "Account Manager"
    elif _match_any(combined, SDR_TITLES):
        role, seniority, label = "sdr", _get_seniority(combined, SDR_SENIORITY), "SDR"
    elif _match_any(combined, GTM_TITLES):
        role, seniority, label = "ae", _get_seniority(combined, GTM_SENIORITY), "GTM / Growth"
    else:
        role, seniority, label = "other", 30, headline[:60] or "Other"

    detail = headline[:60] if headline else label
    if current_employer:
        detail = f"{detail} @ {current_employer}"

    # Score
    exp   = _score_experience(applicant)
    perf  = _score_performance(applicant)
    comp  = _score_companies(applicant)
    skill = _score_skills(applicant)
    prof  = _score_completeness(applicant)
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


# ── Route ──

@router.post("/{session_id}")
def rank_session(session_id: str):
    """Classify and rank all applicants in a session."""
    session = get_session_or_404(session_id)
    applicants = scan_all_applicants(session_id)

    if not applicants:
        raise HTTPException(400, "No applicants in this session")

    results = {"total": len(applicants), "classified": 0, "by_type": {}}

    for a in applicants:
        classification = classify_and_score(a)
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
