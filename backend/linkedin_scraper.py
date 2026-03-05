#!/usr/bin/env python3
"""
LinkedIn Profile Scraper
Extracts name, headline, and profile image from LinkedIn profiles.

Uses the public (unauthenticated) profile view which serves OG meta tags
for SEO. This is more reliable than the authenticated SPA view and avoids
session-cookie rate limits.
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import sys
import os
from urllib.parse import urlparse

# ─── CONFIG ───────────────────────────────────────────────────────────────────
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

DELAY_BETWEEN_REQUESTS = 3.0  # seconds — be polite to LinkedIn


# ─── URL CLEANER ──────────────────────────────────────────────────────────────
def normalize_url(raw: str) -> str | None:
    """Normalize a raw LinkedIn URL. Returns None if invalid."""
    url = raw.strip()

    # Skip garbage
    if not url or url.startswith("@") or url.startswith("#") or " " in url:
        return None
    if url.startswith("https://x.com") or url.startswith("http://x.com"):
        return None
    if url in ("https://www.linkedin.com", "https://linkedin.com"):
        return None

    # Add scheme if missing
    for prefix in ("linkedin.com/", "www.linkedin.com/"):
        if url.startswith(prefix):
            url = "https://www." + url.lstrip("www.")
            break
    if url.startswith("linked.com/"):
        return None  # wrong domain, unfixable

    # Must be http/https by now
    if not url.startswith("http"):
        return None

    # Enforce linkedin.com domain
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    if "linkedin.com" not in parsed.netloc:
        return None

    # Must have /in/ or /company/ path
    match = re.search(r"linkedin\.com/(in|company)/([^/?&#\s]+)", url)
    if not match:
        return None

    profile_type = match.group(1)
    profile_id = match.group(2).rstrip("/")
    return f"https://www.linkedin.com/{profile_type}/{profile_id}/"


# ─── SCRAPER ──────────────────────────────────────────────────────────────────
def scrape_profile(url: str, session: requests.Session) -> dict:
    """Fetch a LinkedIn public profile and extract name, headline, image via OG tags.

    LinkedIn's public (unauthenticated) view serves Open Graph meta tags for SEO:
      - og:title  → "Name - Company/Role | LinkedIn"
      - og:image  → profile photo CDN URL
    """
    try:
        resp = session.get(url, timeout=15, allow_redirects=True)

        if resp.status_code == 999:
            return _err(url, "Rate limited by LinkedIn (999) — wait a bit")
        if resp.status_code == 429:
            return _err(url, "Rate limited by LinkedIn (429) — wait a bit")
        if resp.status_code == 404:
            return _err(url, "Profile not found (404)")
        if resp.status_code != 200:
            return _err(url, f"HTTP {resp.status_code}")

        if "authwall" in resp.url or "login" in resp.url:
            return _err(url, "Redirected to auth wall — profile may be private")

        soup = BeautifulSoup(resp.text, "lxml")

        name = headline = image = None

        # ── Primary: Open Graph tags ──────────────────────────────────────────
        og_title = _meta(soup, "og:title")
        og_image = _meta(soup, "og:image")

        if og_title:
            # Format: "Name - Company/Role | LinkedIn"  or  "Name | LinkedIn"
            clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", og_title).strip()
            sep = re.search(r"\s[-–]\s", clean)
            if sep:
                name     = clean[: sep.start()].strip()
                headline = clean[sep.end():].strip()
            else:
                name = clean

        if og_image:
            image = og_image

        # ── Fallback: title tag ───────────────────────────────────────────────
        if not name:
            title_tag = soup.find("title")
            if title_tag:
                raw = title_tag.text.strip()
                clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", raw).strip()
                sep = re.search(r"\s[-–]\s", clean)
                if sep:
                    name     = clean[: sep.start()].strip()
                    headline = headline or clean[sep.end():].strip()
                else:
                    name = clean or None

        # ── Image fallback: media.licdn.com CDN ───────────────────────────────
        if not image:
            matches = re.findall(
                r"https://media\.licdn\.com/dms/image/[^\s\"'\\]+", resp.text
            )
            if matches:
                image = matches[0].split("\\")[0]

        if not name or name.lower() in ("linkedin", ""):
            return _err(url, "No profile data — may be private or restricted")

        return {
            "url":      url,
            "name":     name,
            "headline": headline,
            "image":    image,
            "error":    None,
        }

    except requests.exceptions.TooManyRedirects:
        return _err(url, "Too many redirects — profile may be restricted")
    except requests.exceptions.Timeout:
        return _err(url, "Request timed out")
    except Exception as e:
        return _err(url, str(e))


def _meta(soup: BeautifulSoup, prop: str) -> str | None:
    tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
    return tag.get("content", "").strip() if tag else None


def _err(url: str, msg: str) -> dict:
    return {"url": url, "name": None, "headline": None, "image": None, "error": msg}


# ─── RAW URLS ─────────────────────────────────────────────────────────────────
RAW_URLS = """
https://linkedin.com/in/weidatan
https://www.linkedin.com/in/caglakaymaz/
https://www.linkedin.com/in/chris-rowen-4310a61/
https://www.linkedin.com/in/yonghuima/
https://www.linkedin.com/in/shahjaidev?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app
https://www.linkedin.com/in/tomo-datumix/
https://www.linkedin.com/in/ravikant-dintyala
https://www.linkedin.com/in/duoding1/
https://www.linkedin.com/in/baranatmanoglu
https://www.linkedin.com/in/jacobsmith24/
https://www.linkedin.com/in/alimgiga/
https://www.linkedin.com/in/chrischenlf
https://www.linkedin.com/in/jeremy-nin-a0673912b/
https://linkedin.com/in/lisayu
https://linkedin.com/in/annay
https://www.linkedin.com/in/ethankuhlkin/
https://www.linkedin.com/in/riya-jain-1b87016a/
https://www.linkedin.com/in/hdeshays/
https://linkedin.com/in/djl2021
https://www.linkedin.com/in/julianchu
https://www.linkedin.com/in/vipinchawla
https://www.linkedin.com/in/puneetchopra77
https://www.linkedin.com/in/siyujia9
http://www.linkedin.com/in/mnathan
https://www.linkedin.com/in/aadik-shekar-b1a58834?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app
https://www.linkedin.com/in/wilsonlin1/
https://www.linkedin.com/in/sharmin-ali
https://www.linkedin.com/in/miri-k-193683177
https://www.linkedin.com/in/amilkhanzada
http://linkedin.com/in/allenqilinhu
https://www.linkedin.com/in/marlasofer/
https://www.linkedin.com/in/edwardskristy/
https://www.linkedin.com/in/daisukenogiwa/
https://www.linkedin.com/in/ewading
https://linkedin.com/in/michaelharries
https://www.linkedin.com/in/tomnieman1/
https://www.linkedin.com/in/shreyasgosalia
https://www.linkedin.com/in/xueting-sunny-zhang?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app
https://www.linkedin.com/in/deriantokusuma/
https://linkedin.com/in/ipsheeta
https://www.linkedin.com/in/wenjiefu
https://www.linkedin.com/company/apertucapital
https://linkedin.com/in/ivannikolov
http://linked.com/in/kamwong00283
https://www.linkedin.com/in/alspark
https://www.linkedin.com/in/conniexu
https://wee
https://linkedin.com/in/joan-kim-3000
https://www.linkedin.com/in/helenajuewang/
https://www.linkedin.com/in/ling-li-9a035a42
https://www.linkedin.com/in/lakedai/
https://www.linkedin.com/in/monicaxie/
https://linkedin.com/in/ryotasekine
https://linkedin.com/in/pbanavara
https://www.linkedin.com/in/kathytwang/
https://www.linkedin.com/in/chan-garrett
https://linkedin.com/in/jamesmurdza
https://www.linkedin.com/in/ivyknguyen
linked.com/in/sshah8
https://www.linkedin.com/in/jonathan-o-connell-3269537/
https://www.linkedin.com/in/anchitjaincfa/
https://www.linkedin.com/in/joshueberroth/
https://www.linkedin.com/in/linusliang/
https://www.linkedin.com/in/franklinmarcelo
https://www.linkedin.com/in/pietrodecio/
https://linkedin.com/in/nhattnguyen
https://linkedin.com/in/hilkemeyer
https://www.linkedin.com/in/brijeshdutta
https://linkedin.com/in/brandonin
http://www.linkedin.com/in/sheelaursal
https://linkedin.com/in/karmani
https://www.linkedin.com/in/junguang-peter-pan-1254a359/
https://www.linkedin.com/in/jnelligan/
https://www.linkedin.com/in/marcoboerries/
https://www.linkedin.com
http://linkedin.com/in/armenb
https://www.linkedin.com/in/nicolaselbaze/
https://www.linkedin.com/in/lidiyadervisheva/
https://www.linkedin.com/in/benjaminhutchinson/
https://linkedin.com/in/peterkofsky
https://www.linkedin.com/in/pjlconsulting/
https://www.linkedin.com/in/mark-klibanov-60a9626a/
https://www.linkedin.com/in/huili-c-a0b99784?
https://www.linkedin.com/in/lonnissa-nguyen
https://www.linkedin.com/in/elkingtonjoshua
https://in/eric-ng-7b9674322
https://www.linkedin.com/in/sankari-dhandapani-483b43b/
https://www.linkedin.com/in/elaine-prosgrow
https://linkedin.com/in/johndeeptech
http://www.linkedin.com/sergey-q-630639160
https://www.linkedin.com/in/jiayangcheng/
https://x.com/humnint
https://www.linkedin.com/in/jacob-smith-a21a61259
https://www.linkedin.com/in/sruthi-davuluri/
https://www.linkedin.com/in/rachit-nandwani/
https://linkedin.com/in/calexkaufman
tiffinewang
https://www.linkedin.com/in/pragyasaboo?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app
https://linkedin.com/in/sgovindgari
https://www.linkedin.com/in/paul-shaburov-5a24bb210/
https://linkedin.com/in/xin-eagle-tong/
https://www.linkedin.com/in/sunna-mo-1777a2101/
nataliepan
https://www.linkedin.com/in/deborahpandra/
https://www.linkedin.com/in/tobias-boelter/
https://www.linkedin.com/in/mohak-saxena/
https://www.linkedin.com/in/akash-agg/
https://www.linkedin.com/in/gracewenge/
@anuragranj
https://linkedin.com/in/lksq
https://www.linkedin.com/in/diana-kotenko-761b4093/
https://www.linkedin.com/in/hao-xue-aiecd/
https://www.linkedin.com/in/jakesc
""".strip().splitlines()


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    # Set up session (no cookie needed — public view has OG tags)
    session = requests.Session()
    session.headers.update(HEADERS)

    # Normalize URLs
    valid, invalid = [], []
    seen = set()
    for raw in RAW_URLS:
        normalized = normalize_url(raw)
        if normalized and normalized not in seen:
            seen.add(normalized)
            valid.append(normalized)
        else:
            invalid.append(_err(raw.strip(), "Invalid / unparseable URL"))

    print(f"✅  Valid URLs:   {len(valid)}")
    print(f"❌  Invalid URLs: {len(invalid)}")
    print(f"🔍  Scraping {len(valid)} profiles...\n")

    results = []
    for i, url in enumerate(valid):
        print(f"[{i+1:>3}/{len(valid)}] {url}")
        result = scrape_profile(url, session)
        results.append(result)

        status = "✅" if not result["error"] else "❌"
        print(f"       {status} {result['name'] or ''} | {result['headline'] or result['error'] or ''}")

        if i < len(valid) - 1:
            time.sleep(DELAY_BETWEEN_REQUESTS)

    all_results = results + [r for r in invalid if r["url"]]

    # Save JSON
    out_path = os.path.join(os.path.dirname(__file__), "linkedin_results.json")
    with open(out_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n💾  Saved to {out_path}")

    # Print summary table
    ok  = [r for r in results if not r["error"]]
    err = [r for r in results if r["error"]]
    print(f"\n{'─'*100}")
    print(f"{'URL':<55} {'NAME':<25} {'HEADLINE'}")
    print(f"{'─'*100}")
    for r in sorted(results, key=lambda x: (x["error"] is not None, x["url"])):
        short_url = r["url"][-52:] if len(r["url"]) > 52 else r["url"]
        name      = (r["name"]     or "")[:23]
        headline  = (r["headline"] or r["error"] or "")[:55]
        flag      = "✅" if not r["error"] else "❌"
        print(f"{flag} {short_url:<53} {name:<25} {headline}")

    print(f"\n{'─'*100}")
    print(f"✅ Success: {len(ok)}   ❌ Failed: {len(err)}   ⚠️  Invalid URLs: {len(invalid)}")


if __name__ == "__main__":
    main()
