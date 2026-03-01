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
