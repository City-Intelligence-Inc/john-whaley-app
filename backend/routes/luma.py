"""
Luma API integration — import events and sync decisions.

GET  /luma/events                    List events from Luma calendar
GET  /luma/events/{event_id}/guests  Get guest list for an event
GET  /luma/my-events                 Events where the user's email is on the guest list
GET  /luma/lookup-event              Look up a Luma event by URL
POST /luma/import                    Import guests as applicants
POST /luma/sync                      Push accept/reject decisions back to Luma
"""

import asyncio
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

import db
from auth import require_auth

router = APIRouter(prefix="/luma", tags=["luma"])

LUMA_API_BASE = "https://public-api.luma.com/v1"


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


def _flatten_event(entry: dict) -> dict:
    """Flatten a Luma calendar entry (which nests event data) into a flat dict."""
    event = entry.get("event") or entry
    return {
        "api_id": event.get("api_id") or event.get("id") or entry.get("api_id", ""),
        "name": event.get("name", ""),
        "start_at": event.get("start_at", ""),
        "end_at": event.get("end_at", ""),
        "cover_url": event.get("cover_url", ""),
        "url": event.get("url", ""),
        "geo_address_json": event.get("geo_address_json"),
    }


async def _fetch_all_events(key: str) -> list[dict]:
    """Fetch all events from Stardrop's Luma calendar, flattened."""
    all_entries: list[dict] = []
    cursor = None
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            params: dict = {}
            if cursor:
                params["pagination_cursor"] = cursor
            resp = await client.get(
                f"{LUMA_API_BASE}/calendar/list-events",
                headers=_luma_headers(key),
                params=params,
            )
            if resp.status_code != 200:
                raise HTTPException(resp.status_code, f"Luma API error: {resp.text[:300]}")
            data = resp.json()
            for entry in data.get("entries", []):
                all_entries.append(_flatten_event(entry))
            if not data.get("has_more"):
                break
            cursor = data.get("next_cursor")
    return all_entries


