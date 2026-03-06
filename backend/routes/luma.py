"""
Luma API integration — import events and sync decisions.

GET  /luma/events                    List events from Luma
GET  /luma/events/{event_id}/guests  Get guest list for an event
POST /luma/import                    Import guests as applicants
POST /luma/sync                      Push accept/reject decisions back to Luma
"""

import httpx
from fastapi import APIRouter, HTTPException, Query

import db

router = APIRouter(prefix="/luma", tags=["luma"])

LUMA_API_BASE = "https://api.lu.ma/public/v1"


def _luma_headers(api_key: str) -> dict:
    return {"x-luma-api-key": api_key, "Content-Type": "application/json"}


def _get_luma_key(api_key: str | None = None) -> str:
    """Use provided key or fall back to stored key."""
    if api_key:
        return api_key
    data = db.get_settings("luma_api_key")
    if data and data.get("api_key"):
        return data["api_key"]
    raise HTTPException(status_code=400, detail="No Luma API key provided or stored.")


@router.get("/events")
async def list_events(api_key: str | None = Query(None)):
    key = _get_luma_key(api_key)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{LUMA_API_BASE}/calendar/list-events",
            headers=_luma_headers(key),
        )
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"Luma API error: {resp.text[:300]}")
        return resp.json()


@router.get("/events/{event_id}/guests")
async def get_event_guests(event_id: str, api_key: str | None = Query(None)):
    key = _get_luma_key(api_key)
    guests = []
    cursor = None
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            params: dict = {"event_api_id": event_id}
            if cursor:
                params["pagination_cursor"] = cursor
            resp = await client.get(
                f"{LUMA_API_BASE}/event/get-guests",
                headers=_luma_headers(key),
                params=params,
            )
            if resp.status_code != 200:
                raise HTTPException(resp.status_code, f"Luma API error: {resp.text[:300]}")
            data = resp.json()
            guests.extend(data.get("entries", []))
            if not data.get("has_more"):
                break
            cursor = data.get("next_cursor")
    return {"guests": guests, "count": len(guests)}


@router.post("/import")
async def import_from_luma(
    event_id: str = Query(...),
    api_key: str | None = Query(None),
    session_id: str | None = Query(None),
):
    key = _get_luma_key(api_key)
    guests_resp = await get_event_guests(event_id, key)
    guests = guests_resp["guests"]

    if not session_id:
        session = db.create_session({
            "name": "Luma Import",
            "source": "luma",
            "source_detail": event_id,
        })
        session_id = session["session_id"]

    items = []
    for guest in guests:
        user = guest.get("user", {})
        row: dict = {
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "linkedin_url": user.get("linkedin_url", ""),
            "luma_guest_id": guest.get("api_id", ""),
            "luma_status": guest.get("approval_status", ""),
            "status": "pending",
            "session_id": session_id,
        }
        # Include custom question answers
        for ans in guest.get("event_registration_answers", []):
            label = ans.get("question_label", "").strip().lower().replace(" ", "_")
            if label:
                row[label] = ans.get("answer", "")
        item = db.create_applicant_item(row)
        items.append(item)

    db._update_session_count(session_id)
    return {"count": len(items), "session_id": session_id}


@router.post("/sync")
async def sync_to_luma(
    session_id: str = Query(...),
    api_key: str | None = Query(None),
    dry_run: bool = Query(True),
):
    """Push accept/reject decisions back to Luma. Dry run by default."""
    key = _get_luma_key(api_key)
    applicants = db.scan_all_applicants(session_id=session_id)

    status_map = {
        "accepted": "approved",
        "rejected": "declined",
        "waitlisted": "pending",
    }

    updates = []
    for a in applicants:
        luma_id = a.get("luma_guest_id")
        our_status = a.get("status", "pending")
        luma_status = status_map.get(our_status)
        if luma_id and luma_status:
            updates.append({"guest_id": luma_id, "status": luma_status, "name": a.get("name", "")})

    if dry_run:
        return {"dry_run": True, "updates": updates, "count": len(updates)}

    results = []
    async with httpx.AsyncClient(timeout=30) as client:
        for update in updates:
            resp = await client.post(
                f"{LUMA_API_BASE}/event/update-guest",
                headers=_luma_headers(key),
                json={"guest_api_id": update["guest_id"], "approval_status": update["status"]},
            )
            results.append({
                "guest_id": update["guest_id"],
                "name": update["name"],
                "status": update["status"],
                "success": resp.status_code == 200,
                "error": resp.text[:200] if resp.status_code != 200 else None,
            })

    return {"updates": results, "count": len(results)}
