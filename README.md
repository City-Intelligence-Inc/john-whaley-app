# CS 224G Demo Day — Applicant Review Tool

AI-powered applicant review tool for Stanford's CS 224G Demo Day (Winter 2026). Import applicant lists from CSV or Google Sheets, classify and score them with LLMs, and make accept/waitlist/reject decisions at scale.

> @stardroplin I want an Event Applicant Reviewer that allows me to quickly review event applicants and accept/reject/waitlist them. I want to be able to automatically pull their LinkedIn/social profiles and be able to customize some prompts to review/rate them on various criteria.
>
> — @LinNikki96663 ([source](https://x.com/LinNikki96663/status/2027817620993720563))

---

## Architecture Overview

```
Browser
  │
  ▼
Vercel (Next.js 16 / React 19)
  Single-page dashboard
  REST + SSE client
  │
  │  HTTPS
  ▼
AWS App Runner (FastAPI / Python 3.13)
  Session, applicant, settings CRUD
  CSV & Google Sheets import
  2-pass streaming analysis pipeline
  │
  ├──► AWS DynamoDB (us-east-1)
  │      applicants table (+ session GSI)
  │      sessions table
  │      settings table
  │
  └──► Anthropic Claude / OpenAI GPT
         (API key supplied by user at runtime)
```

## Project Structure

```
├── backend/                 Python FastAPI server
│   ├── main.py              App entry point, CORS, router mounting
│   ├── routes/
│   │   ├── sessions.py      Session CRUD
│   │   ├── applicants.py    Applicant CRUD + batch operations
│   │   ├── import_data.py   CSV upload + Google Sheets import
│   │   ├── analysis.py      Single review + bulk streaming analysis
│   │   └── settings.py      Prompt, criteria, and judge persona config
│   ├── ai.py                Anthropic / OpenAI abstraction layer
│   ├── db.py                DynamoDB operations
│   ├── csv_utils.py         CSV parsing and normalization
│   ├── judge_personas.py    12 pre-built judge persona definitions
│   ├── models.py            Pydantic request/response models
│   ├── config.py            DynamoDB table handles, constants
│   ├── Dockerfile           Python 3.13-slim container
│   └── requirements.txt
│
├── frontend/web-app/        Next.js frontend
│   ├── app/
│   │   ├── layout.tsx       Root layout (fonts, theme, toaster)
│   │   └── (dashboard)/
│   │       ├── layout.tsx   App shell wrapper
│   │       └── page.tsx     Main single-page dashboard
│   ├── components/
│   │   ├── app-shell.tsx    Header bar + layout chrome
│   │   ├── csv-uploader.tsx Drag-and-drop CSV upload with preview
│   │   ├── selection-wizard.tsx  Settings & analysis configuration
│   │   ├── review-actions.tsx    Accept/waitlist/reject buttons
│   │   └── ui/              ~50 shadcn/ui components
│   ├── hooks/
│   │   └── use-applicants.ts  Data fetching hooks (SWR-style)
│   ├── lib/
│   │   ├── api.ts           Typed fetch client (REST + SSE streaming)
│   │   ├── judge-personas.ts  Judge persona display metadata
│   │   └── utils.ts         Utility helpers
│   ├── package.json
│   └── tsconfig.json
│
└── infra/
    └── main.tf              Terraform: DynamoDB, ECR, App Runner, IAM
```

## Frontend

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (New York style), Recharts, Geist fonts

The frontend is a single-page dashboard with these main features:

- **Session management** — Switch between named import sessions
- **Stats cards** — Live counts for total, accepted, waitlisted, rejected, and pending applicants (clickable to filter)
- **Charts panel** — Attendee type distribution, top roles, score distribution, decisions breakdown, average AI score by type, acceptance rate by type
- **Applicant table** — Filterable by status, searchable by name/company/title/email, sortable, with bulk selection and CSV/JSON export
- **Detail side panel** — Full applicant profile with AI score, reasoning, panel votes, accepting judges, LinkedIn link, and manual status override
- **Card scanner** — Swipe-style review mode for quick accept/waitlist/reject decisions
- **Import** — CSV drag-and-drop upload or Google Sheets URL with optional auto-sync
- **Settings** — AI provider/model config, venue capacity, attendee mix weights, auto-accept types, relevance filter, judge persona panel configuration, custom review prompt and weighted criteria

**State management:** React `useState` hooks. Settings and API keys persisted in `localStorage` and synced with the backend settings API.

**Styling:** Dark/light mode via `next-themes`, Stanford cardinal red (`#8C1515`) header branding.

## Backend

**Stack:** Python 3.13, FastAPI, Uvicorn, boto3 (DynamoDB), Anthropic SDK, OpenAI SDK, httpx

### API Endpoints

| Group | Method | Path | Description |
|-------|--------|------|-------------|
| Sessions | `POST` | `/sessions` | Create session |
| | `GET` | `/sessions` | List all sessions |
| | `GET` | `/sessions/{id}` | Get session |
| | `PUT` | `/sessions/{id}` | Update session |
| | `DELETE` | `/sessions/{id}` | Delete session (cascades) |
| Applicants | `GET` | `/applicants` | List all (opt. `?session_id=`) |
| | `GET` | `/applicants/stats` | Status counts |
| | `PUT` | `/applicants/batch-status` | Bulk status update |
| | `POST` | `/applicants` | Create one |
| | `GET` | `/applicants/{id}` | Get one |
| | `PUT` | `/applicants/{id}` | Update one |
| | `DELETE` | `/applicants/{id}` | Delete one |
| Import | `POST` | `/applicants/upload-csv` | Upload CSV (auto-creates session) |
| | `POST` | `/applicants/import-google-sheet` | Import from public Google Sheet |
| Analysis | `POST` | `/applicants/{id}/review` | Single applicant AI review |
| | `POST` | `/applicants/analyze-all-stream` | Bulk 2-pass streaming analysis (SSE) |
| Settings | `GET/PUT` | `/settings/prompts` | Review prompt + criteria config |
| | `GET/PUT` | `/settings/selection-preferences` | Selection preferences |
| | `GET` | `/settings/judge-personas` | List judge personas |

### Database (DynamoDB)

Three tables, all using on-demand (PAY_PER_REQUEST) billing:

**`john-whaley-applicants`** — Stores applicant records with flexible schema (arbitrary CSV columns preserved as top-level attributes).
- Key: `applicant_id` (UUID)
- GSI: `session-index` on `session_id`
- Core fields: name, email, company, title, status, ai_score, ai_reasoning, attendee_type, panel_votes, accepting_judges

**`john-whaley-sessions`** — Import sessions with analysis metadata.
- Key: `session_id` (UUID)
- Tracks source (csv/google_sheet), applicant count, and last analysis config

**`john-whaley-settings`** — Global configuration (review prompts, criteria, selection preferences).
- Key: `setting_id` (string)

### Analysis Pipeline

The core intelligence is a multi-pass streaming pipeline (`/applicants/analyze-all-stream`) using Server-Sent Events:

1. **Pass 1 — Classification:** All applicants are classified into attendee types (vc, entrepreneur, faculty, alumni, press, student, other) with a detailed role label and one-sentence summary. Runs concurrently (semaphore of 10).

2. **Auto-Accept:** Applicants matching configured types (default: student, faculty, alumni) are immediately accepted with score 100, skipping AI scoring.

3. **Pass 2 — Scoring** (two modes):
   - **Single reviewer:** Each applicant is scored 1–100 with status and reasoning, using full pool context (type distribution, venue capacity, attendee mix targets).
   - **Panel mode:** Multiple judge personas (up to 12) each score every applicant through their unique lens. Each persona has specific biases, preferred types, and scoring modifiers. Adjudication runs as either union (any accept vote = accepted) or majority (>50% accept votes required).

4. **Pass 3 — Summary:** A final LLM call generates a 3–5 sentence analysis overview.

### Judge Personas

12 pre-built personas with distinct review perspectives:

| Persona | Specialty |
|---------|-----------|
| The VC Whisperer | Investor relations & VC pipeline |
| The Founder's Advocate | Startup founders & operators |
| Academic Excellence | Faculty & research talent |
| The Alumni Champion | Stanford alumni network |
| Media Maven | Press & media coverage |
| The Rising Star Scout | Students & emerging talent |
| The Networking Oracle | High-value connectors |
| The Technical Purist | Deep technical expertise |
| The Diversity Champion | Underrepresented voices |
| The ROI Analyst | Hard metrics & outcomes |
| The Wildcard Spotter | Unconventional backgrounds |
| The Culture Curator | Event energy & experience |

## Infrastructure

All AWS resources in `us-east-1`, managed with Terraform:

- **DynamoDB** — 3 tables (on-demand billing)
- **ECR** — Docker image repository for the backend
- **App Runner** — Runs the FastAPI container (1 vCPU, 2 GB RAM)
- **IAM** — Roles for App Runner ECR access and DynamoDB permissions

Frontend is deployed on **Vercel** (standard Next.js deployment).

## LLM Integrations

Supports two providers, selected at runtime by the user:

- **Anthropic Claude** — Claude Sonnet 4, Claude Opus 4, Claude Haiku 4
- **OpenAI** — GPT-4o, GPT-4o Mini

API keys are supplied by the user in the settings UI, stored only in the browser's `localStorage`, and sent per-request to the backend. Keys are never persisted server-side.

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Requires AWS credentials configured for DynamoDB access (e.g., via `~/.aws/credentials` or environment variables).

### Frontend

```bash
cd frontend/web-app
pnpm install
pnpm dev
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to point at the backend (defaults to `http://localhost:8000`).

### Infrastructure

```bash
cd infra
terraform init
terraform apply
```
