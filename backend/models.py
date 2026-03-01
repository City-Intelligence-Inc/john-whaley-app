"""
Pydantic request/response schemas for every endpoint.
"""

from typing import Optional
from pydantic import BaseModel


# ── Applicant CRUD ──

class ApplicantCreate(BaseModel):
    name: str
    status: str = "pending"
    extra: Optional[dict] = None


class ApplicantUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    extra: Optional[dict] = None


class BatchStatusUpdate(BaseModel):
    applicant_ids: list[str]
    status: str


# ── Data Import ──

class GoogleSheetImport(BaseModel):
    sheet_url: str
    sheet_name: Optional[str] = None
    session_id: Optional[str] = None


# ── Selection Preferences ──

class SelectionPreferences(BaseModel):
    venue_capacity: Optional[int] = None          # null = no limit
    attendee_mix: dict[str, int] = {}             # type -> target %
    auto_accept_types: list[str] = []             # types to auto-accept
    relevance_filter: str = "moderate"            # strict|moderate|loose|none
    custom_priorities: str = ""                   # freeform text
    custom_categories: list[str] = []             # user-added attendee types


# ── AI Analysis ──

class ReviewRequest(BaseModel):
    api_key: str
    model: str = "claude-sonnet-4-20250514"
    provider: str = "anthropic"
    prompt: Optional[str] = None
    criteria: Optional[list[str]] = None


class BulkAnalyzeRequest(BaseModel):
    api_key: str
    model: str = "claude-sonnet-4-20250514"
    provider: str = "anthropic"
    prompt: str
    criteria: list[str] = []
    criteria_weights: Optional[list[str]] = None
    session_id: Optional[str] = None
    selection_preferences: Optional[SelectionPreferences] = None


# ── Settings ──

class PromptSettings(BaseModel):
    default_prompt: str = (
        "You are reviewing an event applicant. Based on the applicant's "
        "information below, provide a brief assessment of their fit for the "
        "event. Consider their professional background, relevance, and "
        "potential contribution."
    )
    criteria: list[str] = ["relevance", "experience", "potential_contribution"]


# ── Sessions ──

class SessionCreate(BaseModel):
    name: str
    source: str = "manual"          # "csv", "google_sheet", "manual"
    source_detail: Optional[str] = None


class SessionUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None    # "active", "archived"
