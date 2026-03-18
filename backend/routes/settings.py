"""
Settings routes — prompts, whitelist/blacklist, per-session lists.
"""

from fastapi import APIRouter

from models import PromptSettings, SelectionPreferences
import db

router = APIRouter(prefix="/settings", tags=["settings"])

SETTINGS_KEY = "review_prompts"
SELECTION_PREFS_KEY = "selection_preferences"


@router.get("/prompts")
def get_prompt_settings():
    data = db.get_settings(SETTINGS_KEY)
    if not data:
        return PromptSettings().model_dump()
    return data


@router.put("/prompts")
def update_prompt_settings(body: PromptSettings):
    db.put_settings(SETTINGS_KEY, body.model_dump())
    return body.model_dump()


@router.get("/selection-preferences")
def get_selection_preferences():
    data = db.get_settings(SELECTION_PREFS_KEY)
    if not data:
        return SelectionPreferences().model_dump()
    return data


@router.put("/selection-preferences")
def update_selection_preferences(body: SelectionPreferences):
    db.put_settings(SELECTION_PREFS_KEY, body.model_dump())
    return body.model_dump()


# ── Whitelist / Blacklist ──

WHITELIST_KEY = "applicant_whitelist"
BLACKLIST_KEY = "applicant_blacklist"


@router.get("/whitelist")
def get_whitelist():
    data = db.get_settings(WHITELIST_KEY)
    return data or {"emails": []}


@router.put("/whitelist")
def update_whitelist(body: dict):
    emails = [e.strip().lower() for e in body.get("emails", []) if e.strip()]
    db.put_settings(WHITELIST_KEY, {"emails": emails})
    return {"emails": emails}


@router.get("/blacklist")
def get_blacklist():
    data = db.get_settings(BLACKLIST_KEY)
    return data or {"emails": []}


@router.put("/blacklist")
def update_blacklist(body: dict):
    emails = [e.strip().lower() for e in body.get("emails", []) if e.strip()]
    db.put_settings(BLACKLIST_KEY, {"emails": emails})
    return {"emails": emails}


# ── Per-Event (Session) Whitelist / Blacklist ──

@router.get("/sessions/{session_id}/whitelist")
def get_session_whitelist(session_id: str):
    data = db.get_settings(f"session_{session_id}_whitelist")
    return data or {"emails": [], "linkedin_urls": []}


@router.put("/sessions/{session_id}/whitelist")
def update_session_whitelist(session_id: str, body: dict):
    emails = [e.strip().lower() for e in body.get("emails", []) if e.strip()]
    linkedin_urls = [u.strip() for u in body.get("linkedin_urls", []) if u.strip()]
    payload = {"emails": emails, "linkedin_urls": linkedin_urls}
    db.put_settings(f"session_{session_id}_whitelist", payload)
    return payload


@router.get("/sessions/{session_id}/blacklist")
def get_session_blacklist(session_id: str):
    data = db.get_settings(f"session_{session_id}_blacklist")
    return data or {"emails": [], "linkedin_urls": []}


@router.put("/sessions/{session_id}/blacklist")
def update_session_blacklist(session_id: str, body: dict):
    emails = [e.strip().lower() for e in body.get("emails", []) if e.strip()]
    linkedin_urls = [u.strip() for u in body.get("linkedin_urls", []) if u.strip()]
    payload = {"emails": emails, "linkedin_urls": linkedin_urls}
    db.put_settings(f"session_{session_id}_blacklist", payload)
    return payload
