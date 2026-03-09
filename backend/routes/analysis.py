"""
AI analysis routes — single applicant review, bulk analysis, and SSE streaming.

POST /applicants/{id}/review          Review one applicant
POST /applicants/analyze-all          Bulk analyze (single LLM call)
POST /applicants/analyze-all-stream   Bulk analyze with SSE progress (2-pass)
"""

import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import AI_FIELDS, get_applicant_name
from models import ReviewRequest, BulkAnalyzeRequest, EnrichRequest, SelectRequest, ReallocateRequest, SelectionPreferences
from ai import call_ai, call_ai_async, parse_json_response
from judge_personas import JUDGE_PERSONAS_BY_ID
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

    # Persist analysis config on the session before LLM runs
    if body.session_id:
        analysis_config: dict = {
            "last_analysis_model": body.model,
            "last_analysis_provider": body.provider,
            "last_analysis_prompt": body.prompt,
            "last_analysis_criteria": body.criteria,
        }
        if body.selection_preferences:
            analysis_config["selection_preferences"] = body.selection_preferences.model_dump()
        if body.panel_config:
            analysis_config["panel_config"] = body.panel_config.model_dump()
        try:
            db.update_session_fields(body.session_id, analysis_config)
        except Exception:
            pass

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
{event_context}

Here is the applicant's information:

{info}

Classify this applicant into ONE attendee type. Return ONLY a JSON object:
{{"attendee_type": "<type>", "attendee_type_detail": "<specific label>", "investor_level": "<level or null>", "investor_professional": <true/false or null>, "summary": "<1 sentence: who they are and why they'd attend>"}}

attendee_type must be one of: "vc", "entrepreneur", "faculty", "alumni", "press", "student", "other"

Rules:
- "vc" = Their PRIMARY current role is investing. They work at a VC firm, PE firm, family office, or are a professional angel investor. NOT someone whose day job is engineering/product/etc. who made a few angel investments on the side.
- "entrepreneur" = Founder, CEO, CTO, startup executive actively running/building a company
- "faculty" = Professor, researcher, academic staff, postdoc at any university
- "alumni" = Alumni NOT primarily a VC/founder/professor now
- "press" = Journalist, reporter, tech media, blogger covering technology
- "student" = Currently enrolled student at any university
- "other" = Everyone else (industry engineers, PMs, designers, consultants, etc.)

INVESTOR CLASSIFICATION (only when attendee_type is "vc"):
- investor_level: one of "intern", "analyst", "associate", "senior_associate", "vp", "principal", "partner", "managing_partner", "gp", "angel", "unknown"
- investor_professional: true if investing is their PRIMARY occupation (they work at a fund or invest full-time), false if they dabble (engineer/founder who occasionally angel invests)

Title hierarchy (lowest to highest seniority):
  intern < analyst < associate < senior_associate < vp < principal < partner < managing_partner/gp

IMPORTANT distinctions:
- Someone who lists "angel investor" but primarily works as an engineer/founder → attendee_type "other" or "entrepreneur", NOT "vc"
- An investment associate is entry-level (like an intern). A partner makes real decisions.
- "Investor at X" could be any level — look at actual title and context clues.

For non-vc types, set investor_level and investor_professional to null.

Classify by CURRENT primary role (alum now a VC → "vc").

For attendee_type_detail:
- For "vc": use format "<level> at <firm>" or "Angel Investor" or "Fund Manager". E.g. "Partner at Sequoia", "Associate at Zeal Capital"
- For other types: use a BROAD role category. Good: "Engineer", "AI Startup Founder", "CS Professor". Bad: "Senior Staff Platform Infrastructure Engineer" — too specific.

Return ONLY the JSON, no other text.
""".strip()

# Pass 2: Scoring and decisions — with pool context
_SCORE_PROMPT = """
{base_prompt}{criteria}

{event_context}
{selection_context}
APPLICANT POOL CONTEXT — here is the current distribution of all {total} applicants:
{pool_summary}

You are now scoring this specific applicant:

{info}

This person was classified as: {attendee_type} ({attendee_type_detail})
{investor_context}
Score this applicant relative to the FULL POOL. Consider:
1. How relevant is this person to the event?
2. How much value would they add as an attendee (networking, feedback, investment, press coverage)?
3. Given the pool distribution, do we need more people like them?

Return ONLY a JSON object:
{{"score": <1-100>, "status": "accepted" or "waitlisted" or "rejected", "reasoning": "<2-3 sentences: who they are, why this score, and how they compare to others in the pool>"}}

