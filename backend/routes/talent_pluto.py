"""
Talent Pluto Take-Home — sessions + roles API.

Sessions: CSV uploads matched against roles, stored in DynamoDB.
Roles: Custom role templates, stored in settings table.

Sessions:
  POST   /talent-pluto/sessions              Create
  GET    /talent-pluto/sessions              List
  GET    /talent-pluto/sessions/{id}         Get one
  DELETE /talent-pluto/sessions/{id}         Delete

Roles:
  GET    /talent-pluto/roles                 Get all custom roles
  PUT    /talent-pluto/roles                 Save all custom roles
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import db
from config import settings_table

router = APIRouter(prefix="/talent-pluto", tags=["talent-pluto"])

ROLES_SETTING_ID = "talent-pluto-custom-roles"


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


# ── Roles ──

class RoleTemplate(BaseModel):
    title: str
    description: str
    category: str = "Sales"
    locations: list[str] = []
    remote: bool = False
    experience: str = "1-3yr"


class SaveRolesRequest(BaseModel):
    roles: list[RoleTemplate]


@router.get("/roles")
def get_roles():
    """Get custom roles. Returns empty list if none saved (frontend uses defaults)."""
    try:
        item = settings_table.get_item(Key={"setting_id": ROLES_SETTING_ID}).get("Item")
        if item and "roles" in item:
            return {"roles": item["roles"], "custom": True}
    except Exception:
        pass
    return {"roles": [], "custom": False}


@router.put("/roles")
def save_roles(body: SaveRolesRequest):
    """Save custom roles. Overwrites all roles."""
    roles_data = [r.model_dump() for r in body.roles]
    settings_table.put_item(Item={
        "setting_id": ROLES_SETTING_ID,
        "roles": roles_data,
    })
    return {"roles": roles_data, "count": len(roles_data)}
