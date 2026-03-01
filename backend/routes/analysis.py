"""
AI analysis routes — single applicant review, bulk analysis, and SSE streaming.

POST /applicants/{id}/review          Review one applicant
POST /applicants/analyze-all          Bulk analyze (single LLM call)
POST /applicants/analyze-all-stream   Bulk analyze with SSE progress
"""

import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import AI_FIELDS
from models import ReviewRequest, BulkAnalyzeRequest
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
    applicants = db.scan_all_applicants()
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


# ── SSE streaming bulk analyze ──

_SINGLE_REVIEW_PROMPT = """
{base_prompt}{criteria}

Here is the applicant's information:

{info}

Evaluate this applicant and return ONLY a JSON object with this exact format:
{{"score": <number 1-100>, "status": "accepted" or "waitlisted" or "rejected", "attendee_type": "vc" or "entrepreneur" or "faculty" or "alumni" or "press" or "student" or "other", "reasoning": "brief 1-2 sentence explanation"}}

For attendee_type, classify the applicant into one of these categories based on their background:
- "vc" = venture capitalist, investor, angel investor, partner at a fund
- "entrepreneur" = founder, CEO, startup executive, business owner
- "faculty" = professor, researcher, academic, postdoc
- "alumni" = CS 224G or Stanford alumni
- "press" = journalist, reporter, media, tech press, blogger
- "student" = current student
- "other" = does not fit the above categories

Return ONLY the JSON, no other text.
""".strip()


async def _analyze_one(applicant: dict, body: BulkAnalyzeRequest, semaphore: asyncio.Semaphore) -> dict:
    """Analyze a single applicant (runs under semaphore for concurrency control)."""
    applicant_id = applicant["applicant_id"]
    name = applicant.get("name", "Unknown")

    async with semaphore:
        prompt = _SINGLE_REVIEW_PROMPT.format(
            base_prompt=body.prompt,
            criteria=_criteria_text(body.criteria, body.criteria_weights),
            info=_applicant_info_text(applicant),
        )

        try:
            raw = await call_ai_async(body.provider, body.api_key, body.model, prompt)
            result = parse_json_response(raw)

            fields = {
                "status": result.get("status", "pending"),
                "ai_score": str(result.get("score", 0)),
                "ai_reasoning": result.get("reasoning", ""),
                "attendee_type": result.get("attendee_type", "other"),
            }
            db.update_applicant_fields(applicant_id, fields)

            return {
                "applicant_id": applicant_id,
                "name": name,
                "score": int(result.get("score", 0)),
                "status": fields["status"],
                "reasoning": fields["ai_reasoning"],
                "attendee_type": fields["attendee_type"],
            }

        except json.JSONDecodeError:
            db.update_applicant_fields(applicant_id, {"ai_reasoning": "AI returned invalid response", "ai_score": "0"})
            return {"applicant_id": applicant_id, "name": name, "error": f"Invalid JSON: {raw[:200]}"}
        except Exception as e:
            db.update_applicant_fields(applicant_id, {"ai_reasoning": "Analysis failed", "ai_score": "0"})
            return {"applicant_id": applicant_id, "name": name, "error": str(e)}


@router.post("/analyze-all-stream")
async def analyze_all_stream(body: BulkAnalyzeRequest):
    applicants = db.scan_all_applicants()
    if not applicants:
        raise HTTPException(status_code=400, detail="No applicants to analyze")

    async def event_stream():
        total = len(applicants)
        semaphore = asyncio.Semaphore(10)

        yield f"event: start\ndata: {json.dumps({'total': total})}\n\n"

        completed, errors = 0, 0
        tasks = {asyncio.ensure_future(_analyze_one(a, body, semaphore)): a for a in applicants}

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
