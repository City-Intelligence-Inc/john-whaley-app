"""
Shared CSV parsing logic used by both CSV upload and Google Sheets import.
"""

import csv
import io
import re

# Column names that should be normalized to "name"
_NAME_KEY_PATTERNS = re.compile(
    r"^(full_name|applicant_name|person_name|contact_name|"
    r"applicant|person|contact|entity|candidate|candidate_name|"
    r"attendee|attendee_name|member|member_name|display_name)$"
)

# Column names that should be normalized to "linkedin_url"
_LINKEDIN_KEY_PATTERNS = re.compile(
    r"^(linkedin|linkedin_url|linkedin_profile|linkedin_link|"
    r"linkedin_profile_url|profile_url|li_url|linked_in)$"
)

# Column names that should be normalized to status
_STATUS_KEY_PATTERNS = re.compile(
    r"^(status|approval_status|approved|approval|decision|rsvp_status|registration_status)$"
)

# Map CSV status values to internal statuses
STATUS_VALUE_MAP = {
    "approved": "accepted", "accepted": "accepted", "yes": "accepted",
    "accept": "accepted", "confirmed": "accepted",
    "declined": "rejected", "rejected": "rejected", "no": "rejected",
    "deny": "rejected", "denied": "rejected",
    "waitlisted": "waitlisted", "waitlist": "waitlisted",
    "maybe": "waitlisted", "pending_review": "waitlisted",
    "pending": "pending", "new": "pending", "": "pending",
}

# Column names that should be normalized to attendance_mode
_ATTENDANCE_KEY_PATTERNS = re.compile(
    r"^(ticket_type|attendance_mode|attendance|joining|"
    r"will_you_be_joining_in_person_or_remote\??|"
    r"in_person_or_remote|rsvp_type|event_type)$"
)

_ATTENDANCE_VALUE_MAP = {
    "in person": "in_person", "in-person": "in_person", "in_person": "in_person",
    "onsite": "in_person", "physical": "in_person", "offline": "in_person",
    "remote": "virtual", "virtual": "virtual", "online": "virtual",
    "zoom": "virtual", "livestream": "virtual",
}


def parse_csv_rows(text: str) -> list[dict]:
    """
    Parse CSV text into a list of clean applicant dicts.
    - Lowercases and snake_cases column headers
    - Strips whitespace from values
    - Auto-constructs 'name' from first_name + last_name if missing
    - Normalizes LinkedIn URL columns (any header variant → linkedin_url)
    - Detects linkedin.com URLs in any column and maps to linkedin_url
    - Skips empty rows
    """
    reader = csv.DictReader(io.StringIO(text))
    rows = []

    for raw_row in reader:
        item: dict[str, str] = {}
        for key, value in raw_row.items():
            if key and value and value.strip():
                clean_key = key.strip().lower().replace(" ", "_")
                item[clean_key] = value.strip()

        if not item:
            continue

        # Auto-construct name from first_name + last_name
        if "name" not in item:
            first = item.get("first_name", "")
            last = item.get("last_name", "")
            if first or last:
                item["name"] = f"{first} {last}".strip()

        # Normalize name: known header variants → name
        if "name" not in item:
            for k in list(item.keys()):
                if _NAME_KEY_PATTERNS.match(k):
                    item["name"] = item[k]
                    break

        # Normalize LinkedIn URL: known header variants → linkedin_url
        if "linkedin_url" not in item:
            for k in list(item.keys()):
                if _LINKEDIN_KEY_PATTERNS.match(k):
                    item["linkedin_url"] = item.pop(k)
                    break

        # Fallback: detect linkedin.com URLs in any value
        if "linkedin_url" not in item:
            for k, v in list(item.items()):
                if "linkedin.com/" in v:
                    item["linkedin_url"] = v
                    if k != "linkedin_url":
                        del item[k]
                    break

        # Normalize status column → _csv_status (import route decides how to use it)
        for k in list(item.keys()):
            if _STATUS_KEY_PATTERNS.match(k):
                item["_csv_status"] = item.pop(k) if k != "status" else item.pop("status")
                break

        # Normalize attendance mode
        if "attendance_mode" not in item:
            for k in list(item.keys()):
                if _ATTENDANCE_KEY_PATTERNS.match(k):
                    raw_val = item[k].strip().lower()
                    item["attendance_mode"] = _ATTENDANCE_VALUE_MAP.get(raw_val, raw_val)
                    break

        rows.append(item)

    return rows
