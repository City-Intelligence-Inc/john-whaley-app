# CLAUDE.md

## Greeting

On conversation start, check the GitHub username:
```bash
gh api user --jq .login
```
- If the username is `stardrop-cli` or `nikkilin16`, greet them with: **"Hi Nikki!"**

## Project Overview

This is **Selecta** (john-whaley-app) — an AI-powered event applicant review/selection platform for Inception Studio.

## Tech Stack

- **Frontend Web:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui, Clerk auth
- **Frontend Mobile:** Expo (React Native), Expo Router, NativeWind, Clerk Expo SDK
- **Backend:** FastAPI (Python), uvicorn
- **Database:** AWS DynamoDB (4 tables: applicants, sessions, settings, linkedin-scrapes)
- **Storage:** S3 (`john-whaley-linkedin-photos` bucket for profile photos)
- **Auth:** Clerk (JWT tokens)

## Running Locally

```bash
# Backend
cd backend && uvicorn main:app --reload --port 8000

# Frontend
cd frontend/web-app && pnpm dev --port 3000
```

## Key Directories

- `backend/` — FastAPI app, routes, db helpers, AI analysis pipeline
- `frontend/shared/` — Shared TypeScript types, constants, judge personas (used by web + mobile)
- `frontend/web-app/` — Next.js web app
- `frontend/web-app/app/(app)/events/` — Event-centric pages (event list, workspace, analyze, settings)
- `frontend/web-app/app/(app)/linkedin/` — LinkedIn database browser
- `frontend/web-app/app/(app)/settings/` — Global settings (API keys, personas)
- `frontend/web-app/app/(marketing)/` — Landing page
- `frontend/web-app/components/` — UI components (app-shell, event-provider, applicant-table, etc.)
- `frontend/mobile/` — Expo React Native mobile app
- `infra/` — Terraform IaC (DynamoDB, App Runner, etc.)
- `tools/` — Standalone HTML scraper tools (linkedin-manual-add, linkedin-scraper, linkedin-db-viewer)
- `data/` — CSVs, tickets, and other project data files
- `testing/` — Tests

## DynamoDB Tables

- `john-whaley-applicants` — Guest/applicant records (key: `applicant_id`, GSI: `session-index`)
- `john-whaley-sessions` — Events/sessions (key: `session_id`)
- `john-whaley-settings` — Key-value config store (key: `setting_id`)
- `linkedin-scrapes` — LinkedIn profile cache (key: `url`)

## Important Patterns

- Several endpoints are mounted without auth in `main.py` for local dev (sessions, settings, linkedin/database, manual-scrape, scrape-one)
- The auth-protected routers are mounted AFTER no-auth endpoints so the no-auth versions take priority
- LinkedIn manual scrapes go through `_parse_linkedin_paste()` in `db.py` which strips nav/footer junk and extracts structured sections
- Profile photos are uploaded to S3 as base64 and stored as public URLs
- The analysis pipeline merges global + per-event whitelist/blacklist before scoring

## Deployed Backend

- **App Runner URL:** `https://aicm3pweed.us-east-1.awsapprunner.com`
- **ECR image:** `050451400186.dkr.ecr.us-east-1.amazonaws.com/john-whaley-backend:latest`
- **Deploy flow:** `docker build --platform linux/amd64 -t <ecr-url> backend/` → `docker push <ecr-url>` → `aws apprunner start-deployment --service-arn arn:aws:apprunner:us-east-1:050451400186:service/john-whaley-backend/5c7bdf6d38694a539210c02dc242cf06 --region us-east-1`
- HTML scraper tools (`tools/linkedin-manual-add.html`, `tools/linkedin-scraper.html`) POST to the deployed URL, no local backend needed
- CORS is set to `allow_origins=["*"]` so file:// HTML tools work

## LinkedIn Scrape DB Cleanup Procedure

When the user asks to "clean" or "fix" the linkedin-scrapes table, follow this procedure:

### 1. Audit
```python
# Scan all profiles, flag ones missing key fields
import boto3
table = boto3.resource('dynamodb', region_name='us-east-1').Table('linkedin-scrapes')
items = table.scan()['Items']
for item in items:
    # Check: name, headline, location, experience, education, about, photo_url
    # Flag if headline is missing, is a duplicate of name, or contains junk like "badgeType"
```

### 2. Re-parse from raw_content
Every profile has `raw_content` (the full LinkedIn paste). Use `_parse_linkedin_paste()` logic to extract structured fields. Common issues:
- **"Retry Premium" / "Try Premium" as name** — nav junk not stripped. Fix: skip lines matching nav markers before picking the name.
- **Headline = name repeated** — parser grabbed the wrong line. Fix: skip lines that match the name exactly.
- **"2nd degree connection" as headline** — UI junk leaked through. Fix: filter out lines containing "degree connection".
- **"badgeType" in headline** — LinkedIn badge markup. Fix: filter lines containing "badgeType".
- **Location has "Contact info" appended** — strip it: `loc.replace("Contact info", "").strip()`
- **Missing experience/education/about** — usually means the paste was too short (user only pasted header, not full page). These can't be fixed without re-scraping. Note them but don't flag as errors.

