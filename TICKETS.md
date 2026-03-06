# Tickets — John Whaley Feedback (Mar 5 Call)

Prioritized by John's closing statement: "If I don't trust the results, I have to click through everyone anyway. There's no point."

---

## P0 — Trust & Accuracy (Blockers to value)

### T1: Honor existing CSV approval status
**Size:** S | **Files:** `backend/routes/import_data.py`, `backend/routes/analysis.py`

When uploading a CSV that already has a status/approval column, map it to our internal status field. Don't reset decided applicants to "pending."

**Acceptance Criteria:**
- On CSV upload, detect common status column names (e.g. "status", "approval_status", "approved")
- Map values to our internal statuses (accepted/rejected/waitlisted/pending)
- Already-decided applicants are excluded from AI analysis passes
- UI shows imported status correctly in the table

---

### T2: Separate enrichment phase from selection phase
**Size:** L | **Files:** `backend/routes/analysis.py`, `frontend/web-app/app/(dashboard)/page.tsx`

Split the current single "Run Analysis" flow into two distinct steps:
1. **Enrich** — Classify each applicant (investor? founder? student?), pull LinkedIn data, fill in properties. Display results in an editable table.
2. **Select** — Given enriched data, apply capacity/mix rules and produce accept/reject decisions.

**Acceptance Criteria:**
- "Enrich" button runs classification + LinkedIn scraping, populates type columns
- User can review and manually edit enrichment results before selection
- "Select" button runs scoring/allocation using enriched data
- Enrichment results persist independently of selection runs
- User can re-run selection with different parameters without re-enriching

---

### T3: Editable AI classifications with feedback persistence
**Size:** M | **Files:** `backend/routes/applicants.py`, `frontend/web-app/app/(dashboard)/page.tsx`

After enrichment, let the user correct misclassifications inline (e.g., change "investor" to "founder"). Store corrections so they survive re-runs.

**Acceptance Criteria:**
- Inline edit for attendee_type, attendee_type_detail, and enriched fields in the table
- Manual overrides flagged as user-edited (not overwritten on re-enrichment)
- Corrections stored in DynamoDB with a `user_override: true` flag
- Re-enrichment skips fields that have user overrides (unless user forces refresh)

---

### T4: Investor taxonomy and title hierarchy
**Size:** M | **Files:** `backend/routes/analysis.py` (prompts), `backend/judge_personas.py`

Build VC-specific classification into the enrichment prompt. Distinguish real investors from dabblers. Rank by seniority.

**Hierarchy:** Intern < Analyst < Associate < Senior Associate < VP < Principal < Partner < Managing Partner/GP

**Acceptance Criteria:**
- Classification prompt extracts investor title/level when attendee_type is "vc" or "investor"
- New field `investor_level` (or equivalent) stored on applicant
- Prompt distinguishes professional investors (primary occupation) from occasional angel investors
- LinkedIn enrichment data (if available) used to validate self-reported investor status
- Selection phase can use investor_level for prioritization (e.g., Partner = insta-accept)

---

### T5: In-person vs. virtual as separate pools
**Size:** M | **Files:** `backend/routes/analysis.py`, `backend/models.py`, `frontend/web-app/components/selection-wizard.tsx`

The CSV has a ticket type / "joining in person or remote?" field. Use it to create separate capacity pools with independent criteria.

**Acceptance Criteria:**
- On CSV upload, detect and store attendance mode (in-person vs. virtual)
- Selection preferences support separate capacity limits per mode
- AI selection runs independently per pool (different caps, potentially different criteria)
- UI shows pool breakdown and lets user configure each pool separately

---

## P1 — UX & Usability

### T6: Post-analysis sliders for real-time rebalancing
**Size:** M | **Files:** `frontend/web-app/app/(dashboard)/page.tsx`, `frontend/web-app/components/selection-wizard.tsx`

Move attendee mix sliders to appear AFTER analysis completes. Adjusting sliders should re-sort/re-filter the results list in real time without re-running AI.

**Acceptance Criteria:**
- After analysis, sliders appear above the results table
- Changing a slider instantly updates which applicants show as accepted/waitlisted/rejected
- Capacity slider adjusts the cutoff line
- Mix % sliders rebalance type quotas
- No additional API calls needed — works on cached scores

---

### T7: Show AI reasoning inline in the table
**Size:** S | **Files:** `frontend/web-app/app/(dashboard)/page.tsx`

Add an expandable reasoning column or tooltip to the main applicant table so John can see WHY each person was scored without clicking into individual cards.

**Acceptance Criteria:**
- AI reasoning visible in table (expandable row, tooltip, or dedicated column)
- Classification tags (investor, founder, etc.) shown as badges in the table
- Score + reasoning scannable without navigating away from the list

---

### T8: Hide irrelevant CSV columns
**Size:** S | **Files:** `frontend/web-app/app/(dashboard)/page.tsx`

Don't display columns that have no useful data (amount, discount, tax, currency, created_at, etc.). Auto-detect empty/zero columns and hide them, or maintain a default hide-list.

