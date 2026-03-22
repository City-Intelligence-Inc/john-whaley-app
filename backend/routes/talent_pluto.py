"""
Talent Pluto Take-Home — sessions, roles, candidates, scoring API.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import json, asyncio, os
import db
from config import settings_table, talent_pluto_table, linkedin_scrapes_table
from ai import call_ai_async

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

router = APIRouter(prefix="/talent-pluto", tags=["talent-pluto"])

ROLES_SETTING_ID = "talent-pluto-custom-roles"
CANDIDATES_SETTING_ID = "talent-pluto-candidates"
ACTIVITY_SETTING_ID = "talent-pluto-activity"


# ── Models ──

class ScoredCandidate(BaseModel):
    model_config = {"extra": "allow"}
    id: str
    rank: int
    name: str
    score: int
    reasoning: str
    highlights: list[str] = []
    gaps: list[str] = []
    photo_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    criteria: Optional[list] = None
    evidence: Optional[dict] = None

class CreateSessionRequest(BaseModel):
    role: str
    role_category: str = ""
    description: str = ""
    file_name: str = ""
    candidate_count: int = 0
    top_tier: int = 0
    good_fit: int = 0
    avg_score: int = 0
    results: list[ScoredCandidate] = []
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    duration: Optional[int] = None
    device: Optional[str] = None
    tokens: Optional[int] = None
    cost: Optional[float] = None
    judge: Optional[str] = None

class RoleTemplate(BaseModel):
    title: str
    description: str
    category: str = "Sales"
    locations: list[str] = []
    remote: bool = False
    experience: str = "1-3yr"

class SaveRolesRequest(BaseModel):
    roles: list[RoleTemplate]

class ScoreRequest(BaseModel):
    candidates: list[dict]  # [{id, name, fullText, linkedinUrl?}]
    job_description: str
    api_key: str = ""
    top_k: int = 100
    ideal_candidate: str = ""  # HyDE: ideal candidate profile for embedding comparison

class UpdateStageRequest(BaseModel):
    session_id: str
    stage: str


# ── Helpers ──

def _log_activity(action: str, metadata: dict):
    try:
        entry = {"action": action, "timestamp": datetime.now(timezone.utc).isoformat(), **metadata}
        item = settings_table.get_item(Key={"setting_id": ACTIVITY_SETTING_ID}).get("Item", {})
        log = item.get("entries", [])
        log.insert(0, entry)
        if len(log) > 200: log = log[:200]
        settings_table.put_item(Item={"setting_id": ACTIVITY_SETTING_ID, "entries": log})
    except Exception:
        pass


def _load_linkedin_db() -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Load all LinkedIn profiles. Returns (url->enrichment_text, url->photo_url, url->name)."""
    enrichments = {}
    photos = {}
    names = {}
    try:
        resp = linkedin_scrapes_table.scan()
        items = resp.get("Items", [])
        while "LastEvaluatedKey" in resp:
            resp = linkedin_scrapes_table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
            items.extend(resp.get("Items", []))
        for p in items:
            url = (p.get("url") or "").rstrip("/").lower()
            if not url: continue
            if p.get("photo_url"): photos[url] = p["photo_url"]
            if p.get("name"): names[url] = p["name"]
            parts = []
            if p.get("name"): parts.append(f"Name: {p['name']}")
            if p.get("headline"): parts.append(f"Headline: {p['headline']}")
            if p.get("company"): parts.append(f"Company: {p['company']}")
            if p.get("experience"): parts.append(f"Experience: {str(p['experience'])[:500]}")
            if p.get("education"): parts.append(f"Education: {p['education']}")
            if p.get("skills"): parts.append(f"Skills: {str(p['skills'])[:300]}")
            if p.get("resume_text"): parts.append(f"Resume: {str(p['resume_text'])[:600]}")
            if parts:
                enrichments[url] = "\n--- LinkedIn ---\n" + "\n".join(parts)
    except Exception:
        pass
    return enrichments, photos, names


# ── Score endpoint (SSE, runs on App Runner = no timeout) ──

