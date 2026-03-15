"""
DynamoDB helper functions. Every database operation goes through here
so route handlers stay clean and don't repeat expression-building logic.
"""

import uuid
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key as DDBKey
from fastapi import HTTPException
from config import applicants_table, sessions_table, settings_table, linkedin_scrapes_table, s3, S3_BUCKET


# ── Generic helpers ──

def _build_update_expression(fields: dict) -> tuple[str, dict, dict]:
    """
    Turn {"name": "Alice", "status": "accepted"} into the three DynamoDB
    UpdateExpression components: expression string, values, and names.
    """
    parts, values, names = [], {}, {}
    for key, value in fields.items():
        safe = key.replace("-", "_")
        parts.append(f"#{safe} = :{safe}")
        values[f":{safe}"] = value
        names[f"#{safe}"] = key
    return "SET " + ", ".join(parts), values, names


# ── Session operations ──

def create_session(fields: dict) -> dict:
    """Insert a new session. Auto-generates ID + created_at."""
    fields["session_id"] = str(uuid.uuid4())
    fields["created_at"] = datetime.now(timezone.utc).isoformat()
    fields.setdefault("status", "active")
    fields.setdefault("applicant_count", 0)
    sessions_table.put_item(Item=fields)
    return fields


def list_sessions() -> list[dict]:
    items = sessions_table.scan().get("Items", [])
    return sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)