async def _fetch_guests(client: httpx.AsyncClient, event_id: str, key: str) -> list[dict]:
    """Fetch all guests for an event using a shared HTTP client."""
    guests: list[dict] = []
    cursor = None
    while True:
        params: dict = {"event_id": event_id}
        if cursor:
            params["pagination_cursor"] = cursor
        resp = await client.get(
            f"{LUMA_API_BASE}/event/get-guests",
            headers=_luma_headers(key),
            params=params,
        )
        if resp.status_code != 200:
            break
        data = resp.json()
        guests.extend(data.get("entries", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return guests


async def _get_event_by_id(client: httpx.AsyncClient, event_id: str, key: str) -> dict | None:
    """Fetch full event details by api_id."""
    resp = await client.get(
        f"{LUMA_API_BASE}/event/get",
        headers=_luma_headers(key),
        params={"id": event_id},
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    event = data.get("event")
    if not event:
        return None
    return {
        "api_id": event.get("api_id") or event.get("id", ""),
        "name": event.get("name", ""),
        "start_at": event.get("start_at", ""),
        "end_at": event.get("end_at", ""),
        "cover_url": event.get("cover_url", ""),
        "url": event.get("url", ""),
        "geo_address_json": event.get("geo_address_json"),
    }


# ── Endpoints ──


@router.get("/events")
async def list_events(api_key: str | None = Query(None)):
    key = _get_luma_key(api_key)
    entries = await _fetch_all_events(key)
    return {"entries": entries}


@router.get("/events/{event_id}/guests")
async def get_event_guests(event_id: str, api_key: str | None = Query(None)):
    key = _get_luma_key(api_key)
    async with httpx.AsyncClient(timeout=30) as client:
        guests = await _fetch_guests(client, event_id, key)
    return {"guests": guests, "count": len(guests)}


@router.get("/my-events")
async def my_events(
    email: str | None = Query(None),
    claims: dict = Depends(require_auth),
):
    """Find Luma events where the user's email is on the guest list."""
    key = _get_luma_key()

    user_email = email or claims.get("email")
    if not user_email:
        raise HTTPException(400, "No email provided or found in auth token.")
    user_email = user_email.lower().strip()

    events = await _fetch_all_events(key)
    if not events:
        return {"events": []}

    matched: list[dict] = []

    async def _check(client: httpx.AsyncClient, event: dict) -> dict | None:
        guests = await _fetch_guests(client, event["api_id"], key)
        for g in guests:
            guest_email = (g.get("user") or {}).get("email", "")
            if guest_email.lower().strip() == user_email:
                return {**event, "guest_status": g.get("approval_status", "")}
        return None

    async with httpx.AsyncClient(timeout=30) as client:
        # Process in batches of 5 to avoid rate limits
        for i in range(0, len(events), 5):
            batch = events[i:i + 5]
            results = await asyncio.gather(*[_check(client, e) for e in batch])
            matched.extend(r for r in results if r)

    return {"events": matched}


def _extract_event_id_or_slug(raw: str) -> tuple[str | None, str | None]:
    """Parse a Luma URL/ID into (event_api_id, slug).

    Handles:
      evt-XXXX                             -> (evt-XXXX, None)
      https://luma.com/event/manage/evt-X  -> (evt-X, None)
      https://lu.ma/abc123                 -> (None, abc123)
      https://luma.com/abc123              -> (None, abc123)
      abc123                               -> (None, abc123)
    """
    raw = raw.strip().rstrip("/")

    # Direct event API ID
    if raw.startswith("evt-"):
        return (raw, None)

    # Management URL: https://luma.com/event/manage/evt-XXXX
    import re
    m = re.search(r"(evt-[A-Za-z0-9]+)", raw)
    if m:
        return (m.group(1), None)

    # Strip protocol and domain to get slug
    for prefix in [
        "https://lu.ma/", "http://lu.ma/",
        "https://luma.com/", "http://luma.com/",
        "https://www.luma.com/", "http://www.luma.com/",
        "lu.ma/", "luma.com/",
    ]:
        if raw.lower().startswith(prefix):
            slug = raw[len(prefix):].split("?")[0].split("#")[0].rstrip("/")
            return (None, slug)

    # Bare slug
    return (None, raw)


@router.get("/lookup-event")
async def lookup_event(url: str = Query(...)):
    """Look up a Luma event by URL, slug, or event ID."""
    key = _get_luma_key()
    event_id, slug = _extract_event_id_or_slug(url)

    async with httpx.AsyncClient(timeout=15) as client:
        # If we have a direct event ID, fetch it
        if event_id:
            full = await _get_event_by_id(client, event_id, key)
            if full:
                return full

        # Try the official calendar/lookup-event with various URL forms
        if slug:
            for try_url in [f"https://lu.ma/{slug}", url.strip()]:
                resp = await client.get(
                    f"{LUMA_API_BASE}/calendar/lookup-event",
                    headers=_luma_headers(key),
                    params={"url": try_url, "platform": "luma"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    cal_event = data.get("event")
                    if cal_event and cal_event.get("api_id"):
                        full = await _get_event_by_id(client, cal_event["api_id"], key)
                        if full:
                            return full

        # Fallback: check our calendar events for a URL/slug match
        events = await _fetch_all_events(key)
        url_clean = url.strip().rstrip("/").lower()
        search_slug = (slug or "").lower()
        for event in events:
            event_url = (event.get("url") or "").lower()
            if event_url and (url_clean in event_url or event_url in url_clean):
                return event
            if search_slug and search_slug in event_url:
                return event

    raise HTTPException(404, "Event not found. Make sure Stardrop has been added as a host to this event.")


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
        event_name = "Luma Import"
        async with httpx.AsyncClient(timeout=15) as client:
            full = await _get_event_by_id(client, event_id, key)
            if full:
                event_name = full.get("name") or event_name
        session = db.create_session({
            "name": event_name,
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
                f"{LUMA_API_BASE}/event/update-guest-status",
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
