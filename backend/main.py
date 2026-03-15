"""
Entry point. Creates the FastAPI app, configures CORS, and mounts all routers.

Run locally:  uvicorn main:app --reload
Production:   uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import require_auth
from routes.applicants import router as applicants_router
from routes.import_data import router as import_router
from routes.analysis import router as analysis_router
from routes.settings import router as settings_router
from routes.sessions import router as sessions_router
from routes.admin import router as admin_router
from routes.scraper import router as scraper_router
from routes.linkedin import router as linkedin_router
from routes.luma import router as luma_router

app = FastAPI(title="John Whaley Applicant Reviewer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── No-auth endpoints (must be registered BEFORE auth-protected routers) ──
from pydantic import BaseModel
from typing import Optional


class ManualScrapeIn(BaseModel):
    url: str
    name: Optional[str] = None
    email: Optional[str] = None
    content: str
    photo_base64: Optional[str] = None


@app.post("/linkedin/manual-scrape", tags=["linkedin"])
def manual_scrape_noauth(body: ManualScrapeIn):
    import db as _db
    result = _db.save_manual_linkedin_scrape(body.model_dump())
    return {"status": "ok", **result}


@app.get("/sessions", tags=["sessions"])
def list_sessions_noauth():
    """List all sessions — no auth for local dev."""
    import db as _db
    return _db.list_sessions()


@app.post("/sessions", tags=["sessions"])
def create_session_noauth(body: dict):
    """Create a session — no auth for local dev."""
    import db as _db
    return _db.create_session(body)


@app.get("/applicants", tags=["applicants"])
def list_applicants_noauth(session_id: Optional[str] = None):
    """List applicants — no auth for local dev."""
    import db as _db
    return _db.scan_all_applicants(session_id=session_id)


@app.get("/linkedin/database", tags=["linkedin"])
def linkedin_database_noauth():
    from config import linkedin_scrapes_table
    response = linkedin_scrapes_table.scan()
    items = response.get("Items", [])
    while "LastEvaluatedKey" in response:
        response = linkedin_scrapes_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    items.sort(key=lambda x: x.get("scraped_at", ""), reverse=True)
    return {"items": items, "count": len(items)}


# Settings router mounted WITHOUT auth for local dev convenience
app.include_router(settings_router)

# All other routers require auth
auth_dep = [Depends(require_auth)]

app.include_router(sessions_router, dependencies=auth_dep)
app.include_router(applicants_router, dependencies=auth_dep)
app.include_router(import_router, dependencies=auth_dep)
app.include_router(analysis_router, dependencies=auth_dep)
app.include_router(admin_router, dependencies=auth_dep)
app.include_router(scraper_router, dependencies=auth_dep)
app.include_router(linkedin_router, dependencies=auth_dep)
app.include_router(luma_router, dependencies=auth_dep)


@app.get("/")
def health():
    return {"status": "ok"}


# ── No-auth single-profile scrape (for local HTML tool) ──
class ScrapeOneIn(BaseModel):
    url: str
    li_at: Optional[str] = None
    user_agent: Optional[str] = None


@app.post("/linkedin/scrape-one", tags=["linkedin"])
async def scrape_one_noauth(body: ScrapeOneIn):
    """Scrape a single LinkedIn profile using li_at cookie, save to DB, return result."""
    from routes.linkedin import _scrape_profile_requests, normalize_linkedin_url
    import db as _db

    norm = normalize_linkedin_url(body.url)
    if not norm:
        return {"error": f"Invalid LinkedIn URL: {body.url}"}

    result = await _scrape_profile_requests(norm, body.li_at, body.user_agent)
    result_dict = result.model_dump()

    # Save to linkedin-scrapes table
    _db.save_linkedin_scrape(result_dict)
    return result_dict