def get_session_or_404(session_id: str) -> dict:
    response = sessions_table.get_item(Key={"session_id": session_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Session not found")
    return item


def update_session_fields(session_id: str, fields: dict) -> dict:
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    get_session_or_404(session_id)
    expr, values, names = _build_update_expression(fields)
    sessions_table.update_item(
        Key={"session_id": session_id},
        UpdateExpression=expr,
        ExpressionAttributeValues=values,
        ExpressionAttributeNames=names,
    )
    return sessions_table.get_item(Key={"session_id": session_id})["Item"]


def delete_session(session_id: str) -> None:
    """Delete all applicants for a session but preserve the session record."""
    get_session_or_404(session_id)
    delete_all_applicants(session_id=session_id)
    update_session_fields(session_id, {"applicant_count": 0, "status": "cleared"})


def _update_session_count(session_id: str) -> None:
    """Recalculate and update the applicant_count on a session."""
    if not session_id:
        return
    items = applicants_table.query(
        IndexName="session-index",
        KeyConditionExpression=DDBKey("session_id").eq(session_id),
        Select="COUNT",
    )
    count = items.get("Count", 0)
    sessions_table.update_item(
        Key={"session_id": session_id},
        UpdateExpression="SET #c = :c",
        ExpressionAttributeValues={":c": count},
        ExpressionAttributeNames={"#c": "applicant_count"},
    )


# ── Applicant operations ──

def scan_all_applicants(session_id: str | None = None) -> list[dict]:
    if session_id:
        response = applicants_table.query(
            IndexName="session-index",
            KeyConditionExpression=DDBKey("session_id").eq(session_id),
        )
        return response.get("Items", [])
    response = applicants_table.scan()
    return response.get("Items", [])


def get_applicant_or_404(applicant_id: str) -> dict:
    response = applicants_table.get_item(Key={"applicant_id": applicant_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return item


def create_applicant_item(fields: dict) -> dict:
    """Insert a new applicant. Auto-generates ID if not present."""
    if "applicant_id" not in fields:
        fields["applicant_id"] = str(uuid.uuid4())
    fields.setdefault("status", "pending")
    applicants_table.put_item(Item=fields)
    return fields


def update_applicant_fields(applicant_id: str, fields: dict) -> dict:
    """Update arbitrary fields on an applicant. Returns the full updated item."""
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    expr, values, names = _build_update_expression(fields)
    applicants_table.update_item(
        Key={"applicant_id": applicant_id},
        UpdateExpression=expr,
        ExpressionAttributeValues=values,
        ExpressionAttributeNames=names,
    )
    return applicants_table.get_item(Key={"applicant_id": applicant_id})["Item"]


def delete_applicant_item(applicant_id: str) -> None:
    applicants_table.delete_item(Key={"applicant_id": applicant_id})


def delete_all_applicants(session_id: str | None = None) -> int:
    if session_id:
        items = applicants_table.query(
            IndexName="session-index",
            KeyConditionExpression=DDBKey("session_id").eq(session_id),
            ProjectionExpression="applicant_id",
        ).get("Items", [])
    else:
        items = applicants_table.scan(ProjectionExpression="applicant_id").get("Items", [])
    with applicants_table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"applicant_id": item["applicant_id"]})
    return len(items)


def get_status_counts(session_id: str | None = None) -> dict:
    if session_id:
        items = applicants_table.query(
            IndexName="session-index",
            KeyConditionExpression=DDBKey("session_id").eq(session_id),
            ProjectionExpression="#s",
            ExpressionAttributeNames={"#s": "status"},
        ).get("Items", [])
    else:
        items = applicants_table.scan(
            ProjectionExpression="#s",
            ExpressionAttributeNames={"#s": "status"},
        ).get("Items", [])
    counts = {"total": len(items), "pending": 0, "accepted": 0, "rejected": 0, "waitlisted": 0}
    for item in items:
        s = item.get("status", "pending")
        if s in counts:
            counts[s] += 1
    return counts


def scan_existing_emails(session_id: str | None = None) -> dict[str, str]:
    """Return {lowercase_email: applicant_id} for dedup."""
    if session_id:
        items = applicants_table.query(
            IndexName="session-index",
            KeyConditionExpression=DDBKey("session_id").eq(session_id),
            ProjectionExpression="applicant_id, email",
        ).get("Items", [])
    else:
        items = applicants_table.scan(
            ProjectionExpression="applicant_id, email",
        ).get("Items", [])
    return {
        item["email"].strip().lower(): item["applicant_id"]
        for item in items
        if item.get("email")
    }


# ── LinkedIn scrape operations ──

def save_linkedin_scrape(result: dict) -> None:
    """
    Upsert a LinkedIn scrape result into the linkedin-scrapes table.
    Called after every profile attempt (success or failure).
    """
    url = result.get("url")
    if not url:
        return

    item: dict = {"url": url, "scraped_at": datetime.now(timezone.utc).isoformat()}

    # Store all available fields, skip Nones
    for field in ("name", "headline", "photo_url", "location", "connections",
                  "company", "education", "experience", "error"):
        val = result.get(field)
        if val is not None:
            item[field] = val

    linkedin_scrapes_table.put_item(Item=item)


def upload_photo_to_s3(linkedin_url: str, photo_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """Upload a profile photo to S3 and return the public URL."""
    import re
    slug = re.search(r"/in/([^/?&#\s]+)", linkedin_url)
    key = f"photos/{slug.group(1) if slug else uuid.uuid4()}.jpg"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=photo_bytes,
        ContentType=content_type,
    )
    return f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"


def _parse_linkedin_paste(raw: str) -> dict:
    """
    Parse a raw copy-paste from a LinkedIn profile page into structured sections.

    LinkedIn pastes always start with nav junk (notifications, Home, My Network, etc.)
    The real profile starts after "Try Premium for $0" or similar, with the name repeated.
    Sections (Experience, Education, Skills, etc.) appear as standalone header lines.
    The page ends with "More profiles for you" / "People also viewed" / LinkedIn footer.
    """
    import re

    lines = raw.strip().split("\n")
    if not lines:
        return {}

    result: dict = {}

    # ── Step 1: Strip the LinkedIn nav header ──
    # The nav contains: notifications, Home, My Network, Jobs, Messaging, etc.
    # Find the LAST nav marker to skip past all of them.
    profile_start = 0
    nav_end_markers = ["Try Premium", "Retry Premium", "Reactivate Premium", "For Business", "Get the app"]
    for i, line in enumerate(lines):
        stripped = line.strip()
        if any(stripped.startswith(m) for m in nav_end_markers):
            profile_start = i + 1  # keep advancing past ALL nav markers

    # ── Step 2: Strip the footer ──
    # Cut off at the FIRST footer marker (scanning forward from profile_start)
    # to avoid capturing LinkedIn footer "About", "Careers", etc. as profile sections
    profile_end = len(lines)
    footer_markers = ["More profiles for you", "People also viewed",
                       "Explore premium profiles", "LinkedIn Corporation",
                       "Talent Solutions", "Community Guidelines",
                       "Marketing Solutions", "Accessibility"]
    for i in range(profile_start, len(lines)):
        stripped = lines[i].strip()
        if any(stripped == m or stripped.startswith(m) for m in footer_markers):
            profile_end = i
            break

    profile_lines = lines[profile_start:profile_end]

    # ── Step 3: Find the profile header (name, headline, location) ──
    # After nav, first non-empty line = name, then headline, then location info
    clean = [(i, l.strip()) for i, l in enumerate(profile_lines) if l.strip()]
    if not clean:
        return {}

    # Name is first non-empty line after nav (skip any leftover nav junk)
    nav_junk = {"Try Premium", "Retry Premium", "Reactivate Premium", "For Business",
                "Get the app", "Home", "My Network", "Jobs", "Messaging", "Notifications",
                "Post", "Profile", "More", "Search", "Open to"}
    name_idx = 0
    for idx, (_, text) in enumerate(clean):
        if text not in nav_junk and not text.startswith("Try ") and not text.startswith("Retry "):
            name_idx = idx
            break
    result["name"] = clean[name_idx][1]

    # Look through the next ~15 lines for headline, location, connections
    header_lines = clean[1:20]
    ui_junk = {"More", "Message", "Connect", "Follow", "Cover photo",
               "Show credential", "Show all", "Show publication",
               "Like", "Comment", "Repost", "Send"}

    for _, text in header_lines:
        if text in ui_junk or text.startswith("View "):
            continue
        # Headline: typically long-ish, contains "at" or "|" or role-like words
        if not result.get("headline") and len(text) > 10 and text != result["name"]:
            if not re.match(r"^[\d·]+$", text) and "Contact info" not in text:
                result["headline"] = text
                continue
        # Location — must not be the same as headline
        if not result.get("location") and text != result.get("headline") and re.search(
            r"(Area|Bay|Metro|United States|California|New York|London|Canada|India|Japan|China|Singapore|,)", text
        ):
            result["location"] = text.split("·")[0].strip()
            continue

    # Connections — search broadly
    for _, text in clean:
        m = re.search(r"(\d[\d,]*\+?)\s*connections", text, re.I)
        if m:
            result["connections"] = m.group(1)
            break

    # ── Step 4: Split into major sections ──
    section_headers = {
        "About", "Activity", "Experience", "Education",
        "Licenses & certifications", "Skills", "Recommendations",
        "Courses", "Projects", "Publications", "Honors & awards",
        "Languages", "Organizations", "Volunteer experience",
        "Interests", "Services",
    }
    section_lower = {s.lower(): s for s in section_headers}

    sections: dict[str, list[str]] = {}
    current_section = "_header"
    sections[current_section] = []

    for line in profile_lines:
        stripped = line.strip()
        if stripped.lower() in section_lower:
            current_section = section_lower[stripped.lower()]
            sections[current_section] = []
        elif current_section != "_header":
            sections[current_section].append(stripped)

    # ── Step 5: Clean each section — remove UI noise ──
    noise_patterns = [
        r"^\d+ reactions?\d*$", r"^\d+ comments?\d*$", r"^\d+ reposts?\d*$",
        r"^Like$", r"^Comment$", r"^Repost$", r"^Send$", r"^Follow$",
        r"^Show all.*$", r"^Show credential$", r"^Show publication$",
        r"^View .+'s profile", r"^View image$", r"^View company:",
        r"^View celebration", r"^\d+ followers$",
        r"^Endorsed by", r"^\d+ endorsements?$",
        r"^\d+/\d+$",  # image pagination like "1/2"
        r"logo$",  # "company logo"
    ]
    noise_re = re.compile("|".join(noise_patterns), re.I)

    def clean_section(lines_list: list[str]) -> str:
        cleaned = [l for l in lines_list if l and not noise_re.search(l)]
        return "\n".join(cleaned).strip()

    # ── Step 6: Extract structured fields ──
    # About — stop before Activity noise leaks in
    about_lines = sections.get("About", [])
    if about_lines:
        # The About section on LinkedIn ends with "… more" or before Activity
        about_text = []
        for l in about_lines:
            if noise_re.search(l):
                continue
            about_text.append(l)
        result["about"] = "\n".join(about_text).strip()

    # Experience — the big one, includes company logos, roles, dates, descriptions
    exp_lines = sections.get("Experience", [])
    if exp_lines:
        exp_text = clean_section(exp_lines)
        result["experience"] = exp_text
        # First line is usually current company
        first_meaningful = [l for l in exp_lines if l and not noise_re.search(l)]
        if first_meaningful:
            result["company"] = first_meaningful[0]

    # Education
    edu_lines = sections.get("Education", [])
    if edu_lines:
        result["education"] = clean_section(edu_lines)

    # Skills
    skills_lines = sections.get("Skills", [])
    if skills_lines:
        result["skills"] = clean_section(skills_lines)

    # Certifications
    cert_lines = sections.get("Licenses & certifications", [])
    if cert_lines:
        result["certifications"] = clean_section(cert_lines)

    # Languages
    lang_lines = sections.get("Languages", [])
    if lang_lines:
        result["languages"] = clean_section(lang_lines)

    # Volunteer
    vol_lines = sections.get("Volunteer experience", [])
    if vol_lines:
        result["volunteer"] = clean_section(vol_lines)

    # Recommendations
    rec_lines = sections.get("Recommendations", [])
    if rec_lines:
        result["recommendations"] = clean_section(rec_lines)

    # Projects
    proj_lines = sections.get("Projects", [])
    if proj_lines:
        result["projects"] = clean_section(proj_lines)

    # Publications
    pub_lines = sections.get("Publications", [])
    if pub_lines:
        result["publications"] = clean_section(pub_lines)

    # Honors & awards
    awards_lines = sections.get("Honors & awards", [])
    if awards_lines:
        result["awards"] = clean_section(awards_lines)

    # Courses
    courses_lines = sections.get("Courses", [])
    if courses_lines:
        result["courses"] = clean_section(courses_lines)

    # Organizations
    org_lines = sections.get("Organizations", [])
    if org_lines:
        result["organizations"] = clean_section(org_lines)

    return result


def save_manual_linkedin_scrape(data: dict) -> dict:
    """Save a manually scraped LinkedIn profile. Stores raw paste + photo, no parsing."""
    url = data.get("url")
    if not url:
        return {}

    item: dict = {
        "url": url,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "email": data.get("email"),
        "name": data.get("name"),
        "source": "manual",
        "raw_content": data.get("content"),
    }

    # Upload photo if provided as base64
    photo_b64 = data.get("photo_base64")
    if photo_b64:
        import base64
        # Strip data URL prefix if present
        if "," in photo_b64:
            header, photo_b64 = photo_b64.split(",", 1)
            content_type = "image/jpeg"
            if "png" in header:
                content_type = "image/png"
            elif "webp" in header:
                content_type = "image/webp"
        else:
            content_type = "image/jpeg"
        photo_bytes = base64.b64decode(photo_b64)
        photo_url = upload_photo_to_s3(url, photo_bytes, content_type)
        item["photo_url"] = photo_url

    # Remove None/empty values (DynamoDB doesn't allow empty strings)
    item = {k: v for k, v in item.items() if v}
    linkedin_scrapes_table.put_item(Item=item)
    return item


# ── Settings operations ──

def get_settings(setting_id: str) -> dict | None:
    response = settings_table.get_item(Key={"setting_id": setting_id})
    item = response.get("Item")
    if not item:
        return None
    return {k: v for k, v in item.items() if k != "setting_id"}


def put_settings(setting_id: str, data: dict) -> None:
    settings_table.put_item(Item={"setting_id": setting_id, **data})
