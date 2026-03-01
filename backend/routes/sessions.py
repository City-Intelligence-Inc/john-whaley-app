"""
Session CRUD routes.

POST   /sessions        Create a session
GET    /sessions        List all sessions
GET    /sessions/{id}   Get one session
PUT    /sessions/{id}   Update a session
DELETE /sessions/{id}   Delete session + cascade applicants
"""

from fastapi import APIRouter

from models import SessionCreate, SessionUpdate
import db

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", status_code=201)
def create_session(body: SessionCreate):
    fields = body.model_dump(exclude_none=True)
    return db.create_session(fields)


@router.get("")
def list_sessions():
    return db.list_sessions()


@router.get("/{session_id}")
def get_session(session_id: str):
    return db.get_session_or_404(session_id)


@router.put("/{session_id}")
def update_session(session_id: str, body: SessionUpdate):
    fields = body.model_dump(exclude_none=True)
    if not fields:
        return db.get_session_or_404(session_id)
    return db.update_session_fields(session_id, fields)


@router.delete("/{session_id}")
def delete_session(session_id: str):
    db.delete_session(session_id)
    return {"detail": "Session and its applicants deleted"}