Scoring guidelines — be generous, this is a networking event and most interested professionals add value:
- 80-100: Strong fit — directly relevant expertise (AI/ML/NLP) or high-value role (VC, founder, press, faculty). ACCEPT.
- 60-79: Good fit — technical professional who would benefit from and contribute to the event. ACCEPT unless pool is full.
- 40-59: Moderate fit — tangential relevance but genuine interest. WAITLIST — may accept if space allows.
- 20-39: Weak fit — minimal connection to event theme. REJECT.
- 1-19: No fit — clearly irrelevant. REJECT.

IMPORTANT: Default toward acceptance. Most tech professionals who apply to an AI event are interested and will contribute.
Only reject applicants who truly have no connection to the event. When in doubt, waitlist rather than reject.

Return ONLY the JSON, no other text.
""".strip()

# Pass 3: Overall summary prompt
_SUMMARY_PROMPT = """
You just finished reviewing {total} applicants for an event.

Here are the results:
- {accepted} accepted{auto_accepted_note}
- {waitlisted} waitlisted
- {rejected} rejected
- {errors} errors

Pool breakdown:
{pool_summary}

{selection_context}

Write a brief overall summary (3-5 sentences) explaining:
1. The overall quality and composition of the applicant pool
2. Key patterns in who was accepted vs rejected
3. Any recommendations for the organizer (e.g. gaps to fill, waitlist candidates to promote)

Return ONLY a JSON object:
{{"summary": "<your 3-5 sentence summary>"}}
""".strip()


# ── Judge Panel Prompt ──
_JUDGE_SCORE_PROMPT = """
You are {judge_name} ({judge_emoji}), a judge on an admissions panel for an event.
Your specialty: {judge_specialty}

YOUR PERSPECTIVE AND BIAS:
{judge_bias}

SCORING ADJUSTMENTS:
{judge_scoring_modifiers}

You have been allocated {seats_allocated} seats to fill from this pool. Choose wisely — pick the applicants who best match YOUR perspective.

{base_prompt}{criteria}

{event_context}
{selection_context}
APPLICANT POOL CONTEXT — {total} applicants total:
{pool_summary}

You are now evaluating this specific applicant:

{info}

This person was classified as: {attendee_type} ({attendee_type_detail})

Score this applicant through YOUR unique lens. Return ONLY a JSON object:
{{"score": <1-100>, "decision": "accept" or "pass", "reasoning": "<1-2 sentences from YOUR perspective explaining your decision>"}}

Scoring guidelines — apply YOUR bias aggressively:
- 80-100: Perfect fit for YOUR priorities. You WANT this person in YOUR seats.
- 60-79: Good fit for YOUR priorities. You'd accept them if you have room.
- 40-59: Neutral — doesn't excite you but doesn't offend you either.
- 20-39: Poor fit for YOUR lens. You'd rather save seats for better matches.
- 1-19: Completely outside YOUR interests.

Your "decision" should be "accept" if you want to use one of your {seats_allocated} seats on this person, or "pass" if not. Be selective — you have limited seats!

Return ONLY the JSON, no other text.
""".strip()


async def _judge_score_one(
    applicant: dict,
    body: BulkAnalyzeRequest,
    judge: dict,
    seats_allocated: int,
    pool_summary: str,
    total: int,
    semaphore: asyncio.Semaphore,
    temperature: float | None = None,
) -> dict:
    """Score a single applicant through a judge's lens."""
    applicant_id = applicant["applicant_id"]
    name = get_applicant_name(applicant)
    attendee_type = applicant.get("attendee_type", "other")
    attendee_type_detail = applicant.get("attendee_type_detail", "")

    async with semaphore:
        prompt = _JUDGE_SCORE_PROMPT.format(
            judge_name=judge["name"],
            judge_emoji=judge["emoji"],
            judge_specialty=judge["specialty"],
            judge_bias=judge["bias"],
            judge_scoring_modifiers=judge["scoring_modifiers"],
            seats_allocated=seats_allocated,
            base_prompt=body.prompt,
            criteria=_criteria_text(body.criteria, body.criteria_weights),
            event_context=f"EVENT CONTEXT: {body.prompt}" if body.prompt else "",
            selection_context=_selection_context(body.selection_preferences),
            total=total,
            pool_summary=pool_summary,
            info=_applicant_info_text(applicant),
            attendee_type=attendee_type,
            attendee_type_detail=attendee_type_detail,
        )

        try:
            raw = await call_ai_async(body.provider, body.api_key, body.model, prompt, temperature=temperature)
            result = parse_json_response(raw)
            return {
                "applicant_id": applicant_id,
                "name": name,
                "score": int(result.get("score", 0)),
                "decision": result.get("decision", "pass"),
                "reasoning": result.get("reasoning", ""),
                "attendee_type": attendee_type,
                "attendee_type_detail": attendee_type_detail,
            }
        except Exception as e:
            return {
                "applicant_id": applicant_id,
                "name": name,
                "score": 0,
                "decision": "pass",
                "reasoning": "",
                "error": str(e),
            }


