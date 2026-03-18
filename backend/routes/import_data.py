"""
Data import routes — CSV file upload and Google Sheets live sync.

POST /applicants/upload-csv           Upload a CSV file
POST /applicants/import-google-sheet  Pull from a public Google Sheet
"""

import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
import httpx

from config import AI_FIELDS
from models import GoogleSheetImport
from csv_utils import parse_csv_rows, STATUS_VALUE_MAP
import db

router = APIRouter(prefix="/applicants", tags=["import"])


# ── CSV Upload ──

@router.post("/upload-csv", status_code=201)
async def upload_csv(file: UploadFile = File(...), session_id: str | None = Query(None)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    text = (await file.read()).decode("utf-8")
    rows = parse_csv_rows(text)

    # Auto-create session if none provided
    if not session_id:
        session = db.create_session({
            "name": file.filename.replace(".csv", ""),
            "source": "csv",
            "source_detail": file.filename,
        })
        session_id = session["session_id"]

    items = []
    for row in rows:
        csv_status = row.pop("_csv_status", "").strip().lower()
        row["status"] = STATUS_VALUE_MAP.get(csv_status, "pending")
        row["session_id"] = session_id
        item = db.create_applicant_item(row)
        items.append(item)

    db._update_session_count(session_id)

    # Auto-enrich from linkedin-scrapes DB
    enriched = 0
    linkedin_urls = [it.get("linkedin_url", "") for it in items if it.get("linkedin_url")]
    if linkedin_urls:
        scrapes = db.batch_get_linkedin_scrapes(linkedin_urls)
        for item in items:
            li_url = item.get("linkedin_url", "")
            if li_url and li_url in scrapes:
                profile = scrapes[li_url]
                fields: dict = {}
                if profile.get("headline"):
                    fields["linkedin_headline"] = profile["headline"]
                if profile.get("photo_url"):
                    fields["linkedin_image"] = profile["photo_url"]
                if profile.get("location"):
                    fields["linkedin_location"] = profile["location"]
                if profile.get("experience"):
                    fields["linkedin_experience"] = profile["experience"]
                if profile.get("company"):
                    fields["linkedin_company"] = profile["company"]
                    if not item.get("company"):
                        fields["company"] = profile["company"]
                if profile.get("education"):
                    fields["linkedin_education"] = profile["education"]
                if profile.get("about"):
                    fields["linkedin_about"] = profile["about"]
                if profile.get("name") and not item.get("linkedin_name"):
                    fields["linkedin_name"] = profile["name"]
                # Issues from linkedin-scrapes audit
                issues = profile.get("issues")
                if issues:
                    fields["linkedin_issues"] = "; ".join(issues) if isinstance(issues, list) else str(issues)
                else:
                    fields["linkedin_issues"] = "clean"
                if fields:
                    db.update_applicant_fields(item["applicant_id"], fields)
                    item.update(fields)
                    enriched += 1

    return {"count": len(items), "items": items, "session_id": session_id, "enriched": enriched}


# ── Google Sheets Import ──

def _extract_sheet_id(url: str) -> str:
    """Extract Google Sheet ID from a URL or raw ID string."""
    for pattern in [
        r"/spreadsheets/d/([a-zA-Z0-9-_]+)",
        r"^([a-zA-Z0-9-_]{20,})$",
    ]:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError("Could not extract sheet ID")


async def _fetch_sheet_csv(sheet_id: str, sheet_name: str | None) -> str:
    """Download a public Google Sheet as CSV text."""
    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if sheet_name:
        export_url += f"&sheet={sheet_name}"

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            resp = await client.get(export_url)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Google Sheet not found.")
            raise HTTPException(status_code=400, detail="Could not fetch sheet. Is it set to 'Anyone with the link'?")
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Failed to connect to Google Sheets.")

    if "text/html" in resp.headers.get("content-type", ""):
        raise HTTPException(status_code=403, detail="Sheet is not publicly accessible.")

    return resp.text


@router.post("/import-google-sheet", status_code=201)
async def import_google_sheet(body: GoogleSheetImport):
    try:
        sheet_id = _extract_sheet_id(body.sheet_url)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google Sheet URL.")

    session_id = body.session_id

    # Auto-create session if none provided
    if not session_id:
        session = db.create_session({
            "name": f"Google Sheet Import",
            "source": "google_sheet",
            "source_detail": body.sheet_url,
        })
        session_id = session["session_id"]

    text = await _fetch_sheet_csv(sheet_id, body.sheet_name)
    rows = parse_csv_rows(text)
    existing_emails = db.scan_existing_emails(session_id=session_id)

    new_items, updated_ids = [], []

    for row in rows:
        email = row.get("email", "").strip().lower()

        if email and email in existing_emails:
            # Update existing — preserve status and AI fields
            applicant_id = existing_emails[email]
            update_fields = {k: v for k, v in row.items() if k not in {"status"} | AI_FIELDS}
            if update_fields:
                db.update_applicant_fields(applicant_id, update_fields)
            updated_ids.append(applicant_id)
        else:
            # New applicant
            row["status"] = "pending"
            row["session_id"] = session_id
            item = db.create_applicant_item(row)
            new_items.append(item)
            if email:
                existing_emails[email] = item["applicant_id"]

    db._update_session_count(session_id)

    return {
        "new_count": len(new_items),
        "updated_count": len(updated_ids),
        "total_in_sheet": len(new_items) + len(updated_ids),
        "items": new_items,
        "session_id": session_id,
    }
