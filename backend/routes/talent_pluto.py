"""
Talent Pluto Take-Home — sessions, roles, candidates, activity API.

Sessions:
  POST   /talent-pluto/sessions              Create (with results)
  GET    /talent-pluto/sessions              List
  GET    /talent-pluto/sessions/{id}         Get one
  DELETE /talent-pluto/sessions/{id}         Delete

Roles:
  GET    /talent-pluto/roles                 Get custom roles
  PUT    /talent-pluto/roles                 Save custom roles

Candidates:
  GET    /talent-pluto/candidates            List all candidates (across all sessions)
  GET    /talent-pluto/candidates/{key}      Get one candidate's full history
  PUT    /talent-pluto/candidates/{key}/stage  Update pipeline stage for a session

Activity:
  GET    /talent-pluto/activity              Recent activity feed
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import db
from config import settings_table, talent_pluto_table

router = APIRouter(prefix="/talent-pluto", tags=["talent-pluto"])

ROLES_SETTING_ID = "talent-pluto-custom-roles"
CANDIDATES_SETTING_ID = "talent-pluto-candidates"
ACTIVITY_SETTING_ID = "talent-pluto-activity"


# ── Models ──

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


class RoleTemplate(BaseModel):
    title: str
    description: str
    category: str = "Sales"
    locations: list[str] = []
    remote: bool = False
    experience: str = "1-3yr"


class SaveRolesRequest(BaseModel):
    roles: list[RoleTemplate]


class UpdateStageRequest(BaseModel):
    session_id: str
    stage: str  # new, reviewed, interview, offer, hired, passed


# ── Helpers ──

def _log_activity(action: str, metadata: dict):
    """Append an activity entry to the activity log."""
    try:
        entry = {
            "action": action,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **metadata,
        }
        # Get existing log
        item = settings_table.get_item(Key={"setting_id": ACTIVITY_SETTING_ID}).get("Item", {})
        log = item.get("entries", [])
        log.insert(0, entry)
        if len(log) > 200:
            log = log[:200]
        settings_table.put_item(Item={"setting_id": ACTIVITY_SETTING_ID, "entries": log})
    except Exception:
        pass  # activity logging is best-effort


def _update_candidate_record(name: str, linkedin_url: str, session_id: str, role: str, score: int, stage: str = "new"):
    """Update the global candidate record with a new scoring/stage event."""
    try:
        item = settings_table.get_item(Key={"setting_id": CANDIDATES_SETTING_ID}).get("Item", {})
        candidates = item.get("candidates", {})

        key = (linkedin_url or name).lower().strip()
        if not key:
            return

        if key not in candidates:
            candidates[key] = {
                "name": name,
                "linkedin_url": linkedin_url,
                "roles": {},
                "first_seen": datetime.now(timezone.utc).isoformat(),
            }

        candidates[key]["name"] = name  # update to latest
        candidates[key]["last_seen"] = datetime.now(timezone.utc).isoformat()
        candidates[key]["roles"][session_id] = {
            "role": role,
            "score": score,
            "stage": stage,
            "scored_at": datetime.now(timezone.utc).isoformat(),
        }

        settings_table.put_item(Item={"setting_id": CANDIDATES_SETTING_ID, "candidates": candidates})
    except Exception:
        pass


# ── Sessions ──

@router.post("/sessions", status_code=201)
def create_session(body: CreateSessionRequest):
    fields = body.model_dump()
    fields["results"] = [r.model_dump() if hasattr(r, "model_dump") else r for r in fields.get("results", [])]
    session = db.create_tp_session(fields)

    # Update candidate records + log activity
    for r in fields.get("results", []):
        _update_candidate_record(
            name=r.get("name", ""),
            linkedin_url=r.get("id", ""),
            session_id=session["session_id"],
            role=fields.get("role", ""),
            score=r.get("score", 0),
        )

    _log_activity("scored_candidates", {
        "session_id": session["session_id"],
        "role": fields.get("role", ""),
        "candidate_count": fields.get("candidate_count", 0),
        "avg_score": fields.get("avg_score", 0),
        "file_name": fields.get("file_name", ""),
    })

    return session


@router.get("/sessions")
def list_sessions(user_id: Optional[str] = None):
    sessions = db.list_tp_sessions(user_id=user_id)
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
    _log_activity("deleted_session", {"session_id": session_id})
    return {"detail": "Deleted"}


# ── Roles ──

@router.get("/roles")
def get_roles():
    try:
        item = settings_table.get_item(Key={"setting_id": ROLES_SETTING_ID}).get("Item")
        if item and "roles" in item:
            return {"roles": item["roles"], "custom": True}
    except Exception:
        pass
    return {"roles": [], "custom": False}


@router.put("/roles")
def save_roles(body: SaveRolesRequest):
    roles_data = [r.model_dump() for r in body.roles]
    settings_table.put_item(Item={"setting_id": ROLES_SETTING_ID, "roles": roles_data})
    _log_activity("updated_roles", {"count": len(roles_data)})
    return {"roles": roles_data, "count": len(roles_data)}


# ── Candidates ──

@router.get("/candidates")
def list_candidates():
    """Get all candidates across all sessions with their history."""
    try:
        item = settings_table.get_item(Key={"setting_id": CANDIDATES_SETTING_ID}).get("Item", {})
        candidates = item.get("candidates", {})
        # Convert to list sorted by last_seen
        result = []
        for key, data in candidates.items():
            result.append({
                "key": key,
                "name": data.get("name", ""),
                "linkedin_url": data.get("linkedin_url", ""),
                "first_seen": data.get("first_seen", ""),
                "last_seen": data.get("last_seen", ""),
                "roles_count": len(data.get("roles", {})),
                "roles": data.get("roles", {}),
            })
        result.sort(key=lambda x: x.get("last_seen", ""), reverse=True)
        return {"candidates": result, "count": len(result)}
    except Exception:
        return {"candidates": [], "count": 0}


@router.get("/candidates/{key:path}")
def get_candidate(key: str):
    """Get a single candidate's full history."""
    try:
        item = settings_table.get_item(Key={"setting_id": CANDIDATES_SETTING_ID}).get("Item", {})
        candidates = item.get("candidates", {})
        data = candidates.get(key.lower().strip())
        if not data:
            return {"error": "Candidate not found"}
        return data
    except Exception:
        return {"error": "Failed to fetch candidate"}


