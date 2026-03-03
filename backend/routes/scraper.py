"""
LinkedIn profile enrichment via Scrapfly — scrapes public LinkedIn profiles
and saves extracted fields (headline, about, experience) to applicant records.

POST /scraper/enrich-linkedin   SSE streaming endpoint
"""

import asyncio
import json
import re

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import LinkedInEnrichRequest
import db

router = APIRouter(prefix="/scraper", tags=["scraper"])

SCRAPFLY_URL = "https://api.scrapfly.io/scrape"


def _parse_linkedin_markdown(md: str) -> dict[str, str]:
    """Extract structured fields from Scrapfly LinkedIn markdown output.

    Populates: linkedin_headline, linkedin_about, linkedin_experience,
    title, company, location, education.
    """
    result: dict[str, str] = {}

    lines = md.split("\n")

    # ── Headline — early non-empty lines before first section header ──
    headline_candidates: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            break
        if stripped and len(stripped) < 200:
            headline_candidates.append(stripped)
    if len(headline_candidates) >= 2:
        result["linkedin_headline"] = headline_candidates[1]
    elif headline_candidates:
        result["linkedin_headline"] = headline_candidates[0]

    # ── Location — look for a line with common location patterns before sections ──
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            break
        # Patterns like "San Francisco Bay Area", "New York, NY", "Greater Boston"
        if re.match(r"^[A-Z][\w\s,.-]+(Area|Region|Metro|,\s*[A-Z]{2})", stripped):
            result["location"] = stripped
            break

    # ── About / Summary section ──
    about_match = re.search(
        r"(?:^|\n)##?\s*About\s*\n(.*?)(?=\n##?\s|\Z)",
        md,
        re.DOTALL | re.IGNORECASE,
    )
    if about_match:
        about_text = about_match.group(1).strip()
        if len(about_text) > 2000:
            about_text = about_text[:2000] + "..."
        result["linkedin_about"] = about_text

    # ── Experience section — full block for AI context ──
    exp_match = re.search(
        r"(?:^|\n)##?\s*Experience\s*\n(.*?)(?=\n##?\s|\Z)",
        md,
        re.DOTALL | re.IGNORECASE,
    )
    if exp_match:
        exp_text = exp_match.group(1).strip()
        # Save full experience (capped at 3000 chars) for AI analysis
        if len(exp_text) > 3000:
            exp_text = exp_text[:3000] + "..."
        result["linkedin_experience"] = exp_text

        # Extract title + company from the first experience entry
        exp_lines = [l.strip() for l in exp_match.group(1).strip().split("\n") if l.strip()]
        if exp_lines:
            first_line = exp_lines[0].lstrip("#- *")
            # Common patterns: "Title at Company" or "Title · Company" or just "Title"
            for sep in [" at ", " · ", " - ", " | "]:
                if sep in first_line:
                    parts = first_line.split(sep, 1)
                    result["title"] = parts[0].strip()
                    result["company"] = parts[1].strip()
                    break
            else:
                result["title"] = first_line.strip()
                # Company might be on the next line
                if len(exp_lines) > 1:
                    result["company"] = exp_lines[1].lstrip("#- *").strip()

    # ── Education section ──
    edu_match = re.search(
        r"(?:^|\n)##?\s*Education\s*\n(.*?)(?=\n##?\s|\Z)",
        md,
        re.DOTALL | re.IGNORECASE,
    )
    if edu_match:
        edu_text = edu_match.group(1).strip()
        if len(edu_text) > 1000:
            edu_text = edu_text[:1000] + "..."
        result["education"] = edu_text

    # Fall back: derive title from headline if experience didn't yield one
    if "title" not in result and "linkedin_headline" in result:
        hl = result["linkedin_headline"]
        for sep in [" at ", " @ ", " | "]:
            if sep in hl:
                parts = hl.split(sep, 1)
                result.setdefault("title", parts[0].strip())
                result.setdefault("company", parts[1].strip())
                break

    return result


MAX_RETRIES = 3
RETRY_BACKOFF = [2, 5, 10]  # seconds between retries


