"""
Settings routes — review prompt and criteria configuration.

GET /settings/prompts     Get current prompt config
PUT /settings/prompts     Update prompt config
"""

from fastapi import APIRouter

from models import PromptSettings
import db

router = APIRouter(prefix="/settings", tags=["settings"])

SETTINGS_KEY = "review_prompts"


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
