#!/usr/bin/env python3
"""
Third pass: get headlines for profiles that have names but no headline.
Uses public (no-cookie) view which has og:title with company name.
Slow rate: 12s between requests.
Also fixes response encoding.
"""
import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Cache-Control": "max-age=0",
}

DELAY = 12.0


def _meta(soup, prop):
    tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
    return tag.get("content", "").strip() if tag else None


def get_headline_and_image(url, session):
    try:
        resp = session.get(url, timeout=20, allow_redirects=True)
        resp.encoding = "utf-8"  # force UTF-8 to avoid latin-1 mojibake

        if resp.status_code in (999, 429):
            return None, None, "rate_limited"
        if resp.status_code != 200:
            return None, None, f"http_{resp.status_code}"
        if "authwall" in resp.url or "login" in resp.url:
            return None, None, "auth_wall"

        soup = BeautifulSoup(resp.text, "lxml")
        headline = image = None

        og_title = _meta(soup, "og:title")
        og_image = _meta(soup, "og:image")

        if og_title:
            clean = re.sub(r"\s*\|\s*LinkedIn\s*$", "", og_title).strip()
            sep = re.search(r"\s[-–]\s", clean)
            if sep:
                headline = clean[sep.end():].strip()

        if og_image:
            image = og_image

        if not image:
            imgs = re.findall(r"https://media\.licdn\.com/dms/image/[^\s\"'\\]+", resp.text)
            if imgs:
                image = imgs[0].split("\\")[0]

        return headline, image, None

    except Exception as e:
        return None, None, str(e)[:60]


def main():
    results_path = os.path.join(os.path.dirname(__file__), "linkedin_results.json")
    with open(results_path) as f:
        data = json.load(f)

    # Profiles with name but no headline
    targets = [r for r in data if not r.get("error") and r.get("name")
               and not r.get("headline") and r.get("url", "").startswith("http")]

    print(f"🔍  Getting headlines for {len(targets)} profiles (12s delay each)...")

    session = requests.Session()
    session.headers.update(HEADERS)

    by_url = {r["url"]: r for r in data}
    improved = 0

    for i, rec in enumerate(targets):
        url = rec["url"]
        print(f"[{i+1:>3}/{len(targets)}] {url}")
        headline, image, err = get_headline_and_image(url, session)

        if err == "rate_limited":
            print(f"       ⏳ Rate limited — skipping")
        elif err:
            print(f"       ❌ {err}")
        else:
            if headline:
                by_url[url]["headline"] = headline
                improved += 1
            if image and not by_url[url].get("image"):
                by_url[url]["image"] = image
            print(f"       ✅ headline: {headline or '(none)'}")

        if i < len(targets) - 1:
            time.sleep(DELAY)

    merged = list(by_url.values())
    with open(results_path, "w") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    ok = len([r for r in merged if not r.get("error")])
    with_headline = len([r for r in merged if r.get("headline")])
    print(f"\n✅ Added headlines for {improved} profiles.")
    print(f"📊 Scraped: {ok}, with headline: {with_headline}/{ok}")
    print(f"💾  Saved to {results_path}")


if __name__ == "__main__":
    main()