async def _embedding_prefilter(candidates: list[dict], job_description: str, api_key: str, top_k: int = 100, ideal_candidate: str = "") -> list[dict]:
    """Use embeddings to shortlist top_k candidates before expensive GPT scoring."""
    if len(candidates) <= top_k:
        return candidates  # No need to filter

    try:
        import openai as openai_lib
        client = openai_lib.AsyncOpenAI(api_key=api_key)

        # HyDE: embed ideal candidate profile if provided, otherwise job description
        embed_text = ideal_candidate[:2000] if ideal_candidate else job_description[:2000]
        jd_resp = await client.embeddings.create(model="text-embedding-3-small", input=[embed_text])
        jd_vec = jd_resp.data[0].embedding

        # Embed all candidates (batch of 100)
        all_texts = [c.get("fullText", "")[:500] for c in candidates]
        all_vecs = []
        for i in range(0, len(all_texts), 100):
            batch = all_texts[i:i+100]
            resp = await client.embeddings.create(model="text-embedding-3-small", input=batch)
            all_vecs.extend([d.embedding for d in resp.data])

        # Cosine similarity
        import math
        def cosine(a, b):
            dot = sum(x*y for x,y in zip(a,b))
            na = math.sqrt(sum(x*x for x in a))
            nb = math.sqrt(sum(x*x for x in b))
            return dot / (na * nb) if na and nb else 0

        scored = [(cosine(jd_vec, v), i) for i, v in enumerate(all_vecs)]
        scored.sort(reverse=True)
        top_indices = set(idx for _, idx in scored[:top_k])
        return [c for i, c in enumerate(candidates) if i in top_indices]
    except Exception:
        return candidates  # Fallback: no filtering


@router.post("/score")
async def score_candidates(body: ScoreRequest):
    api_key = body.api_key or OPENAI_API_KEY
    candidates = body.candidates
    job_description = body.job_description

    # Concurrency: 10 at a time (OpenAI rate limit safe)
    BATCH_SIZE = 10
    TOP_K = body.top_k or 100

    async def generate():
        # Pre-filter with embeddings if > TOP_K candidates
        filtered = candidates
        if len(candidates) > TOP_K:
            yield f"data: {json.dumps({'type': 'log', 'index': 0, 'name': 'System', 'step': 'filter', 'detail': f'Pre-filtering {len(candidates)} candidates to top {TOP_K} using embeddings...'})}\n\n"
            filtered = await _embedding_prefilter(candidates, job_description, api_key, TOP_K, body.ideal_candidate)
            yield f"data: {json.dumps({'type': 'log', 'index': 0, 'name': 'System', 'step': 'filter', 'detail': f'Shortlisted {len(filtered)} candidates for GPT scoring'})}\n\n"

        yield f"data: {json.dumps({'type': 'start', 'total': len(filtered), 'prefiltered_from': len(candidates)})}\n\n"

        # Load LinkedIn DB
        linkedin_db, photo_db, name_db = _load_linkedin_db()
        yield f"data: {json.dumps({'type': 'enriched', 'ready': True})}\n\n"

        scored_count = 0
        for i in range(0, len(filtered), BATCH_SIZE):
            batch = filtered[i:min(i + BATCH_SIZE, len(filtered))]
            tasks = [_score_one(c, i + bi, job_description, linkedin_db, photo_db, name_db, api_key) for bi, c in enumerate(batch)]

            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, str):
                    yield r
                    scored_count += 1

            # Keepalive ping between batches
            yield f"data: {json.dumps({'type': 'ping', 'scored': scored_count})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'total_scored': scored_count})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