async def _scrape_one(
    client: httpx.AsyncClient,
    applicant: dict,
    semaphore: asyncio.Semaphore,
    api_key: str,
) -> dict:
    """Scrape a single LinkedIn profile with retries on rate limits."""
    applicant_id = applicant["applicant_id"]
    name = applicant.get("name", "Unknown")
    linkedin_url = applicant.get("linkedin_url", "")

    async with semaphore:
        last_error = ""
        for attempt in range(MAX_RETRIES):
            try:
                resp = await client.get(
                    SCRAPFLY_URL,
                    params={
                        "key": api_key,
                        "url": linkedin_url,
                        "render_js": "true",
                        "asp": "true",
                        "country": "us",
                        "format": "markdown",
                    },
                    timeout=60.0,
                )
                resp.raise_for_status()

                data = resp.json()
                md = data.get("result", {}).get("content", "")
                if not md:
                    return {
                        "applicant_id": applicant_id,
                        "name": name,
                        "error": "Empty response from Scrapfly",
                    }

                fields = _parse_linkedin_markdown(md)
                if not fields:
                    return {
                        "applicant_id": applicant_id,
                        "name": name,
                        "error": "Could not parse any fields from profile",
                    }

                db.update_applicant_fields(applicant_id, fields)

                return {
                    "applicant_id": applicant_id,
                    "name": name,
                    "linkedin_headline": fields.get("linkedin_headline", ""),
                    "retries": attempt,
                }

            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                last_error = f"Scrapfly HTTP {status}"
                # Retry on rate limit (429) or server errors (5xx)
                if status in (429, 500, 502, 503) and attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_BACKOFF[attempt])
                    continue
                break
            except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
                last_error = f"Timeout: {e}"
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_BACKOFF[attempt])
                    continue
                break
            except Exception as e:
                last_error = str(e)
                break

        return {
            "applicant_id": applicant_id,
            "name": name,
            "error": f"{last_error} (after {attempt + 1} attempts)",
        }


@router.post("/enrich-linkedin")
async def enrich_linkedin(body: LinkedInEnrichRequest):
    """Scrape LinkedIn profiles for applicants and save enriched data. SSE stream."""
    applicants = db.scan_all_applicants(session_id=body.session_id)
    if not applicants:
        raise HTTPException(status_code=400, detail="No applicants found")

    # Filter to specific IDs if provided
    if body.applicant_ids:
        id_set = set(body.applicant_ids)
        applicants = [a for a in applicants if a["applicant_id"] in id_set]

    # Filter to those with linkedin_url and not already enriched
    applicants = [
        a for a in applicants
        if a.get("linkedin_url") and not a.get("linkedin_headline")
    ]

    if not applicants:
        raise HTTPException(
            status_code=400,
            detail="No applicants with LinkedIn URLs to enrich (all may already be enriched)",
        )

    async def event_stream():
        total = len(applicants)
        semaphore = asyncio.Semaphore(100)

        yield f"event: start\ndata: {json.dumps({'total': total})}\n\n"

        completed = 0
        errors = 0
        enriched = 0

        async with httpx.AsyncClient() as client:
            tasks = {
                asyncio.ensure_future(
                    _scrape_one(client, a, semaphore, body.scrapfly_key)
                ): a
                for a in applicants
            }

            for coro in asyncio.as_completed(tasks.keys()):
                result = await coro
                completed += 1

                if "error" in result:
                    errors += 1
                    yield f"event: error\ndata: {json.dumps({'completed': completed, 'total': total, 'applicant_id': result['applicant_id'], 'name': result['name'], 'error': result['error']})}\n\n"
                else:
                    enriched += 1
                    yield f"event: progress\ndata: {json.dumps({'completed': completed, 'total': total, 'applicant_id': result['applicant_id'], 'name': result['name'], 'linkedin_headline': result.get('linkedin_headline', ''), 'retries': result.get('retries', 0)})}\n\n"

        yield f"event: complete\ndata: {json.dumps({'completed': completed, 'total': total, 'errors': errors, 'enriched': enriched})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
