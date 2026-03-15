# CLAUDE.md

## Greeting

On conversation start, check the GitHub username:
```bash
gh api user --jq .login
```
- If the username is `stardrop-cli` or `nikkilin16`, greet them with: **"Hi Nikki!"**

## Project Overview

This is the **john-whaley-app** — an AI-powered event applicant review/selection platform for Inception Studio.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui, Clerk auth
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
- `frontend/web-app/` — Next.js app
- `frontend/web-app/app/dashboard/` — Main pages (review, calendar, linkedin, settings, admin)
- `frontend/web-app/components/` — UI components (app-shell.tsx has the sidebar layout)

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
