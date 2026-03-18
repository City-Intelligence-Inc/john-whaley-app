"""
Judges API — CRUD for AI judge personas + knowledgebase management.

GET    /judges              List all judges
GET    /judges/{id}         Get one judge
POST   /judges              Create custom judge
PUT    /judges/{id}         Update judge (name, prompt, knowledgebase, etc.)
DELETE /judges/{id}         Delete a custom judge
PUT    /judges/{id}/knowledgebase   Upload/update knowledgebase text
"""

import boto3
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, UploadFile, File

router = APIRouter(prefix="/judges", tags=["judges"])

_table = None

def _get_table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb", region_name="us-east-1").Table("selecta-judges")
    return _table


@router.get("")
def list_judges():
    table = _get_table()
    resp = table.scan()
    items = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items.extend(resp.get("Items", []))
    # Sort: builtins first, then by name
    items.sort(key=lambda x: (not x.get("is_builtin", False), x.get("name", "")))
    return items


@router.get("/{judge_id}")
def get_judge(judge_id: str):
    table = _get_table()
    resp = table.get_item(Key={"judge_id": judge_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(404, "Judge not found")
    return item


@router.post("", status_code=201)
def create_judge(body: dict):
    table = _get_table()
    judge_id = body.get("judge_id", "").strip().lower().replace(" ", "_")
    if not judge_id:
        import uuid
        judge_id = f"custom_{uuid.uuid4().hex[:8]}"

    # Check if exists
    existing = table.get_item(Key={"judge_id": judge_id}).get("Item")
    if existing:
        raise HTTPException(400, f"Judge '{judge_id}' already exists")

    item = {
        "judge_id": judge_id,
        "name": body.get("name", "Custom Judge"),
        "emoji": body.get("emoji", "⚖️"),
        "specialty": body.get("specialty", ""),
        "description": body.get("description", ""),
        "prompt": body.get("prompt", ""),
        "preferred_types": body.get("preferred_types", []),
        "scoring_criteria": body.get("scoring_criteria", []),
        "shape": body.get("shape", "circle"),
        "color": body.get("color", "bg-gray-100 dark:bg-gray-900/40"),
        "knowledgebase": body.get("knowledgebase", []),
        "knowledgebase_text": body.get("knowledgebase_text", ""),
        "is_builtin": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    table.put_item(Item=item)
    return item


@router.put("/{judge_id}")
def update_judge(judge_id: str, body: dict):
    table = _get_table()
    existing = table.get_item(Key={"judge_id": judge_id}).get("Item")
    if not existing:
        raise HTTPException(404, "Judge not found")

    # Allowed fields to update
    allowed = {
        "name", "emoji", "specialty", "description", "prompt",
        "preferred_types", "scoring_criteria", "shape", "color",
        "knowledgebase", "knowledgebase_text",
    }
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return existing

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    expr_parts, attr_names, attr_values = [], {}, {}
    for i, (k, v) in enumerate(updates.items()):
        alias = f"#f{i}"
        val = f":v{i}"
        expr_parts.append(f"{alias} = {val}")
        attr_names[alias] = k
        attr_values[val] = v

    table.update_item(
        Key={"judge_id": judge_id},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values,
    )
    return table.get_item(Key={"judge_id": judge_id})["Item"]


@router.delete("/{judge_id}")
def delete_judge(judge_id: str):
    table = _get_table()
    existing = table.get_item(Key={"judge_id": judge_id}).get("Item")
    if not existing:
        raise HTTPException(404, "Judge not found")
    if existing.get("is_builtin"):
        raise HTTPException(400, "Cannot delete built-in judges. You can modify their prompts instead.")
    table.delete_item(Key={"judge_id": judge_id})
    return {"detail": f"Deleted judge '{judge_id}'"}


@router.put("/{judge_id}/knowledgebase")
def update_knowledgebase(judge_id: str, body: dict):
    """Update a judge's knowledgebase text. This is appended to their prompt during analysis."""
    table = _get_table()
    existing = table.get_item(Key={"judge_id": judge_id}).get("Item")
    if not existing:
        raise HTTPException(404, "Judge not found")

    kb_text = body.get("knowledgebase_text", "")

    table.update_item(
        Key={"judge_id": judge_id},
        UpdateExpression="SET knowledgebase_text = :kb, updated_at = :t",
        ExpressionAttributeValues={
            ":kb": kb_text,
            ":t": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"judge_id": judge_id, "knowledgebase_text": kb_text, "detail": "Knowledgebase updated"}


S3_BUCKET = "john-whaley-linkedin-photos"  # Reuse existing bucket
S3_PREFIX = "judge-knowledgebases"


@router.post("/{judge_id}/upload")
async def upload_knowledgebase_file(judge_id: str, file: UploadFile = File(...)):
    """Upload a file (PDF, TXT, CSV, MD) to a judge's knowledgebase on S3."""
    table = _get_table()
    existing = table.get_item(Key={"judge_id": judge_id}).get("Item")
    if not existing:
        raise HTTPException(404, "Judge not found")

    # Read file content
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(400, "File too large (max 10MB)")

    # Upload to S3
    s3 = boto3.client("s3", region_name="us-east-1")
    file_key = f"{S3_PREFIX}/{judge_id}/{uuid.uuid4().hex[:8]}_{file.filename}"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=file_key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )
    s3_url = f"https://{S3_BUCKET}.s3.amazonaws.com/{file_key}"

    # If it's a text file, also extract content and append to knowledgebase_text
    extracted_text = ""
    if file.filename and file.filename.lower().endswith(('.txt', '.md', '.csv')):
        try:
            extracted_text = content.decode("utf-8", errors="ignore")
        except Exception:
            pass

    # Update judge's knowledgebase list
    kb_list = existing.get("knowledgebase", []) or []
    kb_list.append({
        "filename": file.filename,
        "s3_url": s3_url,
        "s3_key": file_key,
        "size": len(content),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    })

    update_expr = "SET knowledgebase = :kb, updated_at = :t"
    update_vals = {
        ":kb": kb_list,
        ":t": datetime.now(timezone.utc).isoformat(),
    }

    # Append extracted text to knowledgebase_text
    if extracted_text:
        current_kb_text = existing.get("knowledgebase_text", "") or ""
        new_kb_text = current_kb_text + f"\n\n--- From {file.filename} ---\n" + extracted_text
        update_expr += ", knowledgebase_text = :kbt"
        update_vals[":kbt"] = new_kb_text

    table.update_item(
        Key={"judge_id": judge_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=update_vals,
    )

    return {
        "judge_id": judge_id,
        "filename": file.filename,
        "s3_url": s3_url,
        "size": len(content),
        "text_extracted": bool(extracted_text),
        "detail": "File uploaded to knowledgebase",
    }


@router.delete("/{judge_id}/knowledgebase/{file_index}")
def delete_knowledgebase_file(judge_id: str, file_index: int):
    """Remove a file from a judge's knowledgebase."""
    table = _get_table()
    existing = table.get_item(Key={"judge_id": judge_id}).get("Item")
    if not existing:
        raise HTTPException(404, "Judge not found")

    kb_list = existing.get("knowledgebase", []) or []
    if file_index < 0 or file_index >= len(kb_list):
        raise HTTPException(400, f"Invalid file index {file_index}")

    removed = kb_list.pop(file_index)

    # Delete from S3
    try:
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.delete_object(Bucket=S3_BUCKET, Key=removed["s3_key"])
    except Exception:
        pass

    table.update_item(
        Key={"judge_id": judge_id},
        UpdateExpression="SET knowledgebase = :kb, updated_at = :t",
        ExpressionAttributeValues={
            ":kb": kb_list,
            ":t": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {"detail": f"Removed {removed.get('filename', 'file')}", "remaining": len(kb_list)}