def _allocate_seats(
    judges: list[dict],
    total_applicants: int,
    venue_capacity: int | None,
    attendee_mix: dict[str, int] | None,
) -> dict[str, int]:
    """Allocate seats to each judge based on venue capacity and attendee mix weights."""
    total_seats = venue_capacity or total_applicants

    if attendee_mix:
        # Weight judges by the sum of mix % for their preferred types
        weights = {}
        for j in judges:
            w = sum(attendee_mix.get(t, 0) for t in j.get("preferred_types", []))
            weights[j["id"]] = max(w, 1)  # minimum weight of 1
        total_weight = sum(weights.values())
        allocation = {}
        for j in judges:
            raw = (weights[j["id"]] / total_weight) * total_seats
            allocation[j["id"]] = max(1, round(raw))
        return allocation
    else:
        # Equal distribution
        per_judge = max(1, round(total_seats / len(judges)))
        return {j["id"]: per_judge for j in judges}


def _selection_context(prefs: SelectionPreferences | None) -> str:
    """Build prompt text from selection preferences."""
    if not prefs:
        return ""
    parts: list[str] = []
    if prefs.venue_capacity:
        parts.append(f"VENUE CAPACITY: The venue can hold {prefs.venue_capacity} attendees. Aim to accept roughly this many people. Only reject truly poor fits.")
    if prefs.attendee_mix:
        type_labels = {
            "vc": "VCs / Investors", "entrepreneur": "Founders / Entrepreneurs",
            "faculty": "Faculty / Researchers", "alumni": "Alumni",
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
    name = get_applicant_name(applicant)

    # Respect user overrides — don't re-classify
    if applicant.get("user_override_attendee_type"):
        return {
            "applicant_id": applicant_id,
            "name": name,
            "attendee_type": applicant.get("attendee_type", "other"),
            "attendee_type_detail": applicant.get("attendee_type_detail", ""),
            "summary": "User-classified (override)",
            "skipped": True,
        }

    async with semaphore:
        prompt = _CLASSIFY_PROMPT.format(
            event_context=f"EVENT CONTEXT: {body.prompt}" if body.prompt else "",
            info=_applicant_info_text(applicant),
        )

        try:
            raw = await call_ai_async(body.provider, body.api_key, body.model, prompt)
            result = parse_json_response(raw)

            fields = {
                "attendee_type": result.get("attendee_type", "other"),
                "attendee_type_detail": result.get("attendee_type_detail", ""),
            }
            # Store investor-specific fields if present
            if result.get("investor_level"):
                fields["investor_level"] = result["investor_level"]
            if result.get("investor_professional") is not None:
                fields["investor_professional"] = result["investor_professional"]

            db.update_applicant_fields(applicant_id, fields)

            return {
                "applicant_id": applicant_id,
                "name": name,
                "attendee_type": fields["attendee_type"],
                "attendee_type_detail": fields["attendee_type_detail"],
                "investor_level": fields.get("investor_level"),
                "investor_professional": fields.get("investor_professional"),
                "summary": result.get("summary", ""),
            }

        except json.JSONDecodeError:
            return {"applicant_id": applicant_id, "name": name, "error": f"Invalid JSON: {raw[:200]}"}
        except Exception as e:
            return {"applicant_id": applicant_id, "name": name, "error": str(e)}


async def _score_one(applicant: dict, body: BulkAnalyzeRequest, pool_summary: str, total: int, semaphore: asyncio.Semaphore) -> dict:
    """Pass 2: Score and decide on a single applicant (with pool context)."""
    applicant_id = applicant["applicant_id"]
    name = get_applicant_name(applicant)
    attendee_type = applicant.get("attendee_type", "other")
    attendee_type_detail = applicant.get("attendee_type_detail", "")

    async with semaphore:
        investor_context = ""
        if attendee_type == "vc":
            level = applicant.get("investor_level", "unknown")
            pro = applicant.get("investor_professional", False)
            investor_context = f"Investor level: {level}. Professional investor: {'Yes' if pro else 'No (occasional/dabbler)'}. Note: Partners/GPs are decision-makers (high value). Associates/Analysts are entry-level."

        prompt = _SCORE_PROMPT.format(
            base_prompt=body.prompt,
            criteria=_criteria_text(body.criteria, body.criteria_weights),
            event_context=f"EVENT CONTEXT: {body.prompt}" if body.prompt else "",
            selection_context=_selection_context(body.selection_preferences),
            total=total,
            pool_summary=pool_summary,
            info=_applicant_info_text(applicant),
            attendee_type=attendee_type,
            attendee_type_detail=attendee_type_detail,
            investor_context=investor_context,
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
        "alumni": "Alumni",
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
    all_applicants = db.scan_all_applicants(session_id=body.session_id)
    if not all_applicants:
        raise HTTPException(status_code=400, detail="No applicants to analyze")

    # Split: only analyze pending applicants; pre-decided ones keep their status
    applicants = [a for a in all_applicants if a.get("status") == "pending"]
    pre_decided = [a for a in all_applicants if a.get("status") != "pending"]

    # Persist analysis config on the session before LLM runs
    if body.session_id:
        analysis_config: dict = {
            "last_analysis_model": body.model,
            "last_analysis_provider": body.provider,
            "last_analysis_prompt": body.prompt,
            "last_analysis_criteria": body.criteria,
        }
        if body.selection_preferences:
            analysis_config["selection_preferences"] = body.selection_preferences.model_dump()
        if body.panel_config:
            analysis_config["panel_config"] = body.panel_config.model_dump()
        try:
            db.update_session_fields(body.session_id, analysis_config)
        except Exception:
            pass  # Don't block analysis if session save fails

    async def event_stream():
        total = len(applicants)
        semaphore = asyncio.Semaphore(10)

        yield f"event: start\ndata: {json.dumps({'total': total, 'pre_decided': len(pre_decided)})}\n\n"

        # Emit pre-decided applicants so frontend knows they were skipped
        for a in pre_decided:
            yield f"event: pre_decided\ndata: {json.dumps({'applicant_id': a['applicant_id'], 'name': get_applicant_name(a), 'status': a['status']})}\n\n"

        # ── PASS 1: Classification ──
        yield f"event: phase\ndata: {json.dumps({'phase': 'classify', 'message': 'Pass 1: Classifying all applicants...'})}\n\n"

        completed, errors = 0, 0
        type_counts: dict[str, int] = {}
        classified: dict[str, dict] = {}  # applicant_id → classification result

        # Include pre-decided in type counts for pool context
        for a in pre_decided:
            t = a.get("attendee_type", "other")
            type_counts[t] = type_counts.get(t, 0) + 1

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

        # ── WHITELIST / BLACKLIST PHASE ──
        whitelist_data = db.get_settings("applicant_whitelist") or {}
        blacklist_data = db.get_settings("applicant_blacklist") or {}
        whitelist_emails = set(whitelist_data.get("emails", []))
        blacklist_emails = set(blacklist_data.get("emails", []))

        listed_ids: set[str] = set()
        for a in applicants:
            email = a.get("email", "").strip().lower()
            if email and email in whitelist_emails:
                listed_ids.add(a["applicant_id"])
                db.update_applicant_fields(a["applicant_id"], {"status": "accepted", "ai_score": "100", "ai_reasoning": "Whitelisted"})
                yield f"event: whitelist\ndata: {json.dumps({'applicant_id': a['applicant_id'], 'name': get_applicant_name(a)})}\n\n"
            elif email and email in blacklist_emails:
                listed_ids.add(a["applicant_id"])
                db.update_applicant_fields(a["applicant_id"], {"status": "rejected", "ai_score": "0", "ai_reasoning": "Blacklisted"})
                yield f"event: blacklist\ndata: {json.dumps({'applicant_id': a['applicant_id'], 'name': get_applicant_name(a)})}\n\n"

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

        # Re-fetch applicants to get updated type fields, exclude auto-accepted and listed
        exclude_ids = auto_accepted_ids | listed_ids
        applicants_refreshed = [
            a for a in db.scan_all_applicants(session_id=body.session_id)
            if a["applicant_id"] not in exclude_ids and a.get("status") == "pending"
        ]
        scoring_total = len(applicants_refreshed)
        auto_accepted_count = len(auto_accepted_ids)

        # ── Branch: Panel mode vs Single reviewer ──
        panel = body.panel_config
        if panel and panel.enabled and panel.judge_ids:
            # ── PANEL MODE ──
            judges = [JUDGE_PERSONAS_BY_ID[jid] for jid in panel.judge_ids if jid in JUDGE_PERSONAS_BY_ID]
            if not judges:
                yield f"event: error\ndata: {json.dumps({'error': 'No valid judge personas selected'})}\n\n"
                return

            # Seat allocation
            seat_alloc = _allocate_seats(
                judges,
                scoring_total,
                body.selection_preferences.venue_capacity if body.selection_preferences else None,
                body.selection_preferences.attendee_mix if body.selection_preferences else None,
            )

            yield f"event: phase\ndata: {json.dumps({'phase': 'panel_setup', 'message': f'Judge Panel: {len(judges)} judges, {panel.adjudication_mode} adjudication'})}\n\n"

            for j in judges:
                seats = seat_alloc[j["id"]]
                yield f"event: judge_seats\ndata: {json.dumps({'judge_id': j['id'], 'judge_name': j['name'], 'judge_emoji': j['emoji'], 'seats_allocated': seats, 'specialty': j['specialty']})}\n\n"

            # Track all judge decisions: {applicant_id: [{judge_id, score, decision, reasoning}, ...]}
            all_judge_decisions: dict[str, list[dict]] = {a["applicant_id"]: [] for a in applicants_refreshed}

            for judge_idx, judge in enumerate(judges):
                seats = seat_alloc[judge["id"]]
                yield f"event: judge_start\ndata: {json.dumps({'judge_id': judge['id'], 'judge_name': judge['name'], 'judge_emoji': judge['emoji'], 'judge_index': judge_idx, 'total_judges': len(judges), 'seats_remaining': seats})}\n\n"

                # Score ALL applicants concurrently for this judge
                judge_temp = panel.judge_temperatures.get(judge["id"]) if panel.judge_temperatures else None
                judge_tasks = {
                    asyncio.ensure_future(
                        _judge_score_one(a, body, judge, seats, pool_summary, total, semaphore, temperature=judge_temp)
                    ): a
                    for a in applicants_refreshed
                }

                judge_results = []
                judge_completed = 0
                for coro in asyncio.as_completed(judge_tasks.keys()):
                    result = await coro
                    judge_completed += 1
                    judge_results.append(result)

                    yield f"event: judge_progress\ndata: {json.dumps({'judge_id': judge['id'], 'judge_name': judge['name'], 'judge_emoji': judge['emoji'], 'applicant_id': result['applicant_id'], 'name': result['name'], 'score': result.get('score', 0), 'decision': result.get('decision', 'pass'), 'reasoning': result.get('reasoning', ''), 'seats_filled': 0, 'seats_allocated': seats, 'completed': judge_completed, 'total': scoring_total})}\n\n"

                # Greedy seat filling: sort by score descending, accept top N
                judge_results.sort(key=lambda r: r.get("score", 0), reverse=True)
                seats_filled = 0
                accepted_names = []
                for r in judge_results:
                    if "error" in r:
                        continue
                    if seats_filled < seats and r.get("score", 0) > 0:
                        r["decision"] = "accept"
                        seats_filled += 1
                        accepted_names.append(r["name"])
                    else:
                        r["decision"] = "pass"

                    all_judge_decisions[r["applicant_id"]].append({
                        "judge_id": judge["id"],
                        "judge_name": judge["name"],
                        "judge_emoji": judge["emoji"],
                        "score": r.get("score", 0),
                        "decision": r["decision"],
                        "reasoning": r.get("reasoning", ""),
                    })

                yield f"event: judge_complete\ndata: {json.dumps({'judge_id': judge['id'], 'judge_name': judge['name'], 'judge_emoji': judge['emoji'], 'seats_filled': seats_filled, 'seats_allocated': seats, 'accepted_names': accepted_names})}\n\n"

            # ── Adjudication Phase ──
            yield f"event: phase\ndata: {json.dumps({'phase': 'adjudication', 'message': f'Adjudication ({panel.adjudication_mode} mode): determining final decisions...'})}\n\n"

            result_counts = {"accepted": 0, "waitlisted": 0, "rejected": 0}
            total_judges = len(judges)

            for a in applicants_refreshed:
                aid = a["applicant_id"]
                decisions = all_judge_decisions.get(aid, [])
                accept_count = sum(1 for d in decisions if d["decision"] == "accept")
                votes_total = len(decisions)

                if panel.adjudication_mode == "majority":
                    final_status = "accepted" if accept_count > votes_total / 2 else "waitlisted"
                else:  # union
                    final_status = "accepted" if accept_count > 0 else "waitlisted"

                result_counts[final_status] += 1

                # Compute average score across judges
                scores = [d["score"] for d in decisions if d["score"] > 0]
                avg_score = round(sum(scores) / len(scores)) if scores else 0

                # Build combined reasoning with judge attribution
                reasoning_parts = []
                for d in decisions:
                    tag = "ACCEPT" if d["decision"] == "accept" else "PASS"
                    reasoning_parts.append(f"{d['judge_emoji']} {d['judge_name']} [{tag}, {d['score']}]: {d['reasoning']}")
                combined_reasoning = " | ".join(reasoning_parts)

                accepting_judges_list = [
                    f"{d['judge_emoji']} {d['judge_name']}"
                    for d in decisions if d["decision"] == "accept"
                ]

                db.update_applicant_fields(aid, {
                    "status": final_status,
                    "ai_score": str(avg_score),
                    "ai_reasoning": combined_reasoning,
                    "panel_votes": f"{accept_count}/{votes_total}",
                    "accepting_judges": ", ".join(accepting_judges_list) if accepting_judges_list else "",
                })

                yield f"event: adjudication\ndata: {json.dumps({'applicant_id': aid, 'name': a.get('name', 'Unknown'), 'final_status': final_status, 'votes_accept': accept_count, 'votes_total': votes_total, 'accepting_judges': accepting_judges_list, 'avg_score': avg_score})}\n\n"

            yield f"event: complete\ndata: {json.dumps({'completed': scoring_total, 'total': scoring_total, 'errors': 0})}\n\n"

            # Panel summary
            try:
                auto_note = f" ({auto_accepted_count} auto-accepted)" if auto_accepted_count > 0 else ""
                panel_breakdown = "\n".join(
                    f"- {j['emoji']} {j['name']}: {seat_alloc[j['id']]} seats"
                    for j in judges
                )
                summary_prompt = _SUMMARY_PROMPT.format(
                    total=total,
                    accepted=result_counts["accepted"] + auto_accepted_count,
                    auto_accepted_note=auto_note,
                    waitlisted=result_counts["waitlisted"],
                    rejected=result_counts["rejected"],
                    errors=0,
                    pool_summary=pool_summary,
                    selection_context=_selection_context(body.selection_preferences) + f"\nJUDGE PANEL ({panel.adjudication_mode} mode):\n{panel_breakdown}\n",
                )
                raw_summary = await call_ai_async(body.provider, body.api_key, body.model, summary_prompt)
                summary_result = parse_json_response(raw_summary)
                summary_text = summary_result.get("summary", "")
                if summary_text:
                    yield f"event: summary\ndata: {json.dumps({'summary': summary_text})}\n\n"
            except Exception:
                summary_text = ""

            # Save results snapshot to session
            if body.session_id:
                snapshot = {
                    "last_analysis_at": datetime.now(timezone.utc).isoformat(),
                    "last_analysis_results": {
                        "total": total,
                        "accepted": result_counts["accepted"] + auto_accepted_count,
                        "auto_accepted": auto_accepted_count,
                        "waitlisted": result_counts["waitlisted"],
                        "rejected": result_counts["rejected"],
                        "errors": 0,
                    },
                    "last_analysis_summary": summary_text,
                    "last_analysis_type_counts": dict(type_counts),
                }
                try:
                    db.update_session_fields(body.session_id, snapshot)
                except Exception:
                    pass

        else:
            # ── SINGLE REVIEWER MODE (existing behavior) ──
            yield f"event: phase\ndata: {json.dumps({'phase': 'score', 'message': 'Pass 2: Scoring and making decisions with full pool context...'})}\n\n"

            completed, errors = 0, 0
            result_counts = {"accepted": 0, "waitlisted": 0, "rejected": 0}
            tasks = {asyncio.ensure_future(_score_one(a, body, pool_summary, total, semaphore)): a for a in applicants_refreshed}

            for coro in asyncio.as_completed(tasks.keys()):
                result = await coro
                completed += 1

                if "error" in result:
                    errors += 1
                    yield f"event: error\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"
                else:
                    status = result.get("status", "pending")
                    if status in result_counts:
                        result_counts[status] += 1
                    yield f"event: progress\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"

            yield f"event: complete\ndata: {json.dumps({'completed': completed, 'total': total, 'errors': errors})}\n\n"

            # ── PASS 3: Overall Summary ──
            try:
                auto_note = f" ({auto_accepted_count} auto-accepted)" if auto_accepted_count > 0 else ""
                summary_prompt = _SUMMARY_PROMPT.format(
                    total=total,
                    accepted=result_counts["accepted"] + auto_accepted_count,
                    auto_accepted_note=auto_note,
                    waitlisted=result_counts["waitlisted"],
                    rejected=result_counts["rejected"],
                    errors=errors,
                    pool_summary=pool_summary,
                    selection_context=_selection_context(body.selection_preferences),
                )
                raw_summary = await call_ai_async(body.provider, body.api_key, body.model, summary_prompt)
                summary_result = parse_json_response(raw_summary)
                summary_text = summary_result.get("summary", "")
                if summary_text:
                    yield f"event: summary\ndata: {json.dumps({'summary': summary_text})}\n\n"
            except Exception:
                summary_text = ""

            # Save results snapshot to session
            if body.session_id:
                snapshot = {
                    "last_analysis_at": datetime.now(timezone.utc).isoformat(),
                    "last_analysis_results": {
                        "total": total,
                        "accepted": result_counts["accepted"] + auto_accepted_count,
                        "auto_accepted": auto_accepted_count,
                        "waitlisted": result_counts["waitlisted"],
                        "rejected": result_counts["rejected"],
                        "errors": errors,
                    },
                    "last_analysis_summary": summary_text,
                    "last_analysis_type_counts": dict(type_counts),
                }
                try:
                    db.update_session_fields(body.session_id, snapshot)
                except Exception:
                    pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Enrich-only endpoint (classification, no scoring) ──

@router.post("/enrich-stream")
async def enrich_stream(body: EnrichRequest):
    all_applicants = db.scan_all_applicants(session_id=body.session_id)
    if not all_applicants:
        raise HTTPException(status_code=400, detail="No applicants to enrich")

    # Skip applicants with user overrides on attendee_type
    applicants = [a for a in all_applicants if not a.get("user_override_attendee_type")]
    skipped = [a for a in all_applicants if a.get("user_override_attendee_type")]

    # Build a fake BulkAnalyzeRequest for _classify_one compatibility
    classify_body = BulkAnalyzeRequest(
        api_key=body.api_key, model=body.model, provider=body.provider,
        prompt=body.prompt or "", session_id=body.session_id,
    )

    async def event_stream():
        total = len(applicants)
        semaphore = asyncio.Semaphore(10)

        yield f"event: start\ndata: {json.dumps({'total': total, 'skipped': len(skipped)})}\n\n"

        for a in skipped:
            yield f"event: classify\ndata: {json.dumps({'applicant_id': a['applicant_id'], 'name': get_applicant_name(a), 'attendee_type': a.get('attendee_type', 'other'), 'attendee_type_detail': a.get('attendee_type_detail', ''), 'summary': 'User-classified (override)', 'skipped': True, 'completed': 0, 'total': total, 'errors': 0})}\n\n"

        completed, errors = 0, 0
        type_counts: dict[str, int] = {}
        for a in skipped:
            t = a.get("attendee_type", "other")
            type_counts[t] = type_counts.get(t, 0) + 1

        tasks = {asyncio.ensure_future(_classify_one(a, classify_body, semaphore)): a for a in applicants}

        for coro in asyncio.as_completed(tasks.keys()):
            result = await coro
            completed += 1
            if "error" in result:
                errors += 1
                yield f"event: classify_error\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"
            else:
                t = result.get("attendee_type", "other")
                type_counts[t] = type_counts.get(t, 0) + 1
                yield f"event: classify\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"

        pool_summary = _build_pool_summary(type_counts, total + len(skipped))
        yield f"event: phase\ndata: {json.dumps({'phase': 'pool_summary', 'message': 'Enrichment complete.', 'type_counts': type_counts, 'total': total + len(skipped)})}\n\n"
        yield f"event: complete\ndata: {json.dumps({'completed': completed, 'total': total, 'errors': errors})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Select-only endpoint (scoring, requires prior enrichment) ──

@router.post("/select-stream")
async def select_stream(body: SelectRequest):
    all_applicants = db.scan_all_applicants(session_id=body.session_id)
    if not all_applicants:
        raise HTTPException(status_code=400, detail="No applicants to select")

    pending = [a for a in all_applicants if a.get("status") == "pending"]
    pre_decided = [a for a in all_applicants if a.get("status") != "pending"]

    # Check enrichment: most pending applicants should have attendee_type
    enriched = sum(1 for a in pending if a.get("attendee_type"))
    if pending and enriched < len(pending) * 0.5:
        raise HTTPException(status_code=400, detail="Most applicants are not enriched yet. Run enrichment first.")

    # Build a BulkAnalyzeRequest for compatibility with scoring helpers
    score_body = BulkAnalyzeRequest(
        api_key=body.api_key, model=body.model, provider=body.provider,
        prompt=body.prompt, criteria=body.criteria,
        criteria_weights=body.criteria_weights, session_id=body.session_id,
        selection_preferences=body.selection_preferences, panel_config=body.panel_config,
    )

    async def event_stream():
        total_all = len(all_applicants)
        semaphore = asyncio.Semaphore(10)

        # Build pool summary from ALL applicants
        type_counts: dict[str, int] = {}
        for a in all_applicants:
            t = a.get("attendee_type", "other")
            type_counts[t] = type_counts.get(t, 0) + 1
        pool_summary = _build_pool_summary(type_counts, total_all)

        yield f"event: start\ndata: {json.dumps({'total': len(pending), 'pre_decided': len(pre_decided)})}\n\n"

        # Auto-accept phase
        auto_accept_types = []
        if score_body.selection_preferences and score_body.selection_preferences.auto_accept_types:
            auto_accept_types = score_body.selection_preferences.auto_accept_types

        auto_accepted_ids: set[str] = set()
        if auto_accept_types:
            for a in pending:
                if a.get("attendee_type") in auto_accept_types:
                    auto_accepted_ids.add(a["applicant_id"])
                    db.update_applicant_fields(a["applicant_id"], {
                        "status": "accepted", "ai_score": "100",
                        "ai_reasoning": f"Auto-accepted ({a.get('attendee_type')})",
                    })
                    yield f"event: auto_accept\ndata: {json.dumps({'applicant_id': a['applicant_id'], 'name': get_applicant_name(a), 'attendee_type': a.get('attendee_type', '')})}\n\n"

        to_score = [a for a in pending if a["applicant_id"] not in auto_accepted_ids]

        # Score
        yield f"event: phase\ndata: {json.dumps({'phase': 'score', 'message': 'Scoring applicants...'})}\n\n"

        completed, errors = 0, 0
        result_counts = {"accepted": 0, "waitlisted": 0, "rejected": 0}
        tasks = {asyncio.ensure_future(_score_one(a, score_body, pool_summary, total_all, semaphore)): a for a in to_score}

        for coro in asyncio.as_completed(tasks.keys()):
            result = await coro
            completed += 1
            if "error" in result:
                errors += 1
                yield f"event: error\ndata: {json.dumps({**result, 'completed': completed, 'total': len(to_score), 'errors': errors})}\n\n"
            else:
                status = result.get("status", "pending")
                if status in result_counts:
                    result_counts[status] += 1
                yield f"event: progress\ndata: {json.dumps({**result, 'completed': completed, 'total': len(to_score), 'errors': errors})}\n\n"

        yield f"event: complete\ndata: {json.dumps({'completed': completed, 'total': len(to_score), 'errors': errors})}\n\n"

        # Summary
        try:
            auto_note = f" ({len(auto_accepted_ids)} auto-accepted)" if auto_accepted_ids else ""
            summary_prompt = _SUMMARY_PROMPT.format(
                total=total_all, accepted=result_counts["accepted"] + len(auto_accepted_ids),
                auto_accepted_note=auto_note, waitlisted=result_counts["waitlisted"],
                rejected=result_counts["rejected"], errors=errors,
                pool_summary=pool_summary,
                selection_context=_selection_context(score_body.selection_preferences),
            )
            raw_summary = await call_ai_async(score_body.provider, score_body.api_key, score_body.model, summary_prompt)
            summary_result = parse_json_response(raw_summary)
            summary_text = summary_result.get("summary", "")
            if summary_text:
                yield f"event: summary\ndata: {json.dumps({'summary': summary_text})}\n\n"
        except Exception:
            pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Reallocate (no AI, re-apply selection rules to cached scores) ──

@router.post("/reallocate")
def reallocate(body: ReallocateRequest):
    applicants = db.scan_all_applicants(session_id=body.session_id)
    scored = [a for a in applicants if a.get("ai_score")]
    scored.sort(key=lambda a: int(a.get("ai_score", 0)), reverse=True)

    capacity = body.venue_capacity or len(scored)
    type_targets: dict[str, int] = {}
    for t, pct in body.attendee_mix.items():
        type_targets[t] = round(capacity * pct / 100)

    auto_accept_set = set(body.auto_accept_types)
    type_counts: dict[str, int] = {}
    accepted_ids, waitlisted_ids = [], []

    for a in scored:
        aid = a["applicant_id"]
        atype = a.get("attendee_type", "other")

        if atype in auto_accept_set:
            accepted_ids.append(aid)
            type_counts[atype] = type_counts.get(atype, 0) + 1
            continue

        if len(accepted_ids) >= capacity:
            waitlisted_ids.append(aid)
            continue

        if atype in type_targets and type_counts.get(atype, 0) >= type_targets[atype]:
            waitlisted_ids.append(aid)
            continue

        accepted_ids.append(aid)
        type_counts[atype] = type_counts.get(atype, 0) + 1

    for aid in accepted_ids:
        db.update_applicant_fields(aid, {"status": "accepted"})
    for aid in waitlisted_ids:
        db.update_applicant_fields(aid, {"status": "waitlisted"})

    return {"accepted": len(accepted_ids), "waitlisted": len(waitlisted_ids), "type_counts": type_counts}