### 3. Update DynamoDB
```python
# Only update fields that are missing or bad — never overwrite good data
table.update_item(
    Key={'url': url},
    UpdateExpression="SET #field = :val",
    ExpressionAttributeNames={"#field": "headline"},
    ExpressionAttributeValues={":val": "actual headline"},
)
```

### 4. Known nav/UI junk to always filter
```
Try Premium, Retry Premium, Reactivate Premium, For Business, Get the app,
Home, My Network, Jobs, Messaging, Notifications, Post, Profile, Search,
Open to, 1st, 2nd, 3rd, Pending, Message, Connect, Follow, Cover photo,
Show credential, Show all, Like, Comment, Repost, Send,
"degree connection", "badgeType", "Contact info"
```

### 5. Footer markers (stop parsing here)
```
More profiles for you, People also viewed, Explore premium profiles,
LinkedIn Corporation, Talent Solutions, Community Guidelines,
Marketing Solutions, Accessibility
```

### 6. Expected clean profile fields
| Field | Source | Required |
|-------|--------|----------|
| name | First real line after nav | yes |
| headline | First long line (>10 chars) after name, not matching name | yes |
| location | Line with city/region keywords | nice to have |
| connections | Regex: `(\d[\d,]*\+?)\s*connections` | nice to have |
| about | "About" section content | nice to have |
| experience | "Experience" section content | important |
| company | First line of Experience | nice to have |
| education | "Education" section content | important |
| skills | "Skills" section content | nice to have |
| certifications | "Licenses & certifications" section | nice to have |
| languages | "Languages" section | nice to have |
| photo_url | S3 URL from uploaded base64 | nice to have |

### 7. Updating the HTML scraper queue
When a new CSV is provided (from Luma), update `CSV_PROFILES` in `tools/linkedin-manual-add.html` and `PROFILES` in `tools/linkedin-scraper.html`:
```python
import csv, json
profiles = []
with open('path/to/csv', encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        name, email = row.get('name','').strip(), row.get('email','').strip()
        url = row.get('What is your LinkedIn profile?','').strip()
        if name and url:
            profiles.append({'name': name, 'email': email, 'url': url})
print(json.dumps(profiles, ensure_ascii=False))
```

## CLI LinkedIn Scraping Flow (with Claude Code)

Manual scraping workflow: Ari pastes LinkedIn profiles into Claude Code CLI, Claude saves them to the backend.

### Quick-start (when Ari says "let's scrape" or "add profiles")

1. **Check what's already scraped** — hit `GET /linkedin/database` and compare against `CSV_PROFILES` in `tools/linkedin-manual-add.html`
2. **Show the first remaining URL** — print it so Ari can open it in Chrome
3. **Wait for paste** — Ari does Cmd+A → Cmd+C on the LinkedIn page and pastes the raw text
4. **Save immediately** — write paste to `/tmp/li_paste.txt`, POST to backend, print confirmation
5. **Show next URL** — repeat until done or Ari says stop

### What Claude does when it receives a paste

When Ari pastes a wall of text that looks like LinkedIn content (contains things like "Experience", "Education", "connections", degree indicators, etc.), Claude should:

1. **Identify which profile this is for** — use the URL that was just shown to Ari
2. **Save it** by running this command (fill in url/name/email from the CSV list):

```bash
cat << 'PASTE_EOF' > /tmp/li_paste.txt
<the pasted content>
PASTE_EOF

python3 -c "
import json, urllib.request
content = open('/tmp/li_paste.txt').read()
payload = json.dumps({
    'url': '<linkedin-url>',
    'name': '<name-from-csv>',
    'email': '<email-from-csv>',
    'content': content
}).encode()
req = urllib.request.Request(
    'https://aicm3pweed.us-east-1.awsapprunner.com/linkedin/manual-scrape',
    data=payload,
    headers={'Content-Type': 'application/json'}
)
resp = urllib.request.urlopen(req, timeout=30)
d = json.loads(resp.read())
print(f'OK | {d.get(\"name\")} | {d.get(\"url\")}')
"
```

3. **Print confirmation + next URL** in this format:
```
✓ Saved [Name] — [N] of [Total] done
→ Next: [Name] — [next-linkedin-url]
Open ↑ in Chrome, Cmd+A, Cmd+C, paste here
```

### Key rules
- **Don't ask questions** — just save the paste and show the next URL
- **Don't summarize the paste content** — just confirm it saved
- **If the paste looks too short** (< 20 lines), warn but still save it
- **If Ari pastes without a URL context**, ask which profile it's for
- **DynamoDB key is `url`** — re-saving same URL overwrites (safe to retry)
- **Name/email come from CSV list**, not from parsing the paste
- **Photos are skipped** in this flow — added later via `tools/linkedin-manual-add.html`
- **DB cleanup happens separately** — Ari will ask to parse `raw_content` into structured fields later

## CS 224G Demo Day LinkedIn Scrape — COMPLETED

All scrapeable profiles have been added to the DB.

### Skipped/404 profiles (could not scrape):
- Jiaming Liu — wrong URL
- David Ye — 404
- Dana Ishkova — 404
- Christina Xu — 404
- Carey Yuan — 404
- Michelle Miao — wrong URL (linkedin.com/in/aaa)
- Shin, Michael Chen, Indre Altman — skipped by user
- Adil Nemat — /school/ URL (not a personal profile)
- sam (cepom3@boxfi.uk) — empty /in/ slug