async def _score_one(c: dict, idx: int, job_description: str, linkedin_db: dict, photo_db: dict, name_db: dict, api_key: str) -> str:
    events = []
    name = c.get("name", f"Candidate {idx}")

    def ev(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    # Parse — extract key evidence from CSV fields
    full_text = c.get("fullText", "")
    field_count = len(full_text.split("\n"))
    events.append(ev({"type": "log", "index": idx, "name": name, "step": "parse", "detail": f"{field_count} fields extracted from CSV"}))

    # Collect evidence from the raw CSV data
    evidence = {}
    for line in full_text.split("\n"):
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip().lower()
            val = val.strip()[:200]
            if not val or val in ("null", "[]", "{}"): continue
            # Pick out the important fields
            if any(k in key for k in ["experience", "years", "total_years"]): evidence["experience"] = val
            elif any(k in key for k in ["industries", "industry"]): evidence["industries"] = val
            elif any(k in key for k in ["departments_sold", "departments"]): evidence["departments"] = val
            elif any(k in key for k in ["buyer_persona"]): evidence["buyers"] = val
            elif any(k in key for k in ["sales_focus", "focus"]): evidence["focus"] = val
            elif any(k in key for k in ["ranking_within", "ranking"]): evidence["ranking"] = val
            elif any(k in key for k in ["sdr_grade"]) and "reasoning" not in key: evidence["sdr_grade"] = val
            elif any(k in key for k in ["ae_grade"]) and "reasoning" not in key: evidence["ae_grade"] = val
            elif any(k in key for k in ["current_location", "location"]): evidence["location"] = val
            elif any(k in key for k in ["job_title", "title", "headline"]): evidence["title"] = val
            elif any(k in key for k in ["company_experience", "company"]): evidence["companies"] = val
            elif any(k in key for k in ["products_sold"]): evidence["products"] = val

    candidate_text = full_text[:3000]
    enriched = False

    # Enrich + find photo + resolve name
    linkedin_url = (c.get("linkedinUrl") or "").rstrip("/").lower()
    photo_url = photo_db.get(linkedin_url, "")
    # Update name from DB if we have a better one
    if linkedin_url and name_db.get(linkedin_url):
        name = name_db[linkedin_url]
    if linkedin_url and linkedin_url in linkedin_db:
        candidate_text = candidate_text[:2200] + linkedin_db[linkedin_url]
        evidence["linkedin_enriched"] = "true"
        enriched = True
        events.append(ev({"type": "log", "index": idx, "name": name, "step": "enrich", "detail": f"LinkedIn profile found — {name}"}))
    elif not linkedin_url:
        name_lower = name.lower()
        for url, data in linkedin_db.items():
            if name_lower.replace(" ", "") in url or name_lower.split(" ")[0] in url:
                candidate_text = candidate_text[:2200] + data
                enriched = True
                if not photo_url: photo_url = photo_db.get(url, "")
                if name_db.get(url): name = name_db[url]
                events.append(ev({"type": "log", "index": idx, "name": name, "step": "enrich", "detail": f"Fuzzy matched — {name}"}))
                break

    events.append(ev({"type": "log", "index": idx, "name": name, "step": "score", "detail": f"Sending {len(candidate_text)} chars to GPT-4o-mini{'(enriched)' if enriched else ''}"}))

    # Score with retry — per-criterion breakdown
    # Extract rubric from job description if present
    rubric_section = ""
    if "SCORING RUBRIC" in job_description:
        rubric_section = job_description[job_description.index("SCORING RUBRIC"):]
        rubric_section = rubric_section[:500]

    prompt = f"""Score this candidate 0-100 for the role. Return ONLY valid JSON.

{{"score":<0-100>,"reasoning":"<2 sentences>","highlights":["<str>"],"gaps":["<str>"],"criteria":[{{"name":"<str>","score":<n>,"max":<n>,"evidence":"<str>"}}]}}

Keep evidence short (under 15 words each). Keep reasoning under 40 words.

{rubric_section if rubric_section else "Criteria: experience(25), industry(20), sales(20), stakeholders(15), culture(10), location(10)."}

ROLE: {job_description[:800]}

CANDIDATE: {candidate_text[:2000]}"""

    import re, openai as openai_lib

    tokens_used = {"prompt": 0, "completion": 0}

    for attempt in range(3):
        try:
            client = openai_lib.AsyncOpenAI(api_key=api_key)
            completion = await client.chat.completions.create(
                model="gpt-4o-mini", max_tokens=500, temperature=0.3,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = completion.choices[0].message.content or ""
            if completion.usage:
                tokens_used["prompt"] = completion.usage.prompt_tokens
                tokens_used["completion"] = completion.usage.completion_tokens

            m = re.search(r'\{[\s\S]*\}', raw)
            if m:
                json_str = m.group(0)
                json_str = re.sub(r',\s*}', '}', json_str)
                json_str = re.sub(r',\s*]', ']', json_str)
                p = json.loads(json_str)
                score = max(0, min(100, round(p.get("score", 0))))

                # Clamp each criterion score to its max weight
                criteria_list = p.get("criteria", [])
                for cr in criteria_list:
                    if cr.get("max") and cr.get("score", 0) > cr["max"]:
                        cr["score"] = cr["max"]

                # Calculate cost (gpt-4o-mini: $0.15/1M input, $0.60/1M output)
                cost = (tokens_used["prompt"] * 0.15 + tokens_used["completion"] * 0.60) / 1_000_000

                events.append(ev({"type": "log", "index": idx, "name": name, "step": "result", "detail": f"Score: {score}/100 | {tokens_used['prompt']+tokens_used['completion']} tokens | ${cost:.4f}"}))
                events.append(ev({"type": "scored", "index": idx, "id": c.get("id", ""), "name": name, "score": score, "reasoning": p.get("reasoning", ""), "highlights": p.get("highlights", []), "gaps": p.get("gaps", []), "photo_url": photo_url, "linkedin_url": linkedin_url or c.get("linkedinUrl", ""), "evidence": evidence, "criteria": criteria_list, "tokens": tokens_used, "cost": round(cost, 6)}))
                return "".join(events)
            else:
                events.append(ev({"type": "scored", "index": idx, "id": c.get("id", ""), "name": name, "score": 0, "reasoning": raw[:200], "highlights": [], "gaps": []}))
                return "".join(events)
        except Exception as e:
            if attempt < 2:
                events.append(ev({"type": "log", "index": idx, "name": name, "step": "retry", "detail": f"Attempt {attempt+1} failed, retrying..."}))
                await asyncio.sleep(1 * (attempt + 1))
            else:
                events.append(ev({"type": "error", "index": idx, "id": c.get("id", ""), "name": name, "error": str(e)[:100]}))
                return "".join(events)

    return "".join(events)


# ── Sessions ──

@router.post("/sessions", status_code=201)
def create_session(body: CreateSessionRequest):
    fields = body.model_dump()
    fields["results"] = [r.model_dump() if hasattr(r, "model_dump") else r for r in fields.get("results", [])]
    if not fields.get("user_id"):
        fields["user_id"] = "anonymous"
    session = db.create_tp_session(fields)
    _log_activity("scored_candidates", {"session_id": session["session_id"], "role": fields.get("role", ""), "candidate_count": fields.get("candidate_count", 0)})
    return session

@router.get("/sessions")
def list_sessions(user_id: Optional[str] = None):
    sessions = db.list_tp_sessions(user_id=user_id)
    return [{"session_id": s["session_id"], "role": s.get("role", ""), "role_category": s.get("role_category", ""), "file_name": s.get("file_name", ""), "candidate_count": s.get("candidate_count", 0), "top_tier": s.get("top_tier", 0), "good_fit": s.get("good_fit", 0), "avg_score": s.get("avg_score", 0), "created_at": s.get("created_at", ""), "user_name": s.get("user_name", ""), "duration": s.get("duration", 0), "cost": s.get("cost", 0), "tokens": s.get("tokens", 0), "judge": s.get("judge", ""), "device": s.get("device", "")} for s in sessions]

@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    return db.get_tp_session(session_id)

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    db.delete_tp_session(session_id)
    return {"detail": "Deleted"}


# ── Roles ──

@router.get("/roles")
def get_roles():
    try:
        item = settings_table.get_item(Key={"setting_id": ROLES_SETTING_ID}).get("Item")
        if item and "roles" in item: return {"roles": item["roles"], "custom": True}
    except Exception: pass
    return {"roles": [], "custom": False}

@router.put("/roles")
def save_roles(body: SaveRolesRequest):
    roles_data = [r.model_dump() for r in body.roles]
    settings_table.put_item(Item={"setting_id": ROLES_SETTING_ID, "roles": roles_data})
    return {"roles": roles_data, "count": len(roles_data)}


# ── Candidates ──

@router.get("/candidates")
def list_candidates():
    try:
        item = settings_table.get_item(Key={"setting_id": CANDIDATES_SETTING_ID}).get("Item", {})
        candidates = item.get("candidates", {})
        result = [{"key": k, "name": d.get("name", ""), "linkedin_url": d.get("linkedin_url", ""), "roles_count": len(d.get("roles", {})), "roles": d.get("roles", {})} for k, d in candidates.items()]
        result.sort(key=lambda x: x.get("name", ""))
        return {"candidates": result, "count": len(result)}
    except Exception:
        return {"candidates": [], "count": 0}

@router.get("/activity")
def get_activity(limit: int = 50):
    try:
        item = settings_table.get_item(Key={"setting_id": ACTIVITY_SETTING_ID}).get("Item", {})
        return {"entries": item.get("entries", [])[:limit]}
    except Exception:
        return {"entries": []}
