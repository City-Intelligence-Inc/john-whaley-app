"""
AI analysis routes — single applicant review, bulk analysis, and SSE streaming.

POST /applicants/{id}/review          Review one applicant
POST /applicants/analyze-all          Bulk analyze (single LLM call)
POST /applicants/analyze-all-stream   Bulk analyze with SSE progress (2-pass)
"""

import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import AI_FIELDS
from models import ReviewRequest, BulkAnalyzeRequest, SelectionPreferences
from ai import call_ai, call_ai_async, parse_json_response
import db

router = APIRouter(prefix="/applicants", tags=["analysis"])


# ── Prompt builders ──

def _applicant_info_text(applicant: dict) -> str:
    """Format applicant fields as a readable string for the AI prompt."""
    skip = {"applicant_id"} | AI_FIELDS
    return "\n".join(f"- {k}: {v}" for k, v in applicant.items() if k not in skip)


def _criteria_text(criteria: list[str], weights: list[str] | None = None) -> str:
    if not criteria:
        return ""
    if weights:
        pairs = ", ".join(f"{c} ({w})" for c, w in zip(criteria, weights))
        return f"\n\nEvaluation criteria with weights: {pairs}"
    return f"\n\nEvaluation criteria (in order of importance): {', '.join(criteria)}"


# ── Single review ──

@router.post("/{applicant_id}/review")
def review_applicant(applicant_id: str, body: ReviewRequest):
    applicant = db.get_applicant_or_404(applicant_id)

    prompt = body.prompt or (
        "You are reviewing an event applicant. Based on the applicant's "
        "information below, provide a brief assessment of their fit for the event."
    )
    if body.criteria:
        prompt += f"\n\nEvaluate based on these criteria: {', '.join(body.criteria)}"

    full_prompt = (
        f"{prompt}\n\n"
        f"Applicant Information:\n{_applicant_info_text(applicant)}\n\n"
        f"Provide your assessment:"
    )

    try:
        ai_review = call_ai(body.provider, body.api_key, body.model, full_prompt)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {e}")

    return db.update_applicant_fields(applicant_id, {"ai_review": ai_review})


# ── Bulk analyze (single LLM call) ──

