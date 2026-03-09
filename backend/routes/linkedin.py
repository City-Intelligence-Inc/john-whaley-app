"""
LinkedIn Profile API

POST /linkedin/profile        — scrape one profile, returns structured data
POST /linkedin/enrich         — submit URLs for batch enrichment, returns job_id
GET  /linkedin/jobs/{job_id}  — poll status and partial results
GET  /linkedin/stream/{job_id}— SSE stream of results as they arrive

All endpoints accept li_at (LinkedIn session cookie) and user_agent as inputs —
neither is hardcoded. Rotate them freely as they expire or get flagged.

Rate-limit strategy:
  - On 999/429: exponential backoff (30s → 60s → 120s → 240s → 300s cap)
  - Retries indefinitely until max_retries (default 6) exhausted
  - Batch jobs run in background — caller never sees a timeout error

Profile response schema:
  {
    "url":         "https://www.linkedin.com/in/...",
    "name":        "Full Name",
    "headline":    "Current role / tagline",
    "photo_url":   "https://media.licdn.com/...",
    "location":    "San Francisco Bay Area",
    "connections": "500+",
    "error":       null
  }
"""

import asyncio
import re
import time
import uuid
from typing import Optional

from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
import json

router = APIRouter(prefix="/linkedin", tags=["linkedin"])

# ─── In-memory job store (swap to Redis for multi-process deploy) ─────────────
_jobs: dict[str, dict] = {}  # job_id → job state

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


# ─── Request / Response models ────────────────────────────────────────────────
class ProfileRequest(BaseModel):
    url: str
    li_at: Optional[str] = None        # LinkedIn session cookie
    user_agent: Optional[str] = None   # override User-Agent (rotate when flagged)


class ProfileData(BaseModel):
    url: str
    name: Optional[str] = None
    headline: Optional[str] = None
    photo_url: Optional[str] = None
    location: Optional[str] = None
    connections: Optional[str] = None
    company: Optional[str] = None
    education: Optional[str] = None
    error: Optional[str] = None


class EnrichRequest(BaseModel):
    urls: list[str]
    li_at: Optional[str] = None        # LinkedIn session cookie
    user_agent: Optional[str] = None   # override User-Agent
    max_retries: int = 6
    session_id: Optional[str] = None   # if set, saves results to applicant DB records


class EnrichResponse(BaseModel):
    job_id: str
    total: int
    message: str


# ─── URL normalizer ───────────────────────────────────────────────────────────
def normalize_linkedin_url(raw: str) -> str | None:
    """Normalize a LinkedIn URL, fixing common typos.

    Common fixes applied:
    - linked.com → linkedin.com
    - Missing /in/ prefix (bare username)
    - Missing https:// scheme
    - URLs like linkedin.com/sergey-q-630639160 → linkedin.com/in/sergey-q-630639160
    """
    from urllib.parse import urlparse
    url = raw.strip()
    if not url:
        return None
    if url.startswith("@") or url.startswith("#"):
        return None
    if url.startswith("https://x.com") or url.startswith("http://x.com"):
        return None
    if url in ("https://www.linkedin.com", "https://linkedin.com"):
        return None

    # Fix common typo: linked.com → linkedin.com
    if "linked.com/" in url and "linkedin.com" not in url:
        url = url.replace("linked.com/", "linkedin.com/")

    # Bare username without any URL structure
    if not url.startswith("http") and "/" not in url and len(url) > 2 and "." not in url:
        return f"https://www.linkedin.com/in/{url}/"

    # Add scheme if missing
    for prefix in ("linkedin.com/", "www.linkedin.com/"):
        if url.startswith(prefix):
            url = "https://www." + url.lstrip("www.")
            break

    if not url.startswith("http"):
        return None
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    if "linkedin.com" not in parsed.netloc:
        return None

    # Fix URLs missing /in/ (e.g. linkedin.com/sergey-q-630639160)
    if "/in/" not in parsed.path and "/company/" not in parsed.path:
        path_parts = [p for p in parsed.path.split("/") if p]
        if path_parts and len(path_parts[0]) > 2:
            return f"https://www.linkedin.com/in/{path_parts[0]}/"
        return None

    match = re.search(r"linkedin\.com/(in|company)/([^/?&#\s]+)", url)
    if not match:
        return None
    return f"https://www.linkedin.com/{match.group(1)}/{match.group(2).rstrip('/')}/"


