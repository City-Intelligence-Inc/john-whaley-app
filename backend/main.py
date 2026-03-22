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


# ── Public LinkedIn Lookup API ──
# Send a LinkedIn URL, get back structured profile data.
# Checks cache first, scrapes live if not found.

_PROFILE_FIELDS = [
    "name", "headline", "photo_url", "location", "connections",
    "company", "education", "experience", "about", "skills",
    "certifications", "languages",
]


@app.get("/api/v1/linkedin/profile", tags=["public-api"])
def public_linkedin_lookup(url: str):
    """
    Public API: look up a LinkedIn profile by URL.

    Returns structured profile data. Checks the cache first;
    if not found, scrapes it live from LinkedIn.
    """
    from routes.linkedin import normalize_linkedin_url
    import db as _db

    norm = normalize_linkedin_url(url)
    if not norm:
        return {"error": "Invalid LinkedIn URL", "url": url}

    # 1. Check cache (try with and without trailing slash)
    cached = _db.get_linkedin_scrape(norm) or _db.get_linkedin_scrape(norm.rstrip("/"))
    if cached:
        profile = {k: cached.get(k) for k in _PROFILE_FIELDS if cached.get(k)}
        profile["url"] = norm
        profile["source"] = "cache"
        return profile

    # 2. Live scrape (public, no auth)
    try:
        import requests as _req
        sess = _req.Session()
        sess.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        })
        from routes.linkedin import _scrape_url_blocking
        result = _scrape_url_blocking(norm, sess, max_retries=2)

        if result.get("error"):
            return {"error": result["error"], "url": norm}

        # Save to cache for next time
        result["url"] = norm
        _db.save_linkedin_scrape(result)

        profile = {k: result.get(k) for k in _PROFILE_FIELDS if result.get(k)}
        profile["url"] = norm
        profile["source"] = "live"
        return profile
    except Exception as e:
        return {"error": str(e), "url": norm}


@app.post("/api/v1/linkedin/profiles", tags=["public-api"])
def public_linkedin_bulk(body: dict):
    """
    Public API: look up multiple LinkedIn profiles.

    Body: {"urls": ["https://linkedin.com/in/...", ...]}
    Returns: {"profiles": [...], "errors": [...]}
    """
    from routes.linkedin import normalize_linkedin_url
    import db as _db

    urls = body.get("urls", [])
    if not urls or not isinstance(urls, list):
        return {"error": "Provide a 'urls' array"}
    if len(urls) > 50:
        return {"error": "Max 50 URLs per request"}

    profiles, errors = [], []
    for raw_url in urls:
        norm = normalize_linkedin_url(raw_url)
        if not norm:
            errors.append({"url": raw_url, "error": "Invalid URL"})
            continue
        cached = _db.get_linkedin_scrape(norm) or _db.get_linkedin_scrape(norm.rstrip("/"))
        if cached:
            p = {k: cached.get(k) for k in _PROFILE_FIELDS if cached.get(k)}
            p["url"] = norm
            p["source"] = "cache"
            profiles.append(p)
        else:
            errors.append({"url": norm, "error": "Not in cache — use GET /api/v1/linkedin/profile?url= to scrape"})

    return {"profiles": profiles, "errors": errors, "found": len(profiles), "total": len(urls)}


@app.post("/api/v1/linkedin/photo", tags=["public-api"])
def update_linkedin_photo(body: dict):
    """Update just the photo for an existing LinkedIn profile."""
    url = body.get("url", "")
    photo_b64 = body.get("photo_base64", "")
    if not url or not photo_b64:
        return {"error": "Provide url and photo_base64"}

    try:
        import base64
        import db as _db
        from routes.linkedin import normalize_linkedin_url
        from config import linkedin_scrapes_table

        norm = normalize_linkedin_url(url) or url

        # Find the actual key in DynamoDB
        existing = _db.get_linkedin_scrape(norm) or _db.get_linkedin_scrape(norm.rstrip("/")) or _db.get_linkedin_scrape(url)
        db_key = existing["url"] if existing else norm

        # Decode base64
        raw = photo_b64
        if "," in raw:
            raw = raw.split(",", 1)[1]
        photo_bytes = base64.b64decode(raw)

        # Upload to S3
        photo_url = _db.upload_photo_to_s3(db_key, photo_bytes)

        # Update DynamoDB
        linkedin_scrapes_table.update_item(
            Key={"url": db_key},
            UpdateExpression="SET photo_url = :p",
            ExpressionAttributeValues={":p": photo_url},
        )

        return {"url": db_key, "photo_url": photo_url}
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}

    return {"url": norm, "photo_url": photo_url}


@app.get("/")
def health():
    return {"status": "ok"}
