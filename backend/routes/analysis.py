"""
AI analysis routes — classification, scoring, and SSE streaming.

POST /applicants/classify-stream       Classify all applicants (lightweight)
POST /applicants/analyze-all-stream    Full analysis with scoring + judge panel
POST /applicants/reallocate            Reallocate based on quotas
POST /applicants/{id}/review           Review one applicant
"""

import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import AI_FIELDS, get_applicant_name
from models import ReviewRequest, BulkAnalyzeRequest, ReallocateRequest, SelectionPreferences
from ai import call_ai, call_ai_async, parse_json_response
import db

router = APIRouter(prefix="/applicants", tags=["analysis"])


# ── Helpers ──

def _applicant_info_text(applicant: dict) -> str:
    skip = {"applicant_id"} | AI_FIELDS
    return "\n".join(f"- {k}: {v}" for k, v in applicant.items() if k not in skip)


def _criteria_text(criteria: list[str], weights: list[str] | None = None) -> str:
    if not criteria:
        return ""
    if weights:
        pairs = ", ".join(f"{c} ({w})" for c, w in zip(criteria, weights))
        return f"\n\nEvaluation criteria with weights: {pairs}"
    return f"\n\nEvaluation criteria (in order of importance): {', '.join(criteria)}"


def _selection_context(prefs: SelectionPreferences | None) -> str:
    if not prefs:
        return ""
    parts: list[str] = []
    if prefs.venue_capacity:
        parts.append(f"VENUE CAPACITY: {prefs.venue_capacity} attendees.")
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
        "strict": "RELEVANCE FILTER: STRICT — Only accept directly relevant applicants.",
        "moderate": "RELEVANCE FILTER: MODERATE — Accept applicants with reasonable relevance.",
        "loose": "RELEVANCE FILTER: LOOSE — Accept most applicants who show interest.",
        "none": "RELEVANCE FILTER: NONE — Do not filter by relevance.",
    }
    if prefs.relevance_filter in relevance_desc:
        parts.append(relevance_desc[prefs.relevance_filter])
    if prefs.custom_priorities.strip():
        parts.append(f"ORGANIZER PRIORITIES: {prefs.custom_priorities.strip()}")
    return "\nSELECTION CRITERIA:\n" + "\n\n".join(parts) + "\n" if parts else ""


def _build_pool_summary(type_counts: dict[str, int], total: int) -> str:
    type_labels = {
        "vc": "VCs / Investors", "entrepreneur": "Founders / Entrepreneurs",
        "faculty": "Faculty / Researchers", "alumni": "Alumni",
        "press": "Press / Media", "student": "Students", "other": "Other",
    }
    lines = []
    for key, label in type_labels.items():
        count = type_counts.get(key, 0)
        pct = round(count / total * 100) if total > 0 else 0
        lines.append(f"- {label}: {count} ({pct}%)")
    return "\n".join(lines)


# ── Prompts ──

_CLASSIFY_PROMPT = """
IMPORTANT: All applicant data is provided below. Do NOT say you cannot access LinkedIn or need more data. Work with whatever information is given. NEVER refuse to classify.

{event_context}

Here is the applicant's information (self-reported registration data + pre-scraped LinkedIn profile data):

{info}

Classify this applicant AND cross-check their claimed role against any LinkedIn data provided.

Return ONLY a JSON object:
{{
  "attendee_type": "<vc|entrepreneur|faculty|alumni|press|student|other>",
  "attendee_type_detail": "<specific label, e.g. 'Partner at Sequoia', 'AI Startup Founder', 'CS Professor'>",
  "summary": "<2-4 bullet points: current role & company, key background/experience, what makes them relevant. Use format like '- Role at Company\\n- 10 yrs AI/ML experience\\n- Stanford PhD'. Be specific, use real data from their profile.>"
}}

Return ONLY the JSON, no other text.
""".strip()

