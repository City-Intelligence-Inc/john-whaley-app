"""
Admin overview routes.

GET /admin/sessions   All sessions with per-session applicant stats
"""

from collections import defaultdict

from fastapi import APIRouter

import db
from config import applicants_table

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/sessions")
def admin_sessions():
    """
    Return every session with embedded applicant status counts.
    Uses exactly 2 DynamoDB calls (1 session scan + 1 applicant scan).
    """
    sessions = db.list_sessions()

    # Lightweight scan: only pull session_id + status from applicants
    raw = applicants_table.scan(
        ProjectionExpression="session_id, #s",
        ExpressionAttributeNames={"#s": "status"},
    ).get("Items", [])

    # Group counts by session_id
    counts: dict[str, dict[str, int]] = defaultdict(
        lambda: {"total": 0, "pending": 0, "accepted": 0, "rejected": 0, "waitlisted": 0}
    )
    for item in raw:
        sid = item.get("session_id")
        if not sid:
            continue
        bucket = counts[sid]
        bucket["total"] += 1
        status = item.get("status", "pending")
        if status in bucket:
            bucket[status] += 1

    # Merge stats into each session
    for session in sessions:
        sid = session["session_id"]
        session["stats"] = dict(counts[sid])

    return sessions
