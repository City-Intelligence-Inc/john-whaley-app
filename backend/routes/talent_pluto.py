"""
Talent Pluto Take-Home — match session CRUD.

Stores CSV uploads, role configs, and AI scoring results in DynamoDB.
Each session = one CSV upload matched against one role.

POST   /talent-pluto/sessions              Create a session (with results)
GET    /talent-pluto/sessions              List all sessions
GET    /talent-pluto/sessions/{id}         Get one session
DELETE /talent-pluto/sessions/{id}         Delete a session
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import db

router = APIRouter(prefix="/talent-pluto", tags=["talent-pluto"])


class ScoredCandidate(BaseModel):
    id: str
    rank: int
    name: str
    score: int
    reasoning: str
    highlights: list[str] = []
    gaps: list[str] = []


class CreateSessionRequest(BaseModel):
    role: str
    role_category: str = ""
    description: str = ""
    file_name: str = ""
    candidate_count: int = 0
    top_tier: int = 0
    good_fit: int = 0
    avg_score: int = 0
    results: list[ScoredCandidate] = []
    user_id: Optional[str] = None


@router.post("/sessions", status_code=201)
def create_session(body: CreateSessionRequest):
    fields = body.model_dump()
    # Convert results to plain dicts for DynamoDB
    fields["results"] = [r.model_dump() if hasattr(r, "model_dump") else r for r in fields.get("results", [])]
    return db.create_tp_session(fields)


@router.get("/sessions")
def list_sessions(user_id: Optional[str] = None):
    sessions = db.list_tp_sessions(user_id=user_id)
    # Return without full results for list view (lighter payload)
    return [
        {
            "session_id": s["session_id"],
            "role": s.get("role", ""),
            "role_category": s.get("role_category", ""),
            "file_name": s.get("file_name", ""),
            "candidate_count": s.get("candidate_count", 0),
            "top_tier": s.get("top_tier", 0),
            "good_fit": s.get("good_fit", 0),
            "avg_score": s.get("avg_score", 0),
            "created_at": s.get("created_at", ""),
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    return db.get_tp_session(session_id)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    db.delete_tp_session(session_id)
    return {"detail": "Deleted"}
