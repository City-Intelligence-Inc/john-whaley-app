"""
Entry point. Creates the FastAPI app, configures CORS, and mounts routers.

Run locally:  uvicorn main:app --reload
Production:   uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from pydantic import BaseModel

from routes.applicants import router as applicants_router
from routes.import_data import router as import_router
from routes.analysis import router as analysis_router
from routes.settings import router as settings_router
from routes.sessions import router as sessions_router
from routes.linkedin import router as linkedin_router
from routes.rank import router as rank_router

app = FastAPI(title="Selecta API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── No-auth endpoints (for local dev — registered before auth routers) ──


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
    import db as _db
    return _db.list_sessions()


@app.post("/sessions", tags=["sessions"])
def create_session_noauth(body: dict):
    import db as _db
    return _db.create_session(body)


@app.get("/sessions/{session_id}", tags=["sessions"])
def get_session_noauth(session_id: str):
    import db as _db
    return _db.get_session_or_404(session_id)


@app.delete("/sessions/{session_id}", tags=["sessions"])
def delete_session_noauth(session_id: str):
    import db as _db
    _db.delete_session(session_id)
    return {"detail": "Session deleted"}


@app.get("/applicants", tags=["applicants"])
def list_applicants_noauth(session_id: Optional[str] = None):
    import db as _db
    return _db.scan_all_applicants(session_id=session_id)


@app.get("/applicants/stats", tags=["applicants"])
def applicant_stats_noauth(session_id: Optional[str] = None):
    import db as _db
    applicants = _db.scan_all_applicants(session_id=session_id)
    stats = {"total": 0, "pending": 0, "accepted": 0, "rejected": 0, "waitlisted": 0}
    for a in applicants:
        stats["total"] += 1
        s = a.get("status", "pending").lower()
        if s in stats:
            stats[s] += 1
    return stats


@app.get("/applicants/ranking-judges", tags=["analysis"])
def ranking_judges_noauth():
    from routes.analysis import RANKING_JUDGES
    return [{"id": k, "name": v["name"], "description": v["description"]} for k, v in RANKING_JUDGES.items()]


@app.post("/applicants/rank", tags=["analysis"])
async def rank_applicants_noauth(body: dict):
    from routes.analysis import rank_applicants as _rank
    from models import ReviewRequest
    req = ReviewRequest(**body)
    return await _rank(req)


@app.put("/applicants/{applicant_id}", tags=["applicants"])
def update_applicant_noauth(applicant_id: str, body: dict):
    import db as _db
    return _db.update_applicant_fields(applicant_id, body)


@app.put("/applicants/batch-status", tags=["applicants"])
def batch_status_noauth(body: dict):
    import db as _db
    ids = body.get("applicant_ids", [])
    status = body.get("status", "pending")
    updated = []
    for aid in ids:
        _db.update_applicant_fields(aid, {"status": status})
        updated.append(aid)
    return {"updated": updated}


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


# Settings router (no auth)
app.include_router(settings_router)

# All routers
app.include_router(sessions_router)
app.include_router(applicants_router)
app.include_router(import_router)
app.include_router(analysis_router)
app.include_router(linkedin_router)
app.include_router(rank_router)


@app.get("/")
def health():
    return {"status": "ok"}
