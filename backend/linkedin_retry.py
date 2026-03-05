#!/usr/bin/env python3
"""
LinkedIn Retry Scraper
Retries only the failed profiles from linkedin_results.json.
Uses li_at cookie + authenticated SPA HTML parsing (title tag + rehydration script).
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os

# New cookie passed via env: LI_AT='...' python3 linkedin_retry.py
LI_AT_COOKIE = os.environ.get("LI_AT", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}

DELAY = 8.0  # longer delay to avoid rate limits


def _meta(soup, prop):
    tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
    return tag.get("content", "").strip() if tag else None


def scrape(url, session):
    try:
        resp = session.get(url, timeout=20, allow_redirects=True)

        if resp.status_code in (999, 429):
            return None, "Rate limited (999/429)"
        if resp.status_code == 404:
            return None, "Profile not found (404)"
        if resp.status_code != 200:
            return None, f"HTTP {resp.status_code}"
        if "authwall" in resp.url or "login" in resp.url:
            return None, "Auth wall — profile private or cookie bad"

        soup = BeautifulSoup(resp.text, "lxml")
        text = resp.text

        name = headline = image = None

        # ── Try OG tags first (public view) ──────────────────────────────────
        og_title = _meta(soup, "og:title")
        og_image = _meta(soup, "og:image")

        if og_title:
            clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", og_title).strip()
            sep = re.search(r"\s[-–]\s", clean)
            if sep:
                name = clean[:sep.start()].strip()
                headline = clean[sep.end():].strip()
            else:
                name = clean
        if og_image:
            image = og_image

        # ── Fallback: authenticated SPA view ──────────────────────────────────
        if not name:
            title_tag = soup.find("title")
            if title_tag:
                raw = title_tag.text.strip()
                clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", raw).strip()
                sep = re.search(r"\s[-–]\s", clean)
                if sep:
                    name = clean[:sep.start()].strip()
                    headline = headline or clean[sep.end():].strip()
                else:
                    name = clean or None

        # ── Headline from rehydration script ──────────────────────────────────
        if not headline and name:
            rehy_idx = text.find("window.__como_rehydration__")
            if rehy_idx >= 0:
                end = text.find("</script>", rehy_idx)
                chunk = text[rehy_idx:end] if end > rehy_idx else text[rehy_idx:rehy_idx+500_000]
                ni = chunk.find(name)
                if ni >= 0:
                    after = chunk[ni:ni+4000]
                    matches = re.findall(r'children\\":\[\\"([^"\\]{5,200})\\"\]', after)
                    for m in matches:
                        if m != name and "|" not in m and "<" not in m and "LinkedIn" not in m:
                            headline = m
                            break

        # ── Image fallback ────────────────────────────────────────────────────
        if not image:
            imgs = re.findall(r"https://media\.licdn\.com/dms/image/[^\s\"'\\]+", text)
            if imgs:
                image = imgs[0].split("\\")[0]

        if not name or name.lower() in ("linkedin", ""):
            return None, "No data found"

        return {"url": url, "name": name, "headline": headline, "image": image, "error": None}, None

    except requests.exceptions.TooManyRedirects:
        return None, "Too many redirects"
    except requests.exceptions.Timeout:
        return None, "Timeout"
    except Exception as e:
        return None, str(e)


def main():
    results_path = os.path.join(os.path.dirname(__file__), "linkedin_results.json")
    with open(results_path) as f:
        existing = json.load(f)

    # Find failed entries (have error AND have a url)
    failed = [r for r in existing if r.get("error") and r.get("url") and
              r["url"].startswith("http")]

    print(f"🔁  Retrying {len(failed)} failed profiles...")

    session = requests.Session()
    session.headers.update(HEADERS)
    if LI_AT_COOKIE:
        session.cookies.set("li_at", LI_AT_COOKIE, domain=".linkedin.com")
        print("🍪  Using li_at cookie (authenticated view)")
    else:
        print("🔓  No cookie — using public view")

    # Build lookup by URL for easy merge
    by_url = {r["url"]: r for r in existing}

    improved = 0
    for i, rec in enumerate(failed):
        url = rec["url"]
        print(f"[{i+1:>3}/{len(failed)}] {url}")
        result, err = scrape(url, session)
        if result:
            by_url[url] = result
            improved += 1
            print(f"       ✅ {result['name']} | {result['headline'] or ''}")
        else:
            print(f"       ❌ {err}")

        if i < len(failed) - 1:
            time.sleep(DELAY)

    # Write merged results back
    merged = list(by_url.values())
    with open(results_path, "w") as f:
        json.dump(merged, f, indent=2)

    ok = len([r for r in merged if not r.get("error")])
    print(f"\n✅ Fixed {improved} more.  Total scraped: {ok}/{len(merged)}")
    print(f"💾  Saved to {results_path}")


if __name__ == "__main__":
    main()
