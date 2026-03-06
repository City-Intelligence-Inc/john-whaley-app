"""
DynamoDB helper functions. Every database operation goes through here
so route handlers stay clean and don't repeat expression-building logic.
"""

import uuid
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key as DDBKey
from fastapi import HTTPException
from config import applicants_table, sessions_table, settings_table, linkedin_scrapes_table


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
                  "company", "education", "error"):
        val = result.get(field)
        if val is not None:
            item[field] = val

    linkedin_scrapes_table.put_item(Item=item)


# ── Settings operations ──

def get_settings(setting_id: str) -> dict | None:
    response = settings_table.get_item(Key={"setting_id": setting_id})
    item = response.get("Item")
    if not item:
        return None
    return {k: v for k, v in item.items() if k != "setting_id"}


def put_settings(setting_id: str, data: dict) -> None:
    settings_table.put_item(Item={"setting_id": setting_id, **data})