def _meta(soup: BeautifulSoup, prop: str) -> str | None:
    tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
    return tag.get("content", "").strip() if tag else None


# ─── Requests-based single-profile scraper (async wrapper) ───────────────────
async def _scrape_profile_requests(url: str, li_at: str | None, user_agent: str | None) -> ProfileData:
    """Fast requests-based scrape — no JS overhead. Works for both public and auth views."""
    import requests as _req

    ua = user_agent or DEFAULT_UA
    session = _req.Session()
    session.headers.update({
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Cache-Control": "max-age=0",
    })
    if li_at:
        session.cookies.set("li_at", li_at, domain=".linkedin.com")

    loop = asyncio.get_event_loop()
    result_dict = await loop.run_in_executor(None, _scrape_url_blocking, url, session, 3)
    return ProfileData(**result_dict)


# ─── Playwright scraper (async, rich DOM extraction) ─────────────────────────
async def _scrape_with_playwright(url: str, li_at: str | None, user_agent: str | None) -> ProfileData:
    """Full browser render via Playwright — extracts rich structured profile data."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return ProfileData(url=url, error="playwright not installed — run: pip install playwright && python -m playwright install chromium")

    ua = user_agent or DEFAULT_UA

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(
                user_agent=ua,
                locale="en-US",
                viewport={"width": 1280, "height": 900},
            )
            if li_at:
                await ctx.add_cookies([{
                    "name": "li_at",
                    "value": li_at,
                    "domain": ".linkedin.com",
                    "path": "/",
                    "httpOnly": True,
                    "secure": True,
                }])

            page = await ctx.new_page()

            # Block images/fonts — not needed for text extraction
            await page.route(
                "**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,otf}",
                lambda r: r.abort(),
            )

            await page.goto(url, wait_until="domcontentloaded", timeout=30000)

            # Wait for h1 to confirm page loaded
            try:
                await page.wait_for_selector("h1", timeout=10000)
            except Exception:
                pass

            # ── Extract via JS for accuracy ───────────────────────────────
            data = await page.evaluate("""() => {
                const getText = (el) => el ? el.innerText.trim() : null;

                // Name — h1
                const h1 = document.querySelector('h1');
                const name = getText(h1);

                // Headline — find the first .text-body-medium that looks like a headline
                // (contains a verb/preposition or is multi-word, not just a company name)
                let headline = null;

                // Strategy 1: element right after h1 in the same container
                if (h1) {
                    let el = h1.nextElementSibling;
                    while (el) {
                        const t = el.innerText ? el.innerText.trim() : '';
                        if (t && t !== name && t.length > 5 && t.length < 300 &&
                            !['Message', 'Connect', 'Follow', 'More'].includes(t)) {
                            headline = t;
                            break;
                        }
                        el = el.nextElementSibling;
                    }
                }

                // Strategy 2: .text-body-medium elements — prefer longer ones with "at" or prepositions
                if (!headline) {
                    const candidates = Array.from(document.querySelectorAll('.text-body-medium'));
                    // Sort: prefer ones that contain "at", "|", "@", or are longer
                    const scored = candidates.map(el => {
                        const t = el.innerText ? el.innerText.trim() : '';
                        let score = 0;
                        if (t === name) return { t, score: -1 };
                        if (t.length < 5) return { t, score: -1 };
                        if (/\\b(at|@|and|for|with|\\|)\\b/i.test(t)) score += 10;
                        if (t.length > 20) score += 5;
                        if (!t.includes('\\n')) score += 3;
                        if (['Message', 'Connect', 'Follow', 'More'].includes(t)) score = -1;
                        return { t, score };
                    }).filter(x => x.score >= 0).sort((a, b) => b.score - a.score);
                    if (scored.length > 0) headline = scored[0].t;
                }

                // Location — .text-body-small elements that look like location
                let location = null;
                const locCandidates = document.querySelectorAll('.text-body-small');
                for (const el of locCandidates) {
                    const t = el.innerText ? el.innerText.trim() : '';
                    if (t && t.length > 3 && t.length < 120 &&
                        (t.includes(',') || /\\b(Area|Region|Metro|Bay|United States|County|Province)\\b/.test(t))) {
                        location = t;
                        break;
                    }
                }

                // Connections
                let connections = null;
                const allText = document.body.innerText;
                const connMatch = allText.match(/(\\d[\\d,]*\\+?)\\s*connections/i);
                if (connMatch) connections = connMatch[1];

                // Photo URL — profile display photo
                let photoUrl = null;
                const imgs = document.querySelectorAll('img');
                for (const img of imgs) {
                    const src = img.src || '';
                    if (src.includes('profile-displayphoto') || src.includes('profile-framedphoto')) {
                        photoUrl = src;
                        break;
                    }
                }

                return { name, headline, location, connections, photoUrl };
            }""")

            content = await page.content()
            title = await page.title()
            await browser.close()

        name = data.get("name")
        headline = data.get("headline")
        location = data.get("location")
        connections = data.get("connections")
        photo_url = data.get("photoUrl")

        # Clean location — remove "·Contact info" suffix
        if location:
            location = re.split(r"[·•]\s*Contact", location)[0].strip()

        # Name fallback: title tag
        if not name and title:
            clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", title).strip()
            sep = re.search(r"\s[-–]\s", clean)
            if sep:
                name = clean[:sep.start()].strip()
                headline = headline or clean[sep.end():].strip()
            else:
                name = clean or None

        # Headline fallback: parse from OG title or page title
        if not headline and name:
            soup = BeautifulSoup(content, "lxml")
            og_title = _meta(soup, "og:title")
            if og_title:
                clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", og_title).strip()
                sep = re.search(r"\s[-–]\s", clean)
                if sep and clean[:sep.start()].strip() == name:
                    headline = clean[sep.end():].strip()

        # Headline fallback: rehydration JSON
        if not headline and name:
            ri = content.find("window.__como_rehydration__")
            if ri >= 0:
                end = content.find("</script>", ri)
                chunk = content[ri:end] if end > ri else content[ri:ri + 500_000]
                ni = chunk.find(name)
                if ni >= 0:
                    after = chunk[ni:ni + 4000]
                    matches = re.findall(r'children\\\":\[\\\"([^\"\\]{5,300})\\\"\\]', after)
                    for m in matches:
                        if m != name and "|" not in m and "<" not in m and "LinkedIn" not in m and len(m) > 8:
                            headline = m
                            break

        # Photo fallback: CDN URL in page source
        if not photo_url:
            imgs = re.findall(r"https://media\.licdn\.com/dms/image/[^\s\"'\\]+", content)
            if imgs:
                photo_url = imgs[0].split("\\")[0]

        if not name or name.lower() in ("linkedin", ""):
            return ProfileData(url=url, error="Could not extract profile data — page may be an auth wall or the URL is invalid")

        return ProfileData(
            url=url,
            name=name,
            headline=headline,
            photo_url=photo_url,
            location=location,
            connections=connections,
            error=None,
        )

    except Exception as e:
        return ProfileData(url=url, error=str(e)[:200])


# ─── Extract data from authenticated LinkedIn HTML page ───────────────────────
def _parse_authed_html(url: str, text: str) -> dict | None:
    """
    Parse the React SPA served when li_at cookie is present.
    LinkedIn now embeds profile JSON as HTML-entity-encoded data.
    Anchors on publicIdentifier (URL slug) to find the right profile block.
    Returns None if we can't extract a name.
    """
    import html as _html

    # Extract slug from URL (e.g. "weidatan" from /in/weidatan/)
    slug_m = re.search(r"linkedin\.com/(?:in|company)/([^/?&#\s]+)", url)
    if not slug_m:
        return None
    slug = slug_m.group(1).rstrip("/")

    # Unescape HTML entities — LinkedIn embeds JSON as &quot; etc.
    decoded = _html.unescape(text)

    # Find the publicIdentifier anchor — try URL slug first, fall back to least-frequent
    pid_pat = f'"publicIdentifier":"{slug}"'
    pid_idx = decoded.find(pid_pat)
    if pid_idx < 0:
        pid_idx = decoded.lower().find(pid_pat.lower())
    if pid_idx < 0:
        # Slug may differ from actual publicIdentifier (e.g. old vanity URL)
        # Find all publicIdentifiers; the logged-in user's appears most often
        all_pids = re.findall(r'"publicIdentifier":"([^"]+)"', decoded)
        if not all_pids:
            return None
        from collections import Counter
        counts = Counter(all_pids)
        # Take the least-frequent one that isn't the most common (logged-in user)
        most_common = counts.most_common()[0][0]
        candidates = [p for p in counts if p != most_common]
        if not candidates:
            return None
        target_slug = candidates[0]
        pid_idx = decoded.find(f'"publicIdentifier":"{target_slug}"')
        if pid_idx < 0:
            return None

    # Search a window around the anchor for profile fields
    window_start = max(0, pid_idx - 6000)
    window_end = min(len(decoded), pid_idx + 6000)
    chunk = decoded[window_start:window_end]

    # Name: firstName + lastName come AFTER publicIdentifier in the JSON object.
    # Only search forward to avoid picking up the logged-in user's data which appears earlier.
    forward = decoded[pid_idx: pid_idx + 6000]
    fn_matches = re.findall(r'"firstName":"([^"]+)"', forward)
    ln_matches = re.findall(r'"lastName":"([^"]+)"', forward)
    if not fn_matches or not ln_matches:
        return None
    fn = fn_matches[0]
    ln = ln_matches[0]
    name = f"{fn} {ln}".strip()
    if not name:
        return None

    # Headline: skip type URNs (start with "com." or "urn:")
    headline = None
    for m in re.finditer(r'"headline":"([^"]{5,250})"', chunk):
        val = m.group(1)
        if not re.match(r"^(com\.|urn:|https?://)", val):
            headline = val
            break

    # Location
    location = None
    loc_m = re.search(r'"geoLocationName":"([^"]+)"', chunk)
    if not loc_m:
        loc_m = re.search(r'"locationName":"([^"]+)"', chunk)
    if loc_m:
        location = loc_m.group(1)

    # Connections
    connections = None
    conn_m = re.search(r"([\d,]+\+?)\s*connections", chunk, re.I)
    if conn_m:
        connections = conn_m.group(1)

    # Photo: artifacts (fileIdentifyingUrlPathSegment) appear BEFORE rootUrl in the JSON.
    # Find rootUrl for a displayphoto (not background) then look backward for segments.
    photo_url = None
    for root_m in re.finditer(r'"rootUrl":"(https://media\.licdn\.com/dms/image/[^"]+profile-displayphoto[^"]*)"', chunk):
        root = root_m.group(1)
        before = chunk[max(0, root_m.start() - 2000): root_m.start()]
        segs = re.findall(r'"fileIdentifyingUrlPathSegment":"([^"]+)"', before)
        if segs:
            # prefer 200x200, else take the first
            seg = next((s for s in segs if "200_200" in s), segs[0])
            photo_url = root + seg
            break
    if not photo_url:
        # Fallback: look before publicIdentifier in a wider window
        pre_chunk = decoded[max(0, pid_idx - 300000): pid_idx + 6000]
        for root_m in re.finditer(r'"rootUrl":"(https://media\.licdn\.com/dms/image/[^"]+profile-displayphoto[^"]*)"', pre_chunk):
            root = root_m.group(1)
            before = pre_chunk[max(0, root_m.start() - 2000): root_m.start()]
            segs = re.findall(r'"fileIdentifyingUrlPathSegment":"([^"]+)"', before)
            if segs:
                seg = next((s for s in segs if "200_200" in s), segs[0])
                photo_url = root + seg
                break

    return {"url": url, "name": name, "headline": headline, "photo_url": photo_url,
            "location": location, "connections": connections,
            "company": None, "education": None, "error": None}


# ─── Requests-based scraper (sync) ────────────────────────────────────────────
def _scrape_url_blocking(
    url: str,
    session: "requests.Session",  # type: ignore[name-defined]
    max_retries: int,
) -> dict:
    """
    Scrape one URL.
    - If session has li_at: parse authenticated SPA HTML for full headline + photo.
    - If no li_at: parse public page OG tags (name + company + photo).
    """
    import requests

    li_at = session.cookies.get("li_at")

    backoff = 30
    last_err = "Unknown error"

    for attempt in range(max_retries + 1):
        try:
            resp = session.get(url, timeout=10, allow_redirects=True)
            resp.encoding = "utf-8"

            if resp.status_code in (999, 429):
                if attempt < max_retries:
                    wait = min(backoff * (2 ** attempt), 300)
                    last_err = f"Rate limited — retry {attempt + 1}/{max_retries} after {wait}s"
                    time.sleep(wait)
                    continue
                else:
                    last_err = "Rate limited (999)"
                    break

            if resp.status_code == 404:
                return {"url": url, "name": None, "headline": None, "photo_url": None,
                        "location": None, "connections": None, "error": "Profile not found (404)"}

            if resp.status_code != 200:
                last_err = f"HTTP {resp.status_code}"
                time.sleep(5)
                continue

            if "authwall" in resp.url or "login" in resp.url:
                return {"url": url, "name": None, "headline": None, "photo_url": None,
                        "location": None, "connections": None,
                        "error": "Auth wall — profile may be private"}

            # Authenticated page: LinkedIn serves React SPA — extract headline.
            # Then fetch the public page (no cookie) for og:image (auth tokens are 403).
            if li_at:
                parsed = _parse_authed_html(url, resp.text)
                if parsed:
                    # Fetch public page for photo + location + connections
                    try:
                        pub_session = session.__class__()
                        pub_session.headers.update(session.headers)
                        pub_resp = pub_session.get(url, timeout=10, allow_redirects=True)
                        if pub_resp.status_code == 200:
                            pub_soup = BeautifulSoup(pub_resp.text, "lxml")
                            og_image = _meta(pub_soup, "og:image")
                            if og_image:
                                parsed["photo_url"] = og_image
                            pub_desc = _meta(pub_soup, "og:description") or _meta(pub_soup, "description") or ""
                            if pub_desc:
                                loc_m = re.search(r"Location:\s*([^·\n]+)", pub_desc)
                                if loc_m:
                                    parsed["location"] = loc_m.group(1).strip()
                                conn_m = re.search(r"([\d,]+\+?)\s+connections", pub_desc, re.I)
                                if conn_m:
                                    parsed["connections"] = conn_m.group(1)
                                exp_m = re.search(r"Experience:\s*([^·\n]+)", pub_desc)
                                if exp_m:
                                    parsed["company"] = exp_m.group(1).strip()
                                edu_m = re.search(r"Education:\s*([^·\n]+)", pub_desc)
                                if edu_m:
                                    parsed["education"] = edu_m.group(1).strip()
                    except Exception:
                        pass
                    return parsed
                last_err = "No profile data in authenticated page"
                time.sleep(3)
                continue

            # Public page: parse OG tags
            soup = BeautifulSoup(resp.text, "lxml")
            name = headline = image = location = connections = company = education = None

            og_title = _meta(soup, "og:title")
            og_image = _meta(soup, "og:image")
            og_desc  = _meta(soup, "og:description") or _meta(soup, "description") or ""

            if og_title:
                clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", og_title).strip()
                sep = re.search(r"\s[-–]\s", clean)
                if sep:
                    name = clean[: sep.start()].strip()
                    headline = clean[sep.end():].strip()
                else:
                    name = clean
            if og_image:
                image = og_image

            # Parse description: "Experience: X · Education: Y · Location: Z · N+ connections"
            if og_desc:
                loc_m = re.search(r"Location:\s*([^·\n]+)", og_desc)
                if loc_m:
                    location = loc_m.group(1).strip()
                conn_m = re.search(r"([\d,]+\+?)\s+connections", og_desc, re.I)
                if conn_m:
                    connections = conn_m.group(1)
                exp_m = re.search(r"Experience:\s*([^·\n]+)", og_desc)
                if exp_m:
                    company = exp_m.group(1).strip()
                    if not headline:
                        headline = company
                edu_m = re.search(r"Education:\s*([^·\n]+)", og_desc)
                if edu_m:
                    education = edu_m.group(1).strip()

            if not name:
                title_tag = soup.find("title")
                if title_tag:
                    raw = title_tag.text.strip()
                    clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", raw).strip()
                    sep = re.search(r"\s[-–]\s", clean)
                    if sep:
                        name = clean[: sep.start()].strip()
                        headline = headline or clean[sep.end():].strip()
                    else:
                        name = clean or None

            if not image:
                imgs = re.findall(r"https://media\.licdn\.com/dms/image/[^\s\"'\\]+", resp.text)
                if imgs:
                    image = imgs[0].split("\\")[0]

            if not name or name.lower() in ("linkedin", ""):
                last_err = "No profile data extracted"
                time.sleep(5)
                continue

            return {"url": url, "name": name, "headline": headline, "photo_url": image,
                    "location": location, "connections": connections,
                    "company": company, "education": education, "error": None}

        except Exception as e:
            last_err = str(e)[:100]
            time.sleep(5)
            continue

    return {"url": url, "name": None, "headline": None, "photo_url": None,
            "location": None, "connections": None,
            "error": f"Failed after {max_retries} retries: {last_err}"}


# ─── Background worker for batch enrichment ───────────────────────────────────
async def _run_job(job_id: str, urls: list[str], li_at: str | None, user_agent: str | None, max_retries: int, session_id: str | None = None):
    import requests as _requests

    job = _jobs[job_id]
    job["status"] = "running"

    # Build URL → applicant_id map if session_id provided (for DB saves)
    url_to_applicant: dict[str, str] = {}
    if session_id:
        try:
            import db
            from routes.linkedin import normalize_linkedin_url as _norm
            applicants = db.scan_all_applicants(session_id=session_id)
            for a in applicants:
                raw = a.get("linkedin_url", "")
                if raw:
                    normed = normalize_linkedin_url(raw)
                    if normed:
                        url_to_applicant[normed] = a["applicant_id"]
        except Exception:
            pass  # DB lookup is best-effort

    async def _process_result(result_dict: dict) -> None:
        """Save result to DB if we have a matching applicant."""
        url = result_dict.get("url", "")
        applicant_id = url_to_applicant.get(url)
        if applicant_id and not result_dict.get("error"):
            try:
                import db
                fields: dict = {}
                if result_dict.get("name"):
                    fields["linkedin_name"] = result_dict["name"]
                if result_dict.get("headline"):
                    fields["linkedin_headline"] = result_dict["headline"]
                if result_dict.get("photo_url"):
                    fields["linkedin_image"] = result_dict["photo_url"]
                if result_dict.get("location"):
                    fields["linkedin_location"] = result_dict["location"]
                if fields:
                    db.update_applicant_fields(applicant_id, fields)
            except Exception:
                pass  # DB save is best-effort

    # Use requests approach (fast, Playwright as fallback per-profile if needed)
    ua = user_agent or DEFAULT_UA
    session = _requests.Session()
    session.headers.update({
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Cache-Control": "max-age=0",
    })
    if li_at:
        session.cookies.set("li_at", li_at, domain=".linkedin.com")

    loop = asyncio.get_event_loop()
    for i, url in enumerate(urls):
        if job.get("cancelled"):
            job["status"] = "cancelled"
            _emit(job, "cancelled", {"message": "Job cancelled by user", "completed": job["completed"], "total": job["total"]})
            return

        result_dict = await loop.run_in_executor(
            None, _scrape_url_blocking, url, session, max_retries,
        )
        await _process_result(result_dict)
        # Persist every result (success or failure) to DynamoDB
        try:
            import db as _db
            _db.save_linkedin_scrape(result_dict)
        except Exception:
            pass  # best-effort, never block the stream
        job["results"].append(result_dict)
        job["completed"] = i + 1
        job["events"].append(result_dict)
        if i < len(urls) - 1:
            await asyncio.sleep(0.5)  # minimal polite delay

    job["status"] = "done"


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/profile", response_model=ProfileData, summary="Scrape a single LinkedIn profile")
async def scrape_profile(body: ProfileRequest):
    """
    Scrape a single LinkedIn profile and return structured data.

    - **url**: LinkedIn profile URL (`/in/...` or `/company/...`)
    - **li_at**: LinkedIn session cookie — obtain from browser devtools → Application →
      Cookies → linkedin.com → `li_at`. **Rotate this when it expires or gets flagged.**
    - **user_agent**: Browser User-Agent string. **Rotate when Cloudflare blocks you.**
      Defaults to a standard Chrome/macOS UA.

    Strategy:
    1. Fast requests-based fetch (with cookie if provided) — parses og:title + rehydration JSON
    2. If that fails or returns no data, falls back to Playwright (full browser render)

    Returns: `name`, `headline`, `photo_url`, `location`, `connections`, `error`
    """
    norm = normalize_linkedin_url(body.url)
    if not norm:
        raise HTTPException(status_code=400, detail=f"Invalid LinkedIn URL: {body.url!r}")

    # Try fast requests approach first
    result = await _scrape_profile_requests(norm, body.li_at, body.user_agent)

    # Fall back to Playwright if requests got nothing useful
    if result.error or not result.name:
        playwright_result = await _scrape_with_playwright(norm, body.li_at, body.user_agent)
        if playwright_result.name:
            return playwright_result

    return result


@router.post("/enrich", response_model=EnrichResponse, summary="Batch-enrich multiple LinkedIn profiles")
async def enrich(body: EnrichRequest):
    """
    Submit a list of LinkedIn URLs for background enrichment.

    Returns a `job_id`. Poll `GET /linkedin/jobs/{job_id}` or
    stream results via `GET /linkedin/stream/{job_id}`.

    - **li_at**: LinkedIn session cookie (optional but strongly recommended)
    - **user_agent**: Override User-Agent string (rotate when flagged)
    - **max_retries**: Max retries per URL on 999/429 rate-limit (default 6)
    """
    seen: set[str] = set()
    valid: list[str] = []
    invalid: list[str] = []

    for raw in body.urls:
        norm = normalize_linkedin_url(raw)
        if norm and norm not in seen:
            seen.add(norm)
            valid.append(norm)
        else:
            invalid.append(raw)

    if not valid:
        raise HTTPException(status_code=400, detail="No valid LinkedIn URLs provided")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "total": len(valid),
        "completed": 0,
        "results": [],
        "invalid": invalid,
        "events": [],
        "created_at": time.time(),
        "cancelled": False,
    }

    asyncio.create_task(_run_job(job_id, valid, body.li_at, body.user_agent, body.max_retries, body.session_id))

    return EnrichResponse(
        job_id=job_id,
        total=len(valid),
        message=(
            f"Enrichment started for {len(valid)} URLs "
            f"({len(invalid)} invalid/skipped). "
            f"Poll GET /linkedin/jobs/{job_id} or stream GET /linkedin/stream/{job_id}"
        ),
    )


@router.post("/jobs/{job_id}/cancel", summary="Cancel a running enrichment job")
async def cancel_job(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    _jobs[job_id]["cancelled"] = True
    return {"detail": "Cancellation requested"}


@router.get("/jobs/{job_id}", summary="Poll batch enrichment job status")
async def get_job(job_id: str):
    """Poll enrichment job status and results."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job_id,
        "status": job["status"],
        "total": job["total"],
        "completed": job["completed"],
        "results": job["results"],
        "invalid": job["invalid"],
    }