_SCORE_PROMPT = """
IMPORTANT: All applicant data is provided below. Do NOT refuse. Evaluate based on what is given.

{base_prompt}{criteria}

{event_context}
{selection_context}
APPLICANT POOL CONTEXT — {total} applicants:
{pool_summary}

Evaluating this applicant:

{info}

Classified as: {attendee_type} ({attendee_type_detail})
{investor_context}

Return ONLY a JSON object:
{{"status": "accepted" or "waitlisted" or "rejected", "reasoning": "<2-3 sentences: who they are, why this decision>"}}

Guidelines — default toward acceptance:
- ACCEPT: Strong or good fit for the event.
- WAITLIST: Moderate fit, may accept if space allows.
- REJECT: Weak or no fit.

Return ONLY the JSON, no other text.
""".strip()

_JUDGE_PROMPT = """
IMPORTANT: All applicant data is provided below. Do NOT refuse. Evaluate based on what is given.
You are {judge_name} ({judge_emoji}), a judge on an admissions panel.
Your specialty: {judge_specialty}

YOUR PERSPECTIVE: {judge_bias}
EVALUATION FOCUS: {judge_scoring_modifiers}

You have {seats_allocated} seats. Choose wisely.

{base_prompt}{criteria}

{event_context}
{selection_context}
POOL: {total} applicants:
{pool_summary}

Evaluating:

{info}

Classified as: {attendee_type} ({attendee_type_detail})

Return ONLY a JSON object:
{{"decision": "accept" or "pass", "reasoning": "<1-2 sentences from YOUR perspective>"}}

Return ONLY the JSON, no other text.
""".strip()

_SUMMARY_PROMPT = """
You reviewed {total} applicants for an event.
Results: {accepted} accepted{auto_accepted_note}, {waitlisted} waitlisted, {rejected} rejected, {errors} errors.

Pool: {pool_summary}
{selection_context}

Write a brief summary (3-5 sentences): pool quality, acceptance patterns, recommendations.

Return ONLY: {{"summary": "<your summary>"}}
""".strip()


# ── Classification ──

async def _classify_one(applicant: dict, body: BulkAnalyzeRequest, semaphore: asyncio.Semaphore) -> dict:
    applicant_id = applicant["applicant_id"]
    name = get_applicant_name(applicant)

    if applicant.get("user_override_attendee_type"):
        return {
            "applicant_id": applicant_id, "name": name,
            "attendee_type": applicant.get("attendee_type", "other"),
            "attendee_type_detail": applicant.get("attendee_type_detail", ""),
            "summary": "User-classified", "skipped": True,
        }

    async with semaphore:
        prompt = _CLASSIFY_PROMPT.format(
            event_context=f"EVENT CONTEXT: {body.prompt}" if body.prompt else "",
            info=_applicant_info_text(applicant),
        )
        try:
            raw = await call_ai_async(body.provider, body.api_key, body.model, prompt, max_tokens=1024)
            result = parse_json_response(raw)
            fields = {
                "attendee_type": result.get("attendee_type", "other"),
                "attendee_type_detail": result.get("attendee_type_detail", ""),
            }
            if result.get("summary"):
                fields["ai_summary"] = result["summary"]
            db.update_applicant_fields(applicant_id, fields)
            return {"applicant_id": applicant_id, "name": name, **fields, "summary": result.get("summary", "")}
        except json.JSONDecodeError:
            return {"applicant_id": applicant_id, "name": name, "error": f"Invalid JSON: {raw[:200]}"}
        except Exception as e:
            return {"applicant_id": applicant_id, "name": name, "error": str(e)}


# ── Scoring ──

async def _score_one(applicant: dict, body: BulkAnalyzeRequest, pool_summary: str, total: int, semaphore: asyncio.Semaphore) -> dict:
    applicant_id = applicant["applicant_id"]
    name = get_applicant_name(applicant)
    attendee_type = applicant.get("attendee_type", "other")
    attendee_type_detail = applicant.get("attendee_type_detail", "")

    async with semaphore:
        prompt = _SCORE_PROMPT.format(
            base_prompt=body.prompt, criteria=_criteria_text(body.criteria, body.criteria_weights),
            event_context=f"EVENT CONTEXT: {body.prompt}" if body.prompt else "",
            selection_context=_selection_context(body.selection_preferences),
            total=total, pool_summary=pool_summary,
            info=_applicant_info_text(applicant),
            attendee_type=attendee_type, attendee_type_detail=attendee_type_detail,
            investor_context="",
        )
        try:
            raw = await call_ai_async(body.provider, body.api_key, body.model, prompt)
            result = parse_json_response(raw)
            fields = {"status": result.get("status", "pending"), "ai_reasoning": result.get("reasoning", "")}
            db.update_applicant_fields(applicant_id, fields)
            return {"applicant_id": applicant_id, "name": name, **fields, "attendee_type": attendee_type, "attendee_type_detail": attendee_type_detail}
        except Exception as e:
            db.update_applicant_fields(applicant_id, {"ai_reasoning": "Analysis failed"})
            return {"applicant_id": applicant_id, "name": name, "error": str(e)}