@router.post("/analyze-all")
def analyze_all(body: BulkAnalyzeRequest):
    applicants = db.scan_all_applicants(session_id=body.session_id)
    if not applicants:
        raise HTTPException(status_code=400, detail="No applicants to analyze")

    summaries = []
    for a in applicants:
        info = ", ".join(f"{k}: {v}" for k, v in a.items() if k not in {"applicant_id"} | AI_FIELDS)
        summaries.append(f"[ID: {a['applicant_id']}] {info}")

    full_prompt = f"""{body.prompt}{_criteria_text(body.criteria, body.criteria_weights)}

Here are all the applicants:

{chr(10).join(summaries)}

For each applicant, provide a JSON response with this exact format:
{{
  "candidates": [
    {{
      "id": "applicant_id",
      "score": 1-100,
      "status": "accepted" or "waitlisted" or "rejected",
      "reasoning": "brief 1-2 sentence explanation"
    }}
  ]
}}

Rank them by score (highest first). Return ONLY the JSON, no other text."""

    try:
        raw = call_ai(body.provider, body.api_key, body.model, full_prompt, max_tokens=16384)
        result = parse_json_response(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {raw[:500]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {e}")

    for candidate in result.get("candidates", []):
        cid = candidate.get("id")
        if not cid:
            continue
        db.update_applicant_fields(cid, {
            "status": candidate.get("status", "pending"),
            "ai_score": str(candidate.get("score", 0)),
            "ai_reasoning": candidate.get("reasoning", ""),
        })

    return result


# ── SSE streaming 2-pass bulk analyze ──

# Pass 1: Classification only — no scoring or decisions
_CLASSIFY_PROMPT = """
EVENT CONTEXT: CS 224G Demo Day & Poster Session at Stanford (March 19, 2026).
CS 224G is Stanford's course on building LLM-powered applications. The event showcases
student projects to VCs, entrepreneurs, faculty, alumni, press, and other students.

Here is the applicant's information:

{info}

Classify this applicant into ONE attendee type. Return ONLY a JSON object:
{{"attendee_type": "<type>", "attendee_type_detail": "<specific label>", "summary": "<1 sentence: who they are and why they'd attend>"}}

attendee_type must be one of: "vc", "entrepreneur", "faculty", "alumni", "press", "student", "other"

Rules:
- "vc" = VC partner, angel investor, fund manager, investing professional
- "entrepreneur" = Founder, CEO, CTO, startup executive actively running/building a company
- "faculty" = Professor, researcher, academic staff, postdoc at any university
- "alumni" = Stanford or CS 224G alumni NOT primarily a VC/founder/professor now
- "press" = Journalist, reporter, tech media, blogger covering technology
- "student" = Currently enrolled student at any university
- "other" = Everyone else (industry engineers, PMs, designers, consultants, etc.)

Classify by CURRENT primary role (Stanford alum now a VC → "vc").

For attendee_type_detail, use a BROAD role category (not a specific job title):
- Good: "Engineer", "Product Manager", "Designer", "Data Scientist", "Consultant", "Executive", "Ops/DevOps", "Security", "Research Scientist"
- Bad: "Senior Staff Platform Infrastructure Engineer" — too specific, just say "Engineer"
- For non-"other" types: use a short descriptor like "Seed VC", "AI Startup Founder", "CS Professor", "CS 224G Alum", "Tech Reporter", "MS Student"

Return ONLY the JSON, no other text.
""".strip()

# Pass 2: Scoring and decisions — with pool context
_SCORE_PROMPT = """
{base_prompt}{criteria}

EVENT CONTEXT: CS 224G Demo Day & Poster Session at Stanford (March 19, 2026).
CS 224G is Stanford's course on building LLM-powered applications.
{selection_context}
APPLICANT POOL CONTEXT — here is the current distribution of all {total} applicants:
{pool_summary}

You are now scoring this specific applicant:

{info}

This person was classified as: {attendee_type} ({attendee_type_detail})

Score this applicant relative to the FULL POOL. Consider:
1. How relevant is this person to a demo day showcasing LLM-powered student projects?
2. How much value would they add as an attendee (networking, feedback, investment, press coverage)?
3. Given the pool distribution, do we need more people like them?

Return ONLY a JSON object:
{{"score": <1-100>, "status": "accepted" or "waitlisted" or "rejected", "reasoning": "<2-3 sentences: who they are, why this score, and how they compare to others in the pool>"}}

Scoring guidelines:
- 80-100: Highly relevant — would significantly benefit from or contribute to the event
- 60-79: Moderately relevant — reasonable fit, put on waitlist unless category is underrepresented
- 40-59: Low relevance — tangential connection to LLM/AI, likely reject unless we need diversity
- 1-39: Not relevant — no clear connection to the event's purpose

Return ONLY the JSON, no other text.
""".strip()


def _selection_context(prefs: SelectionPreferences | None) -> str:
    """Build prompt text from selection preferences."""
    if not prefs:
        return ""
    parts: list[str] = []
    if prefs.venue_capacity:
        parts.append(f"VENUE CAPACITY: The venue can hold {prefs.venue_capacity} attendees. Be more selective to stay within this limit.")
    if prefs.attendee_mix:
        type_labels = {
            "vc": "VCs / Investors", "entrepreneur": "Founders / Entrepreneurs",
            "faculty": "Faculty / Researchers", "alumni": "Stanford Alumni",
            "press": "Press / Media", "student": "Students", "other": "Other",
        }
        mix_lines = [f"  - {type_labels.get(k, k)}: {v}%" for k, v in prefs.attendee_mix.items() if v > 0]
        if mix_lines:
            parts.append("TARGET ATTENDEE MIX:\n" + "\n".join(mix_lines))
    relevance_desc = {
        "strict": "RELEVANCE FILTER: STRICT — Only accept applicants with direct, clear relevance to AI/LLM/the event topic. Reject tangential connections.",
        "moderate": "RELEVANCE FILTER: MODERATE — Accept applicants with reasonable relevance. Some tangential connections are OK if the person brings other value.",
        "loose": "RELEVANCE FILTER: LOOSE — Accept most applicants who show any interest or connection. Only reject clearly irrelevant applications.",
        "none": "RELEVANCE FILTER: NONE — Do not filter by relevance. Score purely on other factors.",
    }
    if prefs.relevance_filter in relevance_desc:
        parts.append(relevance_desc[prefs.relevance_filter])
    if prefs.custom_priorities.strip():
        parts.append(f"ORGANIZER PRIORITIES: {prefs.custom_priorities.strip()}")
    if not parts:
        return ""
    return "\nSELECTION CRITERIA:\n" + "\n\n".join(parts) + "\n"


async def _classify_one(applicant: dict, body: BulkAnalyzeRequest, semaphore: asyncio.Semaphore) -> dict:
    """Pass 1: Classify a single applicant (type only, no scoring)."""
    applicant_id = applicant["applicant_id"]
    name = applicant.get("name", "Unknown")

    async with semaphore:
        prompt = _CLASSIFY_PROMPT.format(info=_applicant_info_text(applicant))

        try:
            raw = await call_ai_async(body.provider, body.api_key, body.model, prompt)
            result = parse_json_response(raw)

            fields = {
                "attendee_type": result.get("attendee_type", "other"),
                "attendee_type_detail": result.get("attendee_type_detail", ""),
            }
            db.update_applicant_fields(applicant_id, fields)

            return {
                "applicant_id": applicant_id,
                "name": name,
                "attendee_type": fields["attendee_type"],
                "attendee_type_detail": fields["attendee_type_detail"],
                "summary": result.get("summary", ""),
            }

        except json.JSONDecodeError:
            return {"applicant_id": applicant_id, "name": name, "error": f"Invalid JSON: {raw[:200]}"}
        except Exception as e:
            return {"applicant_id": applicant_id, "name": name, "error": str(e)}


async def _score_one(applicant: dict, body: BulkAnalyzeRequest, pool_summary: str, total: int, semaphore: asyncio.Semaphore) -> dict:
    """Pass 2: Score and decide on a single applicant (with pool context)."""
    applicant_id = applicant["applicant_id"]
    name = applicant.get("name", "Unknown")
    attendee_type = applicant.get("attendee_type", "other")
    attendee_type_detail = applicant.get("attendee_type_detail", "")

    async with semaphore:
        prompt = _SCORE_PROMPT.format(
            base_prompt=body.prompt,
            criteria=_criteria_text(body.criteria, body.criteria_weights),
            selection_context=_selection_context(body.selection_preferences),
            total=total,
            pool_summary=pool_summary,
            info=_applicant_info_text(applicant),
            attendee_type=attendee_type,
            attendee_type_detail=attendee_type_detail,
        )

        try:
            raw = await call_ai_async(body.provider, body.api_key, body.model, prompt)
            result = parse_json_response(raw)

            fields = {
                "status": result.get("status", "pending"),
                "ai_score": str(result.get("score", 0)),
                "ai_reasoning": result.get("reasoning", ""),
            }
            db.update_applicant_fields(applicant_id, fields)

            return {
                "applicant_id": applicant_id,
                "name": name,
                "score": int(result.get("score", 0)),
                "status": fields["status"],
                "reasoning": fields["ai_reasoning"],
                "attendee_type": attendee_type,
                "attendee_type_detail": attendee_type_detail,
            }

        except json.JSONDecodeError:
            db.update_applicant_fields(applicant_id, {"ai_reasoning": "AI returned invalid response", "ai_score": "0"})
            return {"applicant_id": applicant_id, "name": name, "error": f"Invalid JSON: {raw[:200]}"}
        except Exception as e:
            db.update_applicant_fields(applicant_id, {"ai_reasoning": "Analysis failed", "ai_score": "0"})
            return {"applicant_id": applicant_id, "name": name, "error": str(e)}


def _build_pool_summary(type_counts: dict[str, int], total: int) -> str:
    """Build a text summary of the applicant pool distribution."""
    type_labels = {
        "vc": "VCs / Investors",
        "entrepreneur": "Founders / Entrepreneurs",
        "faculty": "Faculty / Researchers",
        "alumni": "Stanford Alumni",
        "press": "Press / Media",
        "student": "Students",
        "other": "Other (Industry professionals)",
    }
    lines = []
    for key, label in type_labels.items():
        count = type_counts.get(key, 0)
        pct = round(count / total * 100) if total > 0 else 0
        lines.append(f"- {label}: {count} ({pct}%)")
    return "\n".join(lines)


@router.post("/analyze-all-stream")
async def analyze_all_stream(body: BulkAnalyzeRequest):
    applicants = db.scan_all_applicants(session_id=body.session_id)
    if not applicants:
        raise HTTPException(status_code=400, detail="No applicants to analyze")

    async def event_stream():
        total = len(applicants)
        semaphore = asyncio.Semaphore(10)

        yield f"event: start\ndata: {json.dumps({'total': total})}\n\n"

        # ── PASS 1: Classification ──
        yield f"event: phase\ndata: {json.dumps({'phase': 'classify', 'message': 'Pass 1: Classifying all applicants...'})}\n\n"

        completed, errors = 0, 0
        type_counts: dict[str, int] = {}
        classified: dict[str, dict] = {}  # applicant_id → classification result

        tasks = {asyncio.ensure_future(_classify_one(a, body, semaphore)): a for a in applicants}

        for coro in asyncio.as_completed(tasks.keys()):
            result = await coro
            completed += 1

            if "error" in result:
                errors += 1
                yield f"event: classify_error\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"
            else:
                t = result.get("attendee_type", "other")
                type_counts[t] = type_counts.get(t, 0) + 1
                classified[result["applicant_id"]] = result
                yield f"event: classify\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"

        # Emit pool summary after classification
        pool_summary = _build_pool_summary(type_counts, total)
        yield f"event: phase\ndata: {json.dumps({'phase': 'pool_summary', 'message': 'Classification complete. Pool distribution:', 'type_counts': type_counts, 'total': total})}\n\n"

        # ── AUTO-ACCEPT PHASE ──
        auto_accept_types = []
        if body.selection_preferences and body.selection_preferences.auto_accept_types:
            auto_accept_types = body.selection_preferences.auto_accept_types

        auto_accepted_ids: set[str] = set()
        if auto_accept_types:
            aa_msg = f"Auto-accepting: {', '.join(auto_accept_types)}..."
            yield f"event: phase\ndata: {json.dumps({'phase': 'auto_accept', 'message': aa_msg})}\n\n"
            for aid, info in classified.items():
                if info.get("attendee_type") in auto_accept_types:
                    auto_accepted_ids.add(aid)
                    db.update_applicant_fields(aid, {
                        "status": "accepted",
                        "ai_score": "100",
                        "ai_reasoning": f"Auto-accepted ({info.get('attendee_type')})",
                    })
                    yield f"event: auto_accept\ndata: {json.dumps({'applicant_id': aid, 'name': info.get('name', 'Unknown'), 'attendee_type': info.get('attendee_type', ''), 'attendee_type_detail': info.get('attendee_type_detail', '')})}\n\n"

        # ── PASS 2: Scoring & Decisions ──
        yield f"event: phase\ndata: {json.dumps({'phase': 'score', 'message': 'Pass 2: Scoring and making decisions with full pool context...'})}\n\n"

        # Re-fetch applicants to get updated type fields, exclude auto-accepted
        applicants_refreshed = [
            a for a in db.scan_all_applicants(session_id=body.session_id)
            if a["applicant_id"] not in auto_accepted_ids
        ]
        scoring_total = len(applicants_refreshed)

        completed, errors = 0, 0
        tasks = {asyncio.ensure_future(_score_one(a, body, pool_summary, total, semaphore)): a for a in applicants_refreshed}

        for coro in asyncio.as_completed(tasks.keys()):
            result = await coro
            completed += 1

            if "error" in result:
                errors += 1
                yield f"event: error\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"
            else:
                yield f"event: progress\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"

        yield f"event: complete\ndata: {json.dumps({'completed': completed, 'total': total, 'errors': errors})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
