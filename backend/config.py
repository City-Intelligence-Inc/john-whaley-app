"""
Shared configuration: DynamoDB tables, constants.
"""

import boto3

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

applicants_table = dynamodb.Table("john-whaley-applicants")
sessions_table = dynamodb.Table("john-whaley-sessions")
settings_table = dynamodb.Table("john-whaley-settings")
linkedin_scrapes_table = dynamodb.Table("linkedin-scrapes")

VALID_STATUSES = {"pending", "accepted", "rejected", "waitlisted"}

AI_FIELDS = {
    "ai_review", "ai_score", "ai_reasoning",
    "attendee_type", "attendee_type_detail",
    "investor_level", "investor_professional",
    "vc_seniority_tier", "vc_fund_name",
    "verification_status", "verification_notes", "verification_flags",
    "panel_votes", "accepting_judges",
    "user_override_attendee_type", "user_override_attendee_type_detail",
}

# ── VC Role Taxonomy ──
# Comprehensive venture capital role hierarchy from junior to senior.
# Used by the AI classification prompt and for seniority scoring.

VC_ROLE_TAXONOMY = {
    # Tier 1: Senior Decision-Makers (highest value — they write checks and sit on boards)
    "managing_partner": {
        "tier": 1, "seniority_score": 100,
        "titles": ["managing partner", "managing director", "managing general partner", "senior managing director"],
        "description": "Leads firm strategy, makes final investment decisions, manages LP relationships, sits on portfolio boards.",
    },
    "gp": {
        "tier": 1, "seniority_score": 95,
        "titles": ["general partner", "founding partner", "senior partner", "founding general partner"],
        "description": "Full partner with carry and decision-making authority. Sources, leads, and closes deals.",
    },
    "partner": {
        "tier": 2, "seniority_score": 85,
        "titles": ["partner", "investment partner", "venture partner"],
        "description": "Senior investment professional. Sources deals, leads due diligence, may sit on boards. Has carry.",
    },
    # Tier 2: Senior Professionals
    "principal": {
        "tier": 2, "seniority_score": 75,
        "titles": ["principal", "director", "investment director", "senior director", "director of investments"],
        "description": "Senior deal professional. Can lead deals independently. Often on partner track.",
    },
    "vp": {
        "tier": 3, "seniority_score": 65,
        "titles": ["vice president", "vp", "senior vice president", "svp", "vp of investments"],
        "description": "Mid-senior professional. Manages deal flow, conducts due diligence, supports partners.",
    },
    # Tier 3: Mid-Level
    "senior_associate": {
        "tier": 3, "seniority_score": 55,
        "titles": ["senior associate", "senior investment associate"],
        "description": "Experienced associate. More independent deal sourcing and analysis.",
    },
    "associate": {
        "tier": 4, "seniority_score": 40,
        "titles": ["associate", "investment associate"],
        "description": "Entry-to-mid level. Supports partners in deal sourcing, due diligence, and portfolio monitoring.",
    },
    # Tier 4: Junior
    "analyst": {
        "tier": 4, "seniority_score": 30,
        "titles": ["analyst", "investment analyst", "research analyst", "junior analyst", "financial analyst"],
        "description": "Entry-level. Market research, financial modeling, deal screening.",
    },
    "intern": {
        "tier": 5, "seniority_score": 15,
        "titles": ["intern", "summer associate", "fellow", "venture fellow"],
        "description": "Temporary/learning role. Limited deal involvement.",
    },
    # Tier 5: Adjacent/Non-Investment Roles (still VC-affiliated but different function)
    "operating_partner": {
        "tier": 2, "seniority_score": 70,
        "titles": ["operating partner", "platform partner", "operating director"],
        "description": "Helps portfolio companies with operations, not primary deal-maker. Still high-value network.",
    },
    "eir": {
        "tier": 3, "seniority_score": 60,
        "titles": ["entrepreneur in residence", "eir", "executive in residence", "xir"],
        "description": "Experienced operator embedded at a fund, often between ventures.",
    },
    "scout": {
        "tier": 5, "seniority_score": 20,
        "titles": ["scout", "venture scout", "deal scout"],
        "description": "Sources deals for a fund, often part-time. Not a full-time investment professional.",
    },
    "advisor": {
        "tier": 4, "seniority_score": 35,
        "titles": ["advisor", "venture advisor", "strategic advisor", "advisory board member", "board advisor"],
        "description": "Advisory relationship with a fund. May help with deal flow but not a full-time investor.",
    },
    # Angel / Independent
    "angel": {
        "tier": 3, "seniority_score": 50,
        "titles": ["angel investor", "angel", "individual investor", "seed investor"],
        "description": "Invests personal capital. Value depends on track record, check size, and network.",
    },
}

# Known VC fund indicators — company names containing these suggest legitimate fund affiliation
VC_FUND_INDICATORS = [
    "ventures", "capital", "partners", "vc", "fund", "investment",
    "venture", "equity", "holdings", "accelerator", "incubator",
    "labs", "studio", "seed", "growth", "asset management",
]

# Red flag company patterns — suggest NOT a real fund
VC_RED_FLAG_PATTERNS = [
    "self-employed", "freelance", "independent", "personal",
    "consulting", "llc",  # personal LLCs often aren't funds
]

_NAME_FALLBACK_KEYS = [
    "name", "full_name", "applicant_name", "person_name", "contact_name",
    "entity", "candidate", "candidate_name", "attendee_name", "member_name",
    "display_name", "applicant", "person", "contact", "attendee", "member",
]


def get_applicant_name(applicant: dict) -> str:
    """Extract the best available name from an applicant record."""
    for key in _NAME_FALLBACK_KEYS:
        val = applicant.get(key)
        if val and str(val).strip():
            return str(val).strip()
    email = applicant.get("email", "")
    if email and "@" in email:
        return email.split("@")[0]
    return "Unknown"