@router.get("/database", summary="List all records in the linkedin-scrapes table")
async def get_database():
    """Return all scraped profiles from DynamoDB, sorted by scraped_at desc."""
    import db as _db
    from config import linkedin_scrapes_table
    response = linkedin_scrapes_table.scan()
    items = response.get("Items", [])
    while "LastEvaluatedKey" in response:
        response = linkedin_scrapes_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    items.sort(key=lambda x: x.get("scraped_at", ""), reverse=True)
    return {"items": items, "count": len(items)}


@router.get("/proxy-image", summary="Proxy a LinkedIn CDN image to bypass CORS")
async def proxy_image(url: str = Query(..., description="LinkedIn CDN image URL to proxy")):
    """Fetch a LinkedIn CDN image server-side and return it, bypassing browser CORS restrictions."""
    import requests as _req
    if "licdn.com" not in url and "linkedin.com" not in url:
        raise HTTPException(status_code=400, detail="Only LinkedIn CDN URLs are allowed")
    try:
        resp = _req.get(url, timeout=10, headers={
            "User-Agent": DEFAULT_UA,
            "Referer": "https://www.linkedin.com/",
        })
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Image fetch failed")
        ct = resp.headers.get("content-type", "image/jpeg")
        return Response(content=resp.content, media_type=ct)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/stream/{job_id}", summary="SSE stream of batch enrichment results")
async def stream_job(job_id: str):
    """
    Server-Sent Events stream — yields each profile result as it arrives,
    then a final `done` event.

    Connect with `EventSource` or `fetch()` with `text/event-stream`.
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def generate():
        sent = 0
        while True:
            events = job["events"]
            while sent < len(events):
                ev = events[sent]
                sent += 1
                yield f"data: {json.dumps(ev)}\n\n"

            if job["status"] == "done" and sent >= len(job["events"]):
                yield f"event: done\ndata: {json.dumps({'total': job['total'], 'completed': job['completed']})}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(generate(), media_type="text/event-stream")
