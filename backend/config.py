"""
Shared configuration: DynamoDB tables, constants.
"""

import boto3

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

applicants_table = dynamodb.Table("john-whaley-applicants")
sessions_table = dynamodb.Table("john-whaley-sessions")
settings_table = dynamodb.Table("john-whaley-settings")

VALID_STATUSES = {"pending", "accepted", "rejected", "waitlisted"}

AI_FIELDS = {"ai_review", "ai_score", "ai_reasoning", "attendee_type", "attendee_type_detail", "panel_votes", "accepting_judges"}

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