# ── Judge scoring ──

async def _judge_score_one(applicant: dict, body: BulkAnalyzeRequest, judge: dict, seats: int, pool_summary: str, total: int, semaphore: asyncio.Semaphore, temperature: float | None = None) -> dict:
    applicant_id = applicant["applicant_id"]
    name = get_applicant_name(applicant)

    async with semaphore:
        prompt = _JUDGE_PROMPT.format(
            judge_name=judge["name"], judge_emoji=judge["emoji"],
            judge_specialty=judge["specialty"], judge_bias=judge["bias"],
            judge_scoring_modifiers=judge["scoring_modifiers"], seats_allocated=seats,
            base_prompt=body.prompt, criteria=_criteria_text(body.criteria, body.criteria_weights),
            event_context=f"EVENT CONTEXT: {body.prompt}" if body.prompt else "",
            selection_context=_selection_context(body.selection_preferences),
            total=total, pool_summary=pool_summary,
            info=_applicant_info_text(applicant),
            attendee_type=applicant.get("attendee_type", "other"),
            attendee_type_detail=applicant.get("attendee_type_detail", ""),
        )
        try:
            raw = await call_ai_async(body.provider, body.api_key, body.model, prompt, temperature=temperature)
            result = parse_json_response(raw)
            return {"applicant_id": applicant_id, "name": name, "decision": result.get("decision", "pass"), "reasoning": result.get("reasoning", "")}
        except Exception as e:
            return {"applicant_id": applicant_id, "name": name, "decision": "pass", "reasoning": "", "error": str(e)}


def _allocate_seats(judges: list[dict], total_applicants: int, venue_capacity: int | None, attendee_mix: dict[str, int] | None) -> dict[str, int]:
    total_seats = venue_capacity or total_applicants
    if attendee_mix:
        weights = {}
        for j in judges:
            w = sum(attendee_mix.get(t, 0) for t in j.get("preferred_types", []))
            weights[j["id"]] = max(w, 1)
        total_weight = sum(weights.values())
        return {j["id"]: max(1, round((weights[j["id"]] / total_weight) * total_seats)) for j in judges}
    per_judge = max(1, round(total_seats / len(judges)))
    return {j["id"]: per_judge for j in judges}


# ── Endpoints ──

@router.post("/{applicant_id}/review")
async def review_one(applicant_id: str, body: ReviewRequest):
    applicant = db.get_applicant_or_404(applicant_id)
    prompt = (body.prompt or "Review this applicant.") + _criteria_text(body.criteria or [])
    prompt += f"\n\nApplicant:\n{_applicant_info_text(applicant)}\n\nProvide a brief assessment."
    raw = await call_ai_async(body.provider, body.api_key, body.model, prompt)
    db.update_applicant_fields(applicant_id, {"ai_review": raw})
    return {**applicant, "ai_review": raw}


@router.post("/classify-stream")
async def classify_stream(body: BulkAnalyzeRequest):
    all_applicants = db.scan_all_applicants(session_id=body.session_id)
    if not all_applicants:
        raise HTTPException(status_code=400, detail="No applicants to classify")

    to_classify = [a for a in all_applicants if not a.get("attendee_type") or not a.get("ai_summary")]
    already = len(all_applicants) - len(to_classify)

    async def event_stream():
        total = len(to_classify)
        semaphore = asyncio.Semaphore(10)
        yield f"event: start\ndata: {json.dumps({'total': total, 'already_classified': already})}\n\n"

        if total == 0:
            yield f"event: complete\ndata: {json.dumps({'completed': 0, 'total': 0, 'errors': 0})}\n\n"
            return

        completed, errors = 0, 0
        tasks = {asyncio.ensure_future(_classify_one(a, body, semaphore)): a for a in to_classify}
        for coro in asyncio.as_completed(tasks.keys()):
            result = await coro
            completed += 1
            if "error" in result:
                errors += 1
                yield f"event: classify_error\ndata: {json.dumps({**result, 'completed': completed, 'total': total})}\n\n"
            else:
                yield f"event: classify\ndata: {json.dumps({**result, 'completed': completed, 'total': total})}\n\n"

        yield f"event: complete\ndata: {json.dumps({'completed': completed, 'total': total, 'errors': errors})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/analyze-all-stream")
