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
from routes.talent_pluto import router as talent_pluto_router

app = FastAPI(title="Selecta API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
app.include_router(talent_pluto_router)


# ── Public LinkedIn Lookup API ──
# Send a LinkedIn URL, get back structured profile data.
# Checks cache first, scrapes live if not found.

_PROFILE_FIELDS = [
    "name", "headline", "photo_url", "location", "connections",
    "company", "education", "experience", "about", "skills",
    "certifications", "languages",
    # Sales enrichment fields
    "total_years_sales_experience", "industries", "sales_tool_experience",
    "deal_size", "sales_kpis", "competencies", "sdr_grade", "sdr_grade_reasoning",
    "ae_grade", "ae_grade_reasoning", "highlights", "buyer_personas",
    "products_sold", "sales_cycle_description", "ranking_within_team_new",
    # YC fields
    "bio", "interest", "hobbies", "college_company", "github_url", "country",
    # Meta
    "csv_source", "ai_enriched",
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

    # 1. Check cache (try all URL variants, pick richest entry)
    candidates = []
    for u in [norm, norm.rstrip("/"), url, url.rstrip("/")]:
        item = _db.get_linkedin_scrape(u)
        if item:
            candidates.append(item)
    if candidates:
        # Pick the entry with the most fields
        cached = max(candidates, key=lambda x: len(x))
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


_ENRICH_SALES_PROMPT = """You are analyzing a LinkedIn profile to extract structured sales-related fields.

Here is the profile data:

Name: {name}
Headline: {headline}
Location: {location}
About: {about}
Experience: {experience}
Education: {education}
Skills: {skills}
Company: {company}

Analyze this profile and return a JSON object with these fields. Be accurate — if you can't determine a field, use null. Don't invent data.

{{
  "total_years_sales_experience": <integer or 0 if no sales experience>,
  "industries": <JSON array of industry strings, e.g. ["SaaS", "Healthcare", "Financial Services"]>,
  "sales_tool_experience": <JSON array of sales tools mentioned or inferred, e.g. ["Salesforce", "HubSpot"]>,
  "deal_size": <estimated average deal size in dollars as integer, or null if unknown>,
  "sales_kpis": <JSON array of KPIs mentioned, e.g. ["revenue", "pipeline", "quota attainment"]>,
  "competencies": [
    {{"name": "Communication", "score": <1-5>, "assessment": "<one sentence>"}},
    {{"name": "Prospecting", "score": <1-5>, "assessment": "<one sentence>"}},
    {{"name": "Closing", "score": <1-5>, "assessment": "<one sentence>"}},
    {{"name": "Domain Knowledge", "score": <1-5>, "assessment": "<one sentence>"}},
    {{"name": "Organization", "score": <1-5>, "assessment": "<one sentence>"}}
  ],
  "sdr_grade": "<S/A/B/C/D/F based on prospecting/outbound potential>",
  "sdr_grade_reasoning": "<one sentence>",
  "ae_grade": "<S/A/B/C/D/F based on closing/deal-making potential>",
  "ae_grade_reasoning": "<one sentence>",
  "highlights": "<top 3 achievements or notable points, as text>",
  "buyer_personas": <JSON array, e.g. ["C-suite", "VP Engineering", "IT Directors"]>,
  "products_sold": <JSON array, e.g. ["SaaS", "Enterprise Software"]>,
  "sales_cycle_description": "<brief description of likely sales cycle based on their experience>",
  "ranking_within_team_new": <integer 1-100 percentile estimate if any evidence, or null>
}}

RULES:
- If the person has NO sales experience at all, still fill in what you can infer
- Grade generously for adjacent roles (BD, GTM, Growth, Partnerships)
- Use the experience section to count years carefully
- Return ONLY the JSON, no other text
""".strip()


@app.post("/api/v1/linkedin/enrich-sales", tags=["public-api"])
async def enrich_sales(body: dict):
    """Enrich all LinkedIn profiles with sales-specific fields using AI."""
    import asyncio
    import json as _json
    from config import linkedin_scrapes_table
    from ai import call_ai_async, parse_json_response
    from fastapi.responses import StreamingResponse

    api_key = body.get("api_key", "")
    provider = body.get("provider", "anthropic")
    model = body.get("model", "claude-sonnet-4-20250514")

    if not api_key:
        return {"error": "Provide api_key"}

    # Scan all profiles
    response = linkedin_scrapes_table.scan()
    items = response.get("Items", [])
    while "LastEvaluatedKey" in response:
        response = linkedin_scrapes_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    # Filter to profiles that need enrichment
    to_enrich = []
    for item in items:
        if item.get("csv_source") == "sales-takehome":
            continue  # already has real data
        if item.get("ai_enriched"):
            continue  # already enriched by AI
        if not item.get("headline") and not item.get("experience") and not item.get("name"):
            continue  # nothing to work with
        to_enrich.append(item)

    async def stream():
        yield f"event: start\ndata: {_json.dumps({'total': len(to_enrich), 'skipped': len(items) - len(to_enrich)})}\n\n"

        sem = asyncio.Semaphore(5)
        completed, errors = 0, 0

        async def process_one(item):
            nonlocal completed, errors
            url = item["url"]
            name = item.get("name", "Unknown")

            prompt = _ENRICH_SALES_PROMPT.format(
                name=name,
                headline=item.get("headline", ""),
                location=item.get("location", ""),
                about=item.get("about", "")[:500],
                experience=item.get("experience", "")[:1000],
                education=item.get("education", ""),
                skills=item.get("skills", "")[:500],
                company=item.get("company", ""),
            )

            async with sem:
                try:
                    raw = await call_ai_async(provider, api_key, model, prompt, max_tokens=1024)
                    result = parse_json_response(raw)

                    # Build DynamoDB update
                    updates = {"ai_enriched": True}
                    for key in [
                        "total_years_sales_experience", "industries", "sales_tool_experience",
                        "deal_size", "sales_kpis", "competencies", "sdr_grade", "sdr_grade_reasoning",
                        "ae_grade", "ae_grade_reasoning", "highlights", "buyer_personas",
                        "products_sold", "sales_cycle_description", "ranking_within_team_new",
                    ]:
                        val = result.get(key)
                        if val is not None:
                            updates[key] = _json.dumps(val) if isinstance(val, (list, dict)) else str(val) if not isinstance(val, str) else val

                    # Remove empty strings (DynamoDB doesn't allow them)
                    updates = {k: v for k, v in updates.items() if v not in ("", "null", None)}

                    expr_parts, names, values = [], {}, {}
                    for i, (k, v) in enumerate(updates.items()):
                        expr_parts.append(f"#f{i} = :v{i}")
                        names[f"#f{i}"] = k
                        values[f":v{i}"] = v

                    linkedin_scrapes_table.update_item(
                        Key={"url": url},
                        UpdateExpression="SET " + ", ".join(expr_parts),
                        ExpressionAttributeNames=names,
                        ExpressionAttributeValues=values,
                    )

                    completed += 1
                    return {"name": name, "url": url, "completed": completed, "total": len(to_enrich), "sdr_grade": result.get("sdr_grade", ""), "ae_grade": result.get("ae_grade", "")}
                except Exception as e:
                    errors += 1
                    completed += 1
                    return {"name": name, "url": url, "error": str(e), "completed": completed, "total": len(to_enrich)}

        tasks = [asyncio.ensure_future(process_one(item)) for item in to_enrich]
        for coro in asyncio.as_completed(tasks):
            result = await coro
            if "error" in result:
                yield f"event: error\ndata: {_json.dumps(result)}\n\n"
            else:
                yield f"event: progress\ndata: {_json.dumps(result)}\n\n"

        yield f"event: complete\ndata: {_json.dumps({'completed': completed, 'errors': errors, 'total': len(to_enrich)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/")
def health():
    return {"status": "ok"}
