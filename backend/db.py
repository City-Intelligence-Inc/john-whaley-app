"""
DynamoDB helper functions. Every database operation goes through here
so route handlers stay clean and don't repeat expression-building logic.
"""

import uuid
from fastapi import HTTPException
from config import applicants_table, settings_table


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


# ── Applicant operations ──

def scan_all_applicants() -> list[dict]:
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


def delete_all_applicants() -> int:
    items = applicants_table.scan(ProjectionExpression="applicant_id").get("Items", [])
    with applicants_table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"applicant_id": item["applicant_id"]})
    return len(items)


def get_status_counts() -> dict:
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


def scan_existing_emails() -> dict[str, str]:
    """Return {lowercase_email: applicant_id} for dedup."""
    items = applicants_table.scan(
        ProjectionExpression="applicant_id, email",
    ).get("Items", [])
    return {
        item["email"].strip().lower(): item["applicant_id"]
        for item in items
        if item.get("email")
    }


# ── Settings operations ──

def get_settings(setting_id: str) -> dict | None:
    response = settings_table.get_item(Key={"setting_id": setting_id})
    item = response.get("Item")
    if not item:
        return None
    return {k: v for k, v in item.items() if k != "setting_id"}


def put_settings(setting_id: str, data: dict) -> None:
    settings_table.put_item(Item={"setting_id": setting_id, **data})