**Acceptance Criteria:**
- Columns that are all empty, null, or zero across all rows are auto-hidden
- User can toggle column visibility
- Sensible defaults: hide financial/metadata columns, show identity + classification columns

---

### T9: Whitelist and blacklist
**Size:** M | **Files:** `backend/models.py`, `backend/routes/settings.py`, `backend/routes/analysis.py`

Global lists of emails/names that are always accepted or always rejected, across all events.

**Acceptance Criteria:**
- Settings page to manage whitelist and blacklist (add/remove emails)
- During analysis, whitelisted applicants are auto-accepted (score 100, status accepted)
- Blacklisted applicants are auto-rejected (score 0, status rejected)
- Lists persist across sessions/events
- Stored in DynamoDB settings table

---

### T10: Global reusable persona templates
**Size:** M | **Files:** `backend/judge_personas.py`, `backend/routes/settings.py`, `frontend/web-app/components/selection-wizard.tsx`

Define personas (VC, Founder, Student, etc.) once globally with well-known sub-categories, not per-analysis-run. Users can customize and reuse them.

**Acceptance Criteria:**
- Persona library accessible from settings (not just inline during analysis config)
- Good defaults with sub-categories (e.g., Student: high school / undergrad / grad / PhD)
- User can create, edit, and delete custom personas
- Personas reusable across events
- Analysis config references saved personas instead of re-entering each time

---

### T11: Better loading UX during analysis
**Size:** S | **Files:** `frontend/web-app/app/(dashboard)/page.tsx`

Replace the raw streaming log output with a progress bar or animation showing how many applicants have been processed.

**Acceptance Criteria:**
- Progress bar showing X/N applicants processed
- Current phase indicator (Enriching... Scoring... Summarizing...)
- Cancel button to abort analysis mid-run

---

### T12: Cancel LinkedIn enrichment without page refresh
**Size:** S | **Files:** `frontend/web-app/app/(dashboard)/linkedin/page.tsx`, `backend/routes/linkedin.py`

Add a cancel/stop button for the LinkedIn enrichment process.

**Acceptance Criteria:**
- Cancel button visible during enrichment
- Clicking it aborts remaining scrapes (keeps already-completed ones)
- No page refresh needed

---

### T13: Direct link to API key page
**Size:** XS | **Files:** `frontend/web-app/app/(dashboard)/page.tsx`

When asking for an OpenAI/Anthropic API key, include a direct link to the provider's API key page.

**Acceptance Criteria:**
- "Get your API key" link next to the input field
- Links: `https://platform.openai.com/api-keys` (OpenAI), `https://console.anthropic.com/settings/keys` (Anthropic)

---

## P2 — Integrations

### T14: Luma API integration
**Size:** L | **Files:** new `backend/routes/luma.py`, `backend/models.py`, `frontend/web-app/app/(dashboard)/page.tsx`

Pull events and registrations directly from Luma and push acceptance decisions back. John shared his API key.

**Acceptance Criteria:**
- Settings page to enter Luma API key
- "Import from Luma" button that lists events and pulls registrations
- After selection, "Sync to Luma" button pushes accept/reject status back
- No CSV round-tripping needed for Luma-based events
- Read-only safety: confirm before writing back to Luma

---

## P3 — Business Model & Future

### T15: Usage-based pricing model (credits)
**Size:** L | **Files:** new billing infrastructure

Per-applicant-reviewed credits instead of subscription. Free tier (50-100 reviews), then pay-as-you-go.

**Acceptance Criteria:**
- Credit balance tracked per account
- Free tier: 50-100 applicant reviews
- Purchase additional credits (e.g., $5 per 100 reviews)
- Credit deducted on AI analysis, not on page views
- Usage dashboard showing credits remaining and history

**Note:** Requires auth (T16) first.

---

### T16: Authentication and multi-tenancy
**Size:** XL | **Files:** broad — new auth layer across frontend and backend

Multiple organizers need to view, edit, and collaborate on the same event's applicant list.

**Acceptance Criteria:**
- User accounts with email/password or OAuth login
- Organizations/teams: multiple users share access to the same events
- Role-based access (admin vs. reviewer)
- All applicant data scoped to organization
- Sensitive data protected behind auth (not publicly accessible)

---

### T17: Collaborative review (tagging & comments)
**Size:** L | **Files:** new models, new routes, new UI components

Multiple reviewers can tag each other on specific applicants and leave comments.

**Acceptance Criteria:**
- Comment thread per applicant
- @mention teammates for input ("do you know this person?")
- Notification when tagged
- Each reviewer can independently accept/reject; final decision shows consensus

**Note:** Requires auth (T16) first.

---

## P4 — Pricing Strategy (not code tickets, but noted)

- **Don't use subscription pricing** — events are periodic, not daily
- **Target 80-90% gross margins** — don't just pass through API costs
- **Handle API keys for users** — real products don't ask for OpenAI keys
- **Price discovery via binary search** — start at a price, adjust based on yes/no responses from early users
- **Students underprice** — the value delivered (1 hour saved per event) is worth more than you think