@router.put("/candidates/{key:path}/stage")
def update_candidate_stage(key: str, body: UpdateStageRequest):
    """Update a candidate's pipeline stage for a specific session."""
    try:
        item = settings_table.get_item(Key={"setting_id": CANDIDATES_SETTING_ID}).get("Item", {})
        candidates = item.get("candidates", {})
        k = key.lower().strip()
        if k not in candidates:
            return {"error": "Candidate not found"}

        if body.session_id in candidates[k].get("roles", {}):
            candidates[k]["roles"][body.session_id]["stage"] = body.stage
            candidates[k]["roles"][body.session_id]["stage_updated_at"] = datetime.now(timezone.utc).isoformat()

        settings_table.put_item(Item={"setting_id": CANDIDATES_SETTING_ID, "candidates": candidates})

        _log_activity("changed_stage", {
            "candidate": candidates[k].get("name", key),
            "stage": body.stage,
            "session_id": body.session_id,
        })

        return {"detail": "Stage updated", "stage": body.stage}
    except Exception as e:
        return {"error": str(e)}


# ── Activity ──

@router.get("/activity")
def get_activity(limit: int = 50):
    """Get recent activity feed."""
    try:
        item = settings_table.get_item(Key={"setting_id": ACTIVITY_SETTING_ID}).get("Item", {})
        entries = item.get("entries", [])
        return {"entries": entries[:limit], "count": len(entries)}
    except Exception:
        return {"entries": [], "count": 0}
