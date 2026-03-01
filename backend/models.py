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