async def analyze_all_stream(body: BulkAnalyzeRequest):
    all_applicants = db.scan_all_applicants(session_id=body.session_id)
    if not all_applicants:
        raise HTTPException(status_code=400, detail="No applicants to analyze")

    applicants = list(all_applicants)
    pre_decided: list[dict] = []

    async def event_stream():
        total = len(applicants)
        semaphore = asyncio.Semaphore(10)
        yield f"event: start\ndata: {json.dumps({'total': total, 'pre_decided': len(pre_decided)})}\n\n"

        # ── PASS 1: Classification ──
        yield f"event: phase\ndata: {json.dumps({'phase': 'classify', 'message': 'Pass 1: Classifying all applicants...'})}\n\n"

        completed, errors = 0, 0
        type_counts: dict[str, int] = {}

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
                yield f"event: classify\ndata: {json.dumps({**result, 'completed': completed, 'total': total, 'errors': errors})}\n\n"

        pool_summary = _build_pool_summary(type_counts, total)
        yield f"event: phase\ndata: {json.dumps({'phase': 'pool_summary', 'message': 'Classification complete.', 'type_counts': type_counts, 'total': total})}\n\n"

        # ── Auto-accept ──
        auto_accept_types = body.selection_preferences.auto_accept_types if body.selection_preferences else []
        auto_accepted_ids: set[str] = set()
        if auto_accept_types:
            yield f"event: phase\ndata: {json.dumps({'phase': 'auto_accept', 'message': f'Auto-accepting: {", ".join(auto_accept_types)}...'})}\n\n"
            refreshed = db.scan_all_applicants(session_id=body.session_id)
            for a in refreshed:
                if a.get("attendee_type") in auto_accept_types:
                    auto_accepted_ids.add(a["applicant_id"])
                    db.update_applicant_fields(a["applicant_id"], {"status": "accepted", "ai_reasoning": f"Auto-accepted ({a.get('attendee_type')})"})
                    yield f"event: auto_accept\ndata: {json.dumps({'applicant_id': a['applicant_id'], 'name': get_applicant_name(a), 'attendee_type': a.get('attendee_type', ''), 'attendee_type_detail': a.get('attendee_type_detail', '')})}\n\n"

        # Re-fetch, exclude auto-accepted
        applicants_refreshed = [a for a in db.scan_all_applicants(session_id=body.session_id) if a["applicant_id"] not in auto_accepted_ids]
        scoring_total = len(applicants_refreshed)

        # ── Branch: Panel vs Single ──
        panel = body.panel_config
        if panel and panel.enabled and panel.judge_ids:
            # Load judge personas
            try:
                from judge_personas import JUDGE_PERSONAS_BY_ID
                judges = [JUDGE_PERSONAS_BY_ID[jid] for jid in panel.judge_ids if jid in JUDGE_PERSONAS_BY_ID]
            except ImportError:
                judges = []

            if not judges:
                # Fallback to single reviewer if no judges available
                yield f"event: phase\ndata: {json.dumps({'phase': 'score', 'message': 'No judge personas found, using single reviewer...'})}\n\n"
            else:
                seat_alloc = _allocate_seats(judges, scoring_total, body.selection_preferences.venue_capacity if body.selection_preferences else None, body.selection_preferences.attendee_mix if body.selection_preferences else None)

                yield f"event: phase\ndata: {json.dumps({'phase': 'panel_setup', 'message': f'Judge Panel: {len(judges)} judges, {panel.adjudication_mode} adjudication'})}\n\n"
                for j in judges:
                    seats = seat_alloc[j["id"]]
                    yield f"event: judge_seats\ndata: {json.dumps({'judge_id': j['id'], 'judge_name': j['name'], 'judge_emoji': j['emoji'], 'seats_allocated': seats, 'specialty': j['specialty']})}\n\n"

                all_judge_decisions: dict[str, list[dict]] = {a["applicant_id"]: [] for a in applicants_refreshed}

                for judge_idx, judge in enumerate(judges):
                    seats = seat_alloc[judge["id"]]
                    yield f"event: judge_start\ndata: {json.dumps({'judge_id': judge['id'], 'judge_name': judge['name'], 'judge_emoji': judge['emoji'], 'judge_index': judge_idx, 'total_judges': len(judges), 'seats_remaining': seats})}\n\n"

                    judge_temp = panel.judge_temperatures.get(judge["id"]) if panel.judge_temperatures else None
                    judge_tasks = {asyncio.ensure_future(_judge_score_one(a, body, judge, seats, pool_summary, total, semaphore, temperature=judge_temp)): a for a in applicants_refreshed}

                    judge_results = []
                    judge_completed = 0
                    for coro in asyncio.as_completed(judge_tasks.keys()):
                        result = await coro
                        judge_completed += 1
                        judge_results.append(result)
                        yield f"event: judge_progress\ndata: {json.dumps({'judge_id': judge['id'], 'judge_name': judge['name'], 'judge_emoji': judge['emoji'], 'applicant_id': result['applicant_id'], 'name': result['name'], 'decision': result.get('decision', 'pass'), 'reasoning': result.get('reasoning', ''), 'completed': judge_completed, 'total': scoring_total})}\n\n"

                    judge_results.sort(key=lambda r: 0 if r.get("decision") == "accept" else 1)
                    seats_filled = 0
                    accepted_names = []
                    for r in judge_results:
                        if "error" in r:
                            continue
                        if seats_filled < seats and r.get("decision") == "accept":
                            seats_filled += 1
                            accepted_names.append(r["name"])
                        else:
                            r["decision"] = "pass"
                        all_judge_decisions[r["applicant_id"]].append({"judge_id": judge["id"], "judge_name": judge["name"], "judge_emoji": judge["emoji"], "decision": r["decision"], "reasoning": r.get("reasoning", "")})

                    yield f"event: judge_complete\ndata: {json.dumps({'judge_id': judge['id'], 'judge_name': judge['name'], 'judge_emoji': judge['emoji'], 'seats_filled': seats_filled, 'seats_allocated': seats, 'accepted_names': accepted_names})}\n\n"

                # Adjudication
                yield f"event: phase\ndata: {json.dumps({'phase': 'adjudication', 'message': f'Adjudication ({panel.adjudication_mode} mode)...'})}\n\n"
                result_counts = {"accepted": 0, "waitlisted": 0, "rejected": 0}

                for a in applicants_refreshed:
                    aid = a["applicant_id"]
                    decisions = all_judge_decisions.get(aid, [])
                    accept_count = sum(1 for d in decisions if d["decision"] == "accept")
                    votes_total = len(decisions)

                    if panel.adjudication_mode == "majority":
                        final_status = "accepted" if accept_count > votes_total / 2 else "waitlisted"
                    else:
                        final_status = "accepted" if accept_count > 0 else "waitlisted"

                    result_counts[final_status] += 1
                    reasoning_parts = [f"{d['judge_emoji']} {d['judge_name']} [{'ACCEPT' if d['decision'] == 'accept' else 'PASS'}]: {d['reasoning']}" for d in decisions]
                    accepting = [f"{d['judge_emoji']} {d['judge_name']}" for d in decisions if d["decision"] == "accept"]

                    db.update_applicant_fields(aid, {
                        "status": final_status,
                        "ai_reasoning": " | ".join(reasoning_parts),
                        "panel_votes": f"{accept_count}/{votes_total}",
                        "accepting_judges": ", ".join(accepting) if accepting else "",
                    })
                    yield f"event: adjudication\ndata: {json.dumps({'applicant_id': aid, 'name': get_applicant_name(a), 'final_status': final_status, 'votes_accept': accept_count, 'votes_total': votes_total, 'accepting_judges': accepting})}\n\n"

                yield f"event: complete\ndata: {json.dumps({'completed': scoring_total, 'total': scoring_total, 'errors': 0})}\n\n"

                # Summary
                try:
                    auto_note = f" ({len(auto_accepted_ids)} auto-accepted)" if auto_accepted_ids else ""
                    summary_prompt = _SUMMARY_PROMPT.format(total=total, accepted=result_counts["accepted"] + len(auto_accepted_ids), auto_accepted_note=auto_note, waitlisted=result_counts["waitlisted"], rejected=result_counts["rejected"], errors=0, pool_summary=pool_summary, selection_context=_selection_context(body.selection_preferences))
                    raw_summary = await call_ai_async(body.provider, body.api_key, body.model, summary_prompt)
                    summary_result = parse_json_response(raw_summary)
                    if summary_result.get("summary"):
                        yield f"event: summary\ndata: {json.dumps({'summary': summary_result['summary']})}\n\n"
                except Exception:
                    pass
                return

        # ── SINGLE REVIEWER ──
        yield f"event: phase\ndata: {json.dumps({'phase': 'score', 'message': 'Pass 2: Making decisions...'})}\n\n"

        completed, errors = 0, 0
        result_counts = {"accepted": 0, "waitlisted": 0, "rejected": 0}
        tasks = {asyncio.ensure_future(_score_one(a, body, pool_summary, total, semaphore)): a for a in applicants_refreshed}

        for coro in asyncio.as_completed(tasks.keys()):
            result = await coro
            completed += 1
            if "error" in result:
                errors += 1
                yield f"event: error\ndata: {json.dumps({**result, 'completed': completed, 'total': scoring_total, 'errors': errors})}\n\n"
            else:
                status = result.get("status", "pending")
                if status in result_counts:
                    result_counts[status] += 1
                yield f"event: progress\ndata: {json.dumps({**result, 'completed': completed, 'total': scoring_total, 'errors': errors})}\n\n"

        yield f"event: complete\ndata: {json.dumps({'completed': completed, 'total': scoring_total, 'errors': errors})}\n\n"

        # Summary
        try:
            auto_note = f" ({len(auto_accepted_ids)} auto-accepted)" if auto_accepted_ids else ""
            summary_prompt = _SUMMARY_PROMPT.format(total=total, accepted=result_counts["accepted"] + len(auto_accepted_ids), auto_accepted_note=auto_note, waitlisted=result_counts["waitlisted"], rejected=result_counts["rejected"], errors=errors, pool_summary=pool_summary, selection_context=_selection_context(body.selection_preferences))
            raw_summary = await call_ai_async(body.provider, body.api_key, body.model, summary_prompt)
            summary_result = parse_json_response(raw_summary)
            if summary_result.get("summary"):
                yield f"event: summary\ndata: {json.dumps({'summary': summary_result['summary']})}\n\n"
        except Exception:
            pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/reallocate")
async def reallocate(body: ReallocateRequest):
    applicants = db.scan_all_applicants(session_id=body.session_id)
    if not applicants:
        raise HTTPException(status_code=400, detail="No applicants")

    type_labels = {"vc": "VCs", "entrepreneur": "Founders", "faculty": "Faculty", "alumni": "Alumni", "press": "Press", "student": "Students", "other": "Other"}
    by_type: dict[str, list] = {k: [] for k in type_labels}

    for a in applicants:
        t = a.get("attendee_type", "other")
        if t not in by_type:
            t = "other"
        by_type[t].append(a)

    capacity = body.venue_capacity or len(applicants)
    accepted, waitlisted = 0, 0

    for type_key, items in by_type.items():
        pct = body.attendee_mix.get(type_key, 0)
        target = round(pct / 100 * capacity) if pct else 0
        sorted_items = sorted(items, key=lambda a: a.get("name", ""))

        for i, a in enumerate(sorted_items):
            new_status = "accepted" if i < target else "waitlisted"
            db.update_applicant_fields(a["applicant_id"], {"status": new_status})
            if new_status == "accepted":
                accepted += 1
            else:
                waitlisted += 1

    return {"accepted": accepted, "waitlisted": waitlisted, "total": len(applicants)}
