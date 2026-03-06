"""
Applicant CRUD routes.

Static paths are defined BEFORE {applicant_id} paths so FastAPI
doesn't accidentally match "stats" or "all" as an applicant ID.

GET    /applicants              List all
GET    /applicants/stats        Status counts
PUT    /applicants/batch-status Bulk status update
DELETE /applicants/all          Delete everything
POST   /applicants              Create one
GET    /applicants/{id}         Get one
PUT    /applicants/{id}         Update one
DELETE /applicants/{id}         Delete one
"""

from fastapi import APIRouter, HTTPException, Query

from config import VALID_STATUSES
from models import ApplicantCreate, ApplicantUpdate, BatchStatusUpdate
import db

router = APIRouter(prefix="/applicants", tags=["applicants"])


# ── Static paths first (no path params) ──

@router.get("/stats")
def get_stats(session_id: str | None = Query(None)):
    return db.get_status_counts(session_id=session_id)


@router.put("/batch-status")
def batch_update_status(body: BatchStatusUpdate):
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {VALID_STATUSES}")

    updated = []
    for applicant_id in body.applicant_ids:
        db.update_applicant_fields(applicant_id, {"status": body.status})
        updated.append(applicant_id)
    return {"updated": updated}


@router.delete("/all")
def delete_all(session_id: str | None = Query(None)):
    count = db.delete_all_applicants(session_id=session_id)
    return {"deleted": count}


@router.get("")
def list_applicants(session_id: str | None = Query(None)):
    return db.scan_all_applicants(session_id=session_id)


@router.post("", status_code=201)
def create_applicant(body: ApplicantCreate):
    fields = {"name": body.name, "status": body.status}
    if body.extra:
        fields.update(body.extra)
    return db.create_applicant_item(fields)


# ── Dynamic paths (with {applicant_id}) ──

@router.get("/{applicant_id}")
def get_applicant(applicant_id: str):
    return db.get_applicant_or_404(applicant_id)


@router.put("/{applicant_id}")
def update_applicant(applicant_id: str, body: ApplicantUpdate):
    db.get_applicant_or_404(applicant_id)

    fields = body.model_dump(exclude_none=True, exclude={"extra"})
    if body.extra:
        fields.update(body.extra)

    # Track user overrides for AI-managed fields
    for field in ("attendee_type", "attendee_type_detail"):
        if field in fields:
            fields[f"user_override_{field}"] = True

    return db.update_applicant_fields(applicant_id, fields)


@router.delete("/{applicant_id}")
def delete_applicant(applicant_id: str):
    db.get_applicant_or_404(applicant_id)
    db.delete_applicant_item(applicant_id)
    return {"detail": "Applicant deleted"}
