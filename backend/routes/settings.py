"""
Settings routes — review prompt and criteria configuration.

GET /settings/prompts                    Get current prompt config
PUT /settings/prompts                    Update prompt config
GET /settings/selection-preferences      Get selection preferences
PUT /settings/selection-preferences      Update selection preferences
"""

from fastapi import APIRouter

from models import PromptSettings, SelectionPreferences
from judge_personas import JUDGE_PERSONAS
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


@router.get("/judge-personas")
def get_judge_personas():
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "emoji": p["emoji"],
            "specialty": p["specialty"],
            "description": p["description"],
            "preferred_types": p["preferred_types"],
        }
        for p in JUDGE_PERSONAS
    ]


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


# ── Custom Personas ──

PERSONAS_KEY = "custom_personas"


@router.get("/personas")
def get_personas():
    """Return merged list: built-in + user-customized personas."""
    custom = db.get_settings(PERSONAS_KEY) or {"personas": []}
    builtin_ids = {p["id"] for p in JUDGE_PERSONAS}
    all_personas = [dict(p) for p in JUDGE_PERSONAS]
    for p in custom.get("personas", []):
        if p["id"] in builtin_ids:
            all_personas = [
                {**bp, **p} if bp["id"] == p["id"] else bp
                for bp in all_personas
            ]
        else:
            all_personas.append(p)
    return all_personas


@router.put("/personas/{persona_id}")
def update_persona(persona_id: str, body: dict):
    """Create or update a custom persona."""
    custom = db.get_settings(PERSONAS_KEY) or {"personas": []}
    personas = custom.get("personas", [])
    found = False
    for i, p in enumerate(personas):
        if p.get("id") == persona_id:
            personas[i] = {**p, **body, "id": persona_id}
            found = True
            break
    if not found:
        personas.append({**body, "id": persona_id})
    db.put_settings(PERSONAS_KEY, {"personas": personas})
    return {"detail": "Saved"}


@router.delete("/personas/{persona_id}")
def delete_persona(persona_id: str):
    """Delete a custom persona."""
    custom = db.get_settings(PERSONAS_KEY) or {"personas": []}
    custom["personas"] = [p for p in custom.get("personas", []) if p.get("id") != persona_id]
    db.put_settings(PERSONAS_KEY, custom)
    return {"detail": "Deleted"}


# ── Luma API Key ──

LUMA_KEY = "luma_api_key"


@router.get("/luma-key")
def get_luma_key():
    data = db.get_settings(LUMA_KEY)
    return {"has_key": bool(data)} if data else {"has_key": False}


@router.put("/luma-key")
def set_luma_key(body: dict):
    db.put_settings(LUMA_KEY, {"api_key": body["api_key"]})
    return {"detail": "Saved"}
