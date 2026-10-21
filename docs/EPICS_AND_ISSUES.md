# The CAB Call (`thecabcall.com`) — Master Epics & Issues Roadmap

> **How to use this document with Antigravity:**
> Open an Antigravity session in this repository and simply say:
> - **`"Implement Issue 6"`** (or `"Implement Issue #7"`, `"Implement Issue #8"`, `"Implement Issue #9"`, `"Implement Issue #10"`, `"Implement Issue #11"`, `"Implement Issue #12"`)
> - Or run an entire Epic at once: **`"Implement Epic #6"`** (or `"Implement Epic #5"`)
>
> Antigravity is configured via [`AGENTS.md`](../AGENTS.md) and [`.github/ISSUE_TEMPLATE/antigravity-issue.md`](../.github/ISSUE_TEMPLATE/antigravity-issue.md) to implement every requested Issue **autonomously from start to finish**—writing the code, running local tests, applying remote Cloudflare D1 migrations, deploying the Cloudflare Worker and Vercel production frontend, verifying that the feature is live in production, and **only pausing when it hits a `[HUMAN ACTION GATE]`** (a step requiring your interactive login, external OAuth/API credentials, or local files). When it pauses at a gate, it will walk you through the exact steps to take and ask you to confirm when you are done before proceeding.

---

## Current Project Snapshot

| Component | Current Status | Location |
| :--- | :--- | :--- |
| **Next.js 15 Frontend (6 Core Pages)** | Live in Production (`https://thecabcall.com`) & working locally | `src/app/`, `src/components/` |
| **System-1 Classifier (TypeSafe Jev `jev-1.14.0`)** | Live on Cloudflare Edge & working locally | `src/pipeline/jev.ts`, `src/pipeline/ingest.ts` |
| **System-2 Synthesis (Gemini 2.5 Flash)** | Live on Cloudflare Edge & working locally | `src/pipeline/synthesize.ts` |
| **Friday 5-Min Podcast Rollup + TTS Audio + 21 Legacy Episodes** | Live on Cloudflare Edge & R2 (`cabcall-audio`) | `src/pipeline/rollup.ts`, `scripts/import-legacy-episodes.ts` |
| **Cloudflare Worker Entrypoint & Crons** | Deployed (`https://thecabcall.thecabcall.workers.dev`) | `src/worker.ts`, `wrangler.jsonc` |
| **D1 SQLite Schema & Migrations** | Applied to remote `cabcall-db` (`094cf69c-0fe3-409b-a871-06f3610a28a6`) & local `.wrangler` | `migrations/0001_init.sql` – `migrations/0010_archive_pagination_indexes.sql` |
| **Database & Audio Bridge** | Live Cloud Worker Bridge (`/api/snapshot` + R2 audio & `/media/*`) with local `.wrangler` fallback | `src/lib/d1-bridge.ts`, `src/lib/store.ts`, `src/lib/episodes.ts`, `src/lib/feeds-filters.ts`, `src/lib/incidents.ts`, `src/lib/publishing.ts` |
| **Admin Governance, Auth & Audit Ledger** | Issues #6, #7, #8, #9, #10, #11 & #12 (Audit Ledger, Admin OAuth/Magic-Link Auth & Invites, Command Center Shell & Audit Replay Studio, Podcast Episode & R2 Audio Studio, Dynamic Feeds & Filters Studio, Editorial Pipeline & Incident Studio, Outbound Published Feeds & Syndication Studio) live in Production | `migrations/0003_audit_ledger.sql` – `migrations/0010_archive_pagination_indexes.sql`, `src/pipeline/audit.ts`, `src/pipeline/auth.ts`, `src/pipeline/ingest.ts`, `src/pipeline/rollup.ts`, `src/pipeline/editorial.ts`, `src/pipeline/publishing.ts`, `src/lib/audit.ts`, `src/lib/auth.ts`, `src/lib/episodes.ts`, `src/lib/feeds-filters.ts`, `src/lib/incidents.ts`, `src/lib/publishing.ts`, `src/app/admin/` |

---

## Epic & Issue Index (Synced with GitHub Issues)

### Completed Foundation Epics (#1 – #4)
- [x] **Epic #1 ([GitHub Issue #1](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/1)): Repository Baseline, Clean Build & Git Synchronization**
- [x] **Epic #2 ([GitHub Issue #2](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/2)): Cloudflare Cloud Provisioning (Live D1 Database, R2 Audio Bucket & Worker Deployment)**
- [x] **Epic #3 ([GitHub Issue #3](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/3)): Cloud Bridge — Connecting the Live Next.js Website to Production Cloudflare D1 & R2**
- [x] **Epic #4 ([GitHub Issue #4](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/4)): Production Frontend Deployment (Vercel) & Custom Domain Cutover (`thecabcall.com`)**

### Completed Archive & Voice Enhancement Epic (#5)
- [x] **Epic #5 ([GitHub Issue #5](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/5)): Legacy Podcast Archive Migration & Voice Cloning / TTS Enhancement** (`Issues 5.1 – 5.3`)

### Open Admin Dashboard, Editorial Pipeline & Immutable Audit Trail Epic (#6 — Issues #6 to #12)
- [x] **Issue #6 ([GitHub Issue #6](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/6)): Immutable Replayable Audit Ledger & Disclosure Engine (D1 Append-Only Schema, SHA-256 Hash Chain & Replay API)**
- [x] **Issue #7 ([GitHub Issue #7](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/7)): Admin Authentication & User Access Control (Google OAuth Owner Lock, Email Invites & Magic Link Fallback)**
- [x] **Issue #8 ([GitHub Issue #8](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/8)): Admin Dashboard Shell, Telemetry Command Center & Audit Trail Explorer / Replay Studio (`/admin` & `/admin/audit`)**
- [x] **Issue #9 ([GitHub Issue #9](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/9)): Podcast Episode Admin Studio — Delete Episodes, Purge R2 Audio, Edit Transcripts & Generate New Episodes (`/admin/episodes`)**
- [x] **Issue #10 ([GitHub Issue #10](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/10)): Dynamic Inbound RSS Feed & Triage Filter Management (`/admin/feeds` & `/admin/filters`)**
- [x] **Issue #11 ([GitHub Issue #11](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/11)): Editorial Pipeline & Incident Studio — De-Alarmist Title Rewriting, Image Attachment Pipeline & Brief Overrides (`/admin/incidents` & `/admin/transforms`)**
- [x] **Issue #12 ([GitHub Issue #12](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/12)): Outbound Published Feeds & Syndication Studio — Customize Podcast RSS & Publish De-Alarmed Incident Feeds (`/admin/publishing`, `/feed.xml` & `/feeds/incidents.*`)**

### Krug Usability ('Don't Make Me Think') & Craft Lexicon Overhaul Epic ([GitHub Issue #20](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/20) — Issues #13 to #19)
- [x] **Issue #13 ([GitHub Issue #13](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/13)): [Lexicon] Replace 'Tech Bro / NASA Terminal' UI Labels with Plain-Spoken Craft Terminology (`mapDtoToCraftLexicon`)**
- [x] **Issue #14 ([GitHub Issue #14](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/14)): [Lexicon] Translate SRE Failure Modes into Accessible Shop-Floor & Operative Craft Concepts**
- [x] **Issue #15 ([GitHub Issue #15](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/15)): [Prose & Templates] Eliminate Broken Headline Interpolation & Corporate Compliance Jargon**
- [x] **Issue #16 ([GitHub Issue #16](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/16)): [Defensive Rendering] Prevent Verbatim Sentence Duplication Across Sections I & II**
- [x] **Issue #17 ([GitHub Issue #17](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/17)): [Usability / Krug] Remove Mystery-Meat `[?]` Badges and Clarify Action Button Labels**
- [x] **Issue #18 ([GitHub Issue #18](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/18)): [Navigation / Krug] Implement 'You Are Here' Street Signs & Sidebar Visual Hierarchy**
- [x] **Issue #19 ([GitHub Issue #19](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/19)): [Verification] Add a 'Banned Jargon & Krug Usability Gate' to the PowerShell Test Harness**

### Admin Dashboard Redesign — "The Editor's Study" Epic ([GitHub Issue #21](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/21) — Issues #22 to #26)
- [x] **Issue #22 ([GitHub Issue #22](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/22)): [Admin UI 1/5] Navigation Consolidation & Header De-cluttering (`AdminShellNav.tsx`, `AdminLayout`)**
- [x] **Issue #23 ([GitHub Issue #23](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/23)): [Admin UI 2/5] Overview Tab Simplification & Plain-English Action Cards (`AdminOverviewClient.tsx`)**
- [x] **Issue #24 ([GitHub Issue #24](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/24)): [Admin UI 3/5] Podcast Studio Overhaul — Compact List & Slide-Out Inspector Drawer (`AdminEpisodesClient.tsx`)**
- [x] **Issue #25 ([GitHub Issue #25](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/25)): [Admin UI 4/5] Unified "Editorial & Feeds" Workspace (`AdminIncidentsClient.tsx`, `AdminFeedsClient.tsx`, `AdminFiltersClient.tsx`)**
- [x] **Issue #26 ([GitHub Issue #26](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/26)): [Admin UI 5/5] Aesthetic Polish & Micro-Interactions ("Delight" Pass across `globals.css` & `Admin*.tsx`)**

### Header & Navigation Architecture — Two-Tier Editorial Masthead & Extensible Dropdown System Epic ([GitHub Issue #27](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/27) — Issues #28 to #32)
- [x] **Issue #28 ([GitHub Issue #28](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/28)): Refactor header into a two-tier editorial masthead and align max-width container (`SiteHeader.tsx`, `TrestleboardClient.tsx`)**
- [x] **Issue #29 ([GitHub Issue #29](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/29)): Enhance Square & Compasses logo emblem with solid seal backing, scaling, and plumb-line divider (`MasonicEngravings.tsx`, `SiteHeader.tsx`)**
- [x] **Issue #30 ([GitHub Issue #30](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/30)): Create a data-driven navigation configuration schema for multi-level dropdowns (`src/lib/navigation.ts`, `SiteHeader.tsx`)**
- [x] **Issue #31 ([GitHub Issue #31](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/31)): Build architectural dropdown menu panels and ledger navigation bar styling (`SiteHeader.tsx`, `globals.css`)**
- [x] **Issue #32 ([GitHub Issue #32](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/32)): Implement dropdown hover-intent protection, sticky nav bar, and keyboard/touch accessibility (`SiteHeader.tsx`, `globals.css`)**

### Podcast Archive Unification & Episode Description Data Cleanup Epic ([GitHub Issue #33](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/33) — Issues #34 to #38)
- [x] **Issue #34 ([GitHub Issue #34](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/34)): Simplify Podcast Page Masthead & Replace "Legacy / 5m Brief" Filter Tabs (`PodcastArchiveClient.tsx`, `archive/page.tsx`, `navigation.ts`)**
- [x] **Issue #35 ([GitHub Issue #35](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/35)): Sanitize Episode #1–#21 Descriptions (Strip Raw Markdown, Tables, and Inline URLs) (`scripts/import-legacy-episodes.ts`, `d1-bridge.ts`, `dto.ts`, `PodcastArchiveClient.tsx`)**
- [x] **Issue #36 ([GitHub Issue #36](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/36)): Deduplicate AI Generation Disclaimers Across Episode Cards (`PodcastArchiveClient.tsx`, `scripts/import-legacy-episodes.ts`, `SiteFooter.tsx`)**
- [x] **Issue #37 ([GitHub Issue #37](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/37)): Unify Episode Card Layout & Artwork Thumbnails (`PodcastArchiveClient.tsx`, `MasonicEngravings.tsx`)**
- [x] **Issue #38 ([GitHub Issue #38](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/38)): Adapt the Expandable "Read Script" Drawer for NotebookLM Episodes (`PodcastArchiveClient.tsx`, `types.ts`, `dto.ts`, `d1-bridge.ts`)**

### Information Architecture & Scale — Dedicated Tool/SRE Hub Pages, Navigation Alignment & 1,000-Item Archive Pagination Epic ([GitHub Issue #44](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/44) — Issues #39 to #43)
- [x] **Issue #39 ([GitHub Issue #39](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/39)): [Navigation & Taxonomy] Align Header Dropdowns & Canonical Slug Mappings with `taxonomy.ts` (`src/lib/taxonomy.ts`, `src/lib/navigation.ts`, `SiteHeader.tsx`)**
- [x] **Issue #40 ([GitHub Issue #40](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/40)): [Routing & Content] Create Dedicated Dynamic Hub Pages for the Six Working Tools (`/tools/[slug]`) (`src/app/tools/[slug]/page.tsx`, `WorkingToolHubClient.tsx`)**
- [x] **Issue #41 ([GitHub Issue #41](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/41)): [Routing & Content] Create Dedicated Dynamic Hub Pages for the Six Structural Failure Modes (`/failures/[slug]`) (`src/app/failures/[slug]/page.tsx`, `FailureModeHubClient.tsx`, `MasonicEngravings.tsx`)**
- [x] **Issue #42 ([GitHub Issue #42](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/42)): [UX Refactor] Streamline `/rubric` into a Clean Methodology Codex & Visual Directory (`RubricCodexClient.tsx`, `RubricInspectorDrawer.tsx`, `src/app/rubric/page.tsx`)**
- [x] **Issue #43 ([GitHub Issue #43](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/43)): [Scale & Data] Archive Scalability Refactor: Server-Side Pagination, URL State, 6×6 Brass Heatmap & Zero Horizontal Overflow (`migrations/0010_archive_pagination_indexes.sql`, `d1-bridge.ts`, `worker.ts`, `KnowledgeGraphClient.tsx`, `src/app/archive/page.tsx`)**

### Krug "Don't Make Me Think" Global UI/UX Flattening & Readability Overhaul Epic ([GitHub Issue #45](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/45) — Issues #46 to #51)
- [x] **Issue #46 ([GitHub Issue #46](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/46)): Podcast Page (`/podcast`) — Transcript Formatting, Paragraph Segmentation & Drawer Flattening**
- [x] **Issue #47 ([GitHub Issue #47](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/47)): Working Tools & Rubric Page (`/rubric`) — 50% Card Diet & Redundancy Removal**
- [x] **Issue #48 ([GitHub Issue #48](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/48)): About & Feeds Page (`/about`, `/status`, `/feeds`) — Collapse the 51-Card Wall, De-Nest Pillars & Slim Feed Cards**
- [x] **Issue #49 ([GitHub Issue #49](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/49)): Unseen Public Pages Audit & Flattening (`/archive`, `/tools/[slug]`, `/failures/[slug]`, `/incidents/[slug]`)**
- [ ] **Issue #50 ([GitHub Issue #50](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/50)): `admin.thecabcall.com` — Apply Krug "Don't Make Me Think" Discipline Across the Admin Portal**
- [x] **Issue #51 ([GitHub Issue #51](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/51)): Global CSS & Component Primitives Enforcement — Max 1 Border Depth & Flat Broadsheet Primitives (`src/app/globals.css`, `src/components/MasonicEngravings.tsx`, `src/components/ui/BroadsheetPrimitives.tsx`, `src/components/TrestleboardClient.tsx`, `src/components/IncidentCard.tsx`)**

---

# Epic #1: Repository Baseline, Clean Build & Git Synchronization

**Objective:** Verify that all local uncommitted work (the 4-stage AI pipeline, Cloudflare Worker, D1 migrations, and UI components) compiles cleanly with zero TypeScript or Next.js build errors, ensure secrets and local SQLite state are excluded from Git, and commit + push a clean baseline to `origin/main`.

### Issue 1.1: Audit `.gitignore` & Secret Templates
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Inspect `.gitignore` and verify that `.dev.vars`, `.env*` (except `.dev.vars.example`), `.wrangler/`, `.vercel/`, and `.next/` are ignored by Git.
  2. Verify `git status --ignored` confirms `.dev.vars` and `.wrangler/` are never staged.
  3. Ensure `.dev.vars.example` contains placeholder keys (`TYPESAFE_API_KEY=`, `GEMINI_API_KEY=`, `ADMIN_SECRET=`) with no real secrets.
- **Verification:** `git status` shows no secret files or `.wrangler` SQLite files untracked or staged.
- **Human Action Gate:** None.

### Issue 1.2: Full TypeScript & Next.js Production Build Check
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Run `npx tsc --noEmit` to validate TypeScript types across `src/app`, `src/components`, `src/lib`, `src/pipeline`, and `src/worker.ts`.
  2. Run `npm run build` to verify all Next.js routes and static/dynamic pages compile cleanly.
  3. Fix any TypeScript, ESLint, or Next.js build issues if discovered.
- **Verification:** `npm run build` exits with code `0`.
- **Human Action Gate:** None.

### Issue 1.3: Commit & Push Baseline to GitHub (`origin/main`)
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Stage all tracked and new source files (`git add .`).
  2. Commit with a descriptive message summarizing the System-1/System-2 pipeline, Cloudflare Worker, D1 migrations, and UI integration.
  3. Push to `origin main` (`https://github.com/Columbia-Cloudworks-LLC/thecabcall.com.git`).
  4. Mark Epic #1 and Issues 1.1–1.3 as `[x] Completed` in `docs/EPICS_AND_ISSUES.md` and close the corresponding GitHub Issue.
- **Verification:** `git status` is clean and `git log -n 1` matches `origin/main`.
- **Human Action Gate:** Only if `git push` fails due to authentication (if so, instruct the user to run `gh auth login` in terminal).

---

# Epic #2: Cloudflare Cloud Provisioning (Live D1 Database, R2 Audio Bucket & Worker Deployment)

**Objective:** Create the real production Cloudflare D1 database (`cabcall-db`) and R2 bucket (`cabcall-audio`), update `wrangler.jsonc` with the real database UUID, run the SQL migrations against the cloud D1 database, upload the API keys as Cloudflare Worker secrets, deploy `src/worker.ts` to Cloudflare, and trigger an initial live ingestion + synthesis + podcast rollup run in the cloud.

### Issue 2.1: Verify Cloudflare Wrangler Authentication
- **Status:** `[x] Completed`

### Issue 2.2: Provision Production Cloudflare D1 Database & R2 Bucket
- **Status:** `[x] Completed`

### Issue 2.3: Apply D1 Migrations to Remote Production Database
- **Status:** `[x] Completed`

### Issue 2.4: Configure Production Secrets & Deploy Cloudflare Worker
- **Status:** `[x] Completed`

### Issue 2.5: Seed Live Cloud Telemetry (Run Ingest, Synthesis & Rollup on Production Worker)
- **Status:** `[x] Completed`

---

# Epic #3: Cloud Bridge — Connecting the Live Next.js Website to Production Cloudflare D1 & R2

**Objective:** Upgrade `src/worker.ts`, `src/lib/d1-bridge.ts`, `src/lib/store.ts`, and the Next.js API routes so that when the Next.js frontend runs in the cloud (e.g., on Vercel where `.wrangler/` local SQLite files do not exist), it automatically reads and writes live incidents, episodes, pipeline runs, and MP3 audio from the deployed Cloudflare Worker (`WORKER_API_URL`) instead of falling back to static dummy data.

### Issue 3.1: Add Live Telemetry Snapshot Endpoint to Cloudflare Worker (`src/worker.ts`)
- **Status:** `[x] Completed`

### Issue 3.2: Upgrade Next.js Data Layer & API Routes to Use Production Worker Bridge
- **Status:** `[x] Completed`

### Issue 3.3: Build, Commit & Push Cloud Bridge
- **Status:** `[x] Completed`

---

# Epic #4: Production Frontend Deployment (Vercel) & Custom Domain Cutover (`thecabcall.com`)

**Objective:** Deploy the Next.js frontend to Vercel production with all cloud environment variables wired to the production Cloudflare Worker, verify that `thecabcall.com` points to the live deployment, and verify all 6 pages + podcast RSS feed (`/feed.xml`) in production.

### Issue 4.1: Configure Vercel Environment Variables & Deploy Production Release
- **Status:** `[x] Completed`

### Issue 4.2: Custom Domain (`thecabcall.com`) DNS & SSL Cutover
- **Status:** `[x] Completed`

### Issue 4.3: End-to-End Production Smoke Test
- **Status:** `[x] Completed`

---

# Epic #5: Legacy Podcast Archive Migration & Voice Cloning / TTS Enhancement

**Objective:** Permanently re-host historical *Change Advisory Board* podcast episodes in Cloudflare R2 (`cabcall-audio`) and D1 (`episodes`) so old WordPress/podcast hosting can be retired completely, and optionally configure custom cloned voice synthesis (ElevenLabs / OpenAI TTS) for the Friday 5-minute rollup.

### Issue 5.1: Build Automated Legacy Podcast Bulk Importer (`scripts/import-legacy-episodes.ts`)
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Create a CLI script `scripts/import-legacy-episodes.ts` (and npm script `"import:legacy"`) that accepts either a local directory of `.mp3`/`.m4a` files + metadata/transcripts or an existing podcast RSS XML file.
  2. For each legacy episode, the script uploads the `.m4a` binary and square/widescreen artwork `.png` files to Cloudflare R2 (`cabcall-audio`) via Wrangler R2 and inserts/upserts the episode metadata and Google Gemini AI disclaimer into remote D1 (`episodes` table) and `audit_ledger`.
- **Verification:** Running the script in `--dry-run` mode validates parsing, R2 key naming, and D1 SQL generation.
- **Human Action Gate:** None.

### Issue 5.2: Execute Legacy Archive Upload to Production R2 & D1
- **Status:** `[x] Completed`
- **[HUMAN ACTION GATE] — Provide Legacy Episode Files:**
  > **Completed:** User provided all 21 historical episodes (`The CAB Call #1` through `The CAB Call #21`) in `tmp/Episodes`, including `.m4a` audio, square and widescreen `.png` artwork, descriptions, sources, and `.srt`/`.txt`/`.md` transcripts.
- **Automated Steps for Antigravity (once path is provided):**
  1. Run the bulk import script to upload all 21 `.m4a` files (1.04 GB) and 43 `.png` artwork files to production R2 `cabcall-audio` and insert their rows + Google Gemini AI disclaimer into production D1 `episodes` and `audit_ledger`.
  2. Verify they appear under the **Legacy Deep-Dive Archive** tab on `/archive` and inside `/feed.xml`.

### Issue 5.3: Optional Custom Voice Clone TTS Integration (ElevenLabs / OpenAI TTS)
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Inspect `src/pipeline/rollup.ts` (which currently synthesizes MP3 audio via Gemini TTS with WAV/MP3 fallback).
  2. Add optional support for `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` and `OPENAI_API_KEY` (so if you clone your own voice on ElevenLabs and add those secrets, Friday rollups automatically speak in your cloned voice, while keeping Gemini TTS as the zero-cost default).
- **Verification:** `npm run build` and Worker deployment succeed with multi-provider TTS support.
- **Human Action Gate:** Optional — only if the user wants to supply an `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`.

---

# Epic #6: Admin Dashboard, Google/Magic-Link Auth, Dynamic Feeds/Filters, Editorial Pipeline & Immutable Audit Trail (Issues #6 – #12)

**Objective:** Build a comprehensive, locked-down Admin Dashboard (`/admin`) where only the owner's Google account can log in initially, with the ability to invite or remove other users by email (who can sign in via Google OAuth or passwordless Magic Link), manage podcast episodes (delete, edit, generate on-demand), dynamically add/edit/remove inbound RSS feeds and triage filters, run editorial pipeline transforms (such as de-escalating alarmist news headlines and attaching images to incidents), customize outbound published feeds (`/feed.xml` and `/feeds/incidents.*`), and record **every single mutation** in a cryptographically hash-chained, replayable, immutable D1 audit ledger (`audit_ledger`) ready for public or regulatory disclosure at any time.

---

## Issue #6 (Epic 6.1): Immutable Replayable Audit Ledger & Disclosure Engine
- **GitHub Issue:** [#6](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/6)
- **Status:** `[x] Completed`
- **Objective:** Create the foundational append-only, cryptographically hash-chained audit trail (`audit_ledger`) in Cloudflare D1 and `src/lib/audit.ts` so that every administrative, editorial, feed, filter, episode, and access-control change across the entire platform is recorded with full `before_state_json`, `after_state_json`, actor attribution, SHA-256 chain integrity, deterministic replay/rollback capability, and one-click disclosure export.
- **Automated Steps for Antigravity:**
  1. **D1 Migration (`migrations/0003_audit_ledger.sql`):**
     - Create `audit_ledger` table with columns:
       - `id INTEGER PRIMARY KEY AUTOINCREMENT`
       - `event_id TEXT NOT NULL UNIQUE` (UUIDv4)
       - `timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
       - `actor_email TEXT NOT NULL`
       - `actor_role TEXT NOT NULL DEFAULT 'owner'`
       - `auth_method TEXT NOT NULL` (`'google_oauth' | 'magic_link' | 'admin_secret' | 'system_bootstrap'`)
       - `actor_ip_hash TEXT`
       - `action_type TEXT NOT NULL` (e.g., `'user.invite'`, `'user.revoke'`, `'episode.generate'`, `'episode.delete'`, `'episode.update'`, `'feed.create'`, `'feed.update'`, `'feed.delete'`, `'filter.create'`, `'filter.update'`, `'filter.delete'`, `'incident.rewrite_title'`, `'incident.attach_image'`, `'incident.override_brief'`, `'incident.status_change'`, `'outbound_feed.update'`, `'pipeline_transform.update'`, `'audit.replay'`)
       - `target_type TEXT NOT NULL` (`'user' | 'episode' | 'ingest_feed' | 'ingest_filter' | 'incident_article' | 'outbound_feed' | 'pipeline_transform'`)
       - `target_id TEXT NOT NULL`
       - `reason TEXT NOT NULL DEFAULT ''` (human/editorial justification note for disclosure)
       - `before_state_json TEXT` (full JSON snapshot before change, `null` on creation)
       - `after_state_json TEXT` (full JSON snapshot after change, `null` on deletion)
       - `replay_command_json TEXT NOT NULL` (deterministic payload describing how to replay or invert the state change)
       - `prev_hash TEXT NOT NULL` (`'GENESIS'` for row #1, or `entry_hash` of `id - 1`)
       - `entry_hash TEXT NOT NULL UNIQUE` (SHA-256 hex digest of canonical `prev_hash | timestamp | actor_email | action_type | target_type | target_id | reason | before_state_json | after_state_json`)
     - Add SQLite immutability triggers:
       - `CREATE TRIGGER trg_audit_ledger_no_update BEFORE UPDATE ON audit_ledger BEGIN SELECT RAISE(ABORT, 'Immutable audit_ledger cannot be updated'); END;`
       - `CREATE TRIGGER trg_audit_ledger_no_delete BEFORE DELETE ON audit_ledger BEGIN SELECT RAISE(ABORT, 'Immutable audit_ledger cannot be deleted'); END;`
     - Seed a `GENESIS` audit ledger row recording the initialization of the immutable audit system.
  2. **Audit Engine (`src/pipeline/audit.ts` & `src/lib/audit.ts`):**
     - Implement `appendAuditEntry(db, input)` using Web Crypto SHA-256 to compute `prev_hash` -> `entry_hash` atomically.
     - Implement `verifyAuditChainIntegrity(db)` that walks every row from `GENESIS` to head, recomputes each SHA-256 digest, and returns `{ valid: boolean, totalEntries: number, headHash: string, brokenAtId?: number }`.
     - Implement `replayAuditEntry(db, eventId, mode: 'revert_to_before' | 'reapply_after', actor)` which restores the target entity to its `before_state_json` or `after_state_json` and appends a new `audit.replay` entry to `audit_ledger` referencing the original `event_id`.
     - Implement `exportAuditDisclosureBundle(db, filters)` producing a signed JSON & Markdown disclosure report suitable for public attachment or compliance auditing.
  3. **Cloudflare Worker & Next.js API Endpoints:**
     - Add Worker routes `/api/admin/audit` (`GET` list + filter), `/api/admin/audit/verify` (`GET` chain verification), `/api/admin/audit/replay` (`POST` state replay/revert), and `/api/admin/audit/export` (`GET` JSON/Markdown disclosure bundle).
     - Expose matching Next.js API route handlers under `src/app/api/admin/audit/`.
  4. **Apply & Deploy Live:**
     - Apply `0003_audit_ledger.sql` locally and to remote Cloudflare D1 (`npx wrangler d1 migrations apply cabcall-db --local` and `--remote`).
     - Run `npx tsc --noEmit` and `npm run build`.
     - Deploy Worker (`npx wrangler deploy`) and Vercel production (`npx vercel --prod --yes`).
- **Verification:**
  - `GET https://thecabcall.thecabcall.workers.dev/api/admin/audit/verify` returns `200 OK` with `{ valid: true, totalEntries: >= 1 }`.
  - Attempting an `UPDATE` or `DELETE` on `audit_ledger` fails with SQLite `ABORT: Immutable audit_ledger cannot be updated/deleted`.
- **Human Action Gate:** None.

---

## Issue #7 (Epic 6.2): Admin Authentication & User Access Control (Google OAuth Owner Lock, Email Invites & Magic Link Fallback)
- **GitHub Issue:** [#7](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/7)
- **Status:** `[x] Completed`
- **Objective:** Lock down the Admin Dashboard so that **only the owner's Google account** can log in initially, allow the owner to invite or remove other users by email, allow invited users with Google accounts to sign in with Google, and require invited users who do not use Google to sign in via a single-use cryptographic Magic Link sent to their email.
- **Automated Steps for Antigravity:**
  1. **D1 Migration (`migrations/0004_admin_auth.sql`):**
     - Create `admin_users` table:
       - `id INTEGER PRIMARY KEY AUTOINCREMENT`
       - `email TEXT NOT NULL UNIQUE` (normalized lowercase)
       - `display_name TEXT`
       - `avatar_url TEXT`
       - `role TEXT NOT NULL DEFAULT 'editor'` (`'owner' | 'admin' | 'editor' | 'auditor'`)
       - `auth_provider_pref TEXT NOT NULL DEFAULT 'any'` (`'google' | 'magic_link' | 'any'`)
       - `status TEXT NOT NULL DEFAULT 'invited'` (`'active' | 'invited' | 'revoked'`)
       - `invited_by_email TEXT`
       - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
       - `last_login_at TEXT`
     - Create `admin_magic_links` table:
       - `id INTEGER PRIMARY KEY AUTOINCREMENT`
       - `email TEXT NOT NULL`
       - `token_hash TEXT NOT NULL UNIQUE` (SHA-256 hash of single-use raw token; raw token is never stored in DB)
       - `purpose TEXT NOT NULL DEFAULT 'login'` (`'login' | 'invite'`)
       - `expires_at TEXT NOT NULL` (15-minute TTL for login links, 7-day TTL for initial invite links)
       - `used_at TEXT`
       - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
     - Create `admin_sessions` table:
       - `id INTEGER PRIMARY KEY AUTOINCREMENT`
       - `session_token_hash TEXT NOT NULL UNIQUE`
       - `user_id INTEGER NOT NULL`
       - `email TEXT NOT NULL`
       - `role TEXT NOT NULL`
       - `auth_method TEXT NOT NULL` (`'google_oauth' | 'magic_link'`)
       - `expires_at TEXT NOT NULL`
       - `revoked_at TEXT`
       - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
  2. **Authentication Engine (`src/lib/auth.ts` & Worker Auth Routes):**
     - **Owner Bootstrap:** Automatically ensure `OWNER_ADMIN_EMAIL` is seeded in `admin_users` with `role = 'owner'` and `status = 'active'`. Any login attempt from an email **not** in `admin_users` (or with `status = 'revoked'`) is strictly denied (`403 Forbidden`) and logged.
     - **Google OAuth 2.0 / OIDC Flow (`/api/auth/google` & `/api/auth/google/callback`):**
       - Verify Google OAuth ID token / authorization code against Google's OAuth2 endpoints (`https://oauth2.googleapis.com/tokeninfo` / JWKS), confirm `email_verified === true`, verify the email is in `admin_users` (`status IN ('active', 'invited')`), promote `'invited'` -> `'active'`, create an `HttpOnly`, `Secure`, `SameSite=Lax` signed session cookie (`cabcall_admin_session`), and record the login.
     - **Magic Link Flow for Non-Google Invited Users (`/api/auth/magic-link/request` & `/api/auth/magic-link/verify`):**
       - When an invited user enters their email on `/admin/login` and clicks **"Send Magic Link"** (or when the owner invites a user via email), verify the email is in `admin_users` (`status IN ('active', 'invited')`).
       - Generate a 256-bit cryptographic random token, store only its SHA-256 `token_hash` in `admin_magic_links` with a 15-minute expiration, and dispatch the email via Resend (`RESEND_API_KEY`) / transactional email API containing the one-click login URL `https://thecabcall.com/api/auth/magic-link/verify?token=<RAW_TOKEN>`.
       - Also allow the Owner in `/admin/users` to generate/copy a one-time invite/magic link directly from the UI if an email provider key is not yet configured or if an invitee's corporate spam filter blocks automated mail.
     - **User Invite & Revocation API (`/api/admin/users`):**
       - `GET /api/admin/users`: List all users, roles, status (`active`, `invited`, `revoked`), and last login.
       - `POST /api/admin/users/invite`: Owner/Admin invites an email address with a specified role (`admin`, `editor`, `auditor`), sends the invite email (supporting both Google Sign-In and Magic Link fallback), and appends a `user.invite` record to `audit_ledger`.
       - `POST /api/admin/users/revoke` (or `DELETE`): Owner revokes a user's access (cannot revoke `owner`), immediately invalidates all active `admin_sessions` for that user, and appends a `user.revoke` record to `audit_ledger`.
  3. **Admin Login UI (`/admin/login`) & User Management UI (`/admin/users`):**
     - Build `/admin/login` with:
       - **"Continue with Google"** button (primary owner & Google user login).
       - **"Invited without Google? Sign in with Magic Link"** email form.
       - Clear security banner stating: *"Restricted Change Advisory Board Console — Access limited to the Owner and explicitly invited email addresses. All actions are recorded in the immutable audit ledger."*
     - Build `/admin/users` allowing the Owner to invite users by email, select their role, resend invite/magic links, or remove/revoke users with a mandatory audit reason.
- **[HUMAN ACTION GATE] — Owner Email, Google OAuth Client ID & Optional Email API Key:**
  > **Why Antigravity will pause during Issue #7:** To lock the dashboard exclusively to your Google account and enable live Google Sign-In (plus automated Magic Link emails), Antigravity needs your Google account email address, a Google OAuth Client ID/Secret, and (optionally) a Resend API key for sending invite/magic-link emails.
  >
  > **Exact steps Antigravity will walk you through when you run `"Implement Issue 7"`:**
  > 1. **Your Owner Google Email:** Confirm the exact Gmail / Google Workspace address that should be the sole initial Owner account (`OWNER_ADMIN_EMAIL`).
  > 2. **Google OAuth Credentials (2 minutes):**
  >    - Open [Google Cloud Console -> Credentials](https://console.cloud.google.com/apis/credentials).
  >    - Click **Create Credentials -> OAuth client ID** (Application type: **Web application**).
  >    - Under **Authorized JavaScript origins**, add:
  >      - `https://thecabcall.com`
  >      - `http://localhost:3000`
  >    - Under **Authorized redirect URIs**, add:
  >      - `https://thecabcall.com/api/auth/google/callback`
  >      - `http://localhost:3000/api/auth/google/callback`
  >    - Copy the **Client ID** (`GOOGLE_CLIENT_ID`) and **Client Secret** (`GOOGLE_CLIENT_SECRET`).
  > 3. **Magic Link Email Provider (Optional — Resend):**
  >    - If you want the site to email Magic Links automatically (in addition to giving you a copyable link in the dashboard), create a free API key at [resend.com](https://resend.com) (`RESEND_API_KEY`) and specify your sender address (`EMAIL_FROM`, e.g., `admin@thecabcall.com` or `onboarding@resend.dev`).
  > 4. Add these to `.dev.vars` (or paste them in chat) and reply **`"Done, continue"`**. Antigravity will automatically push them to Cloudflare Worker secrets and Vercel Production env vars and deploy live.
- **Verification:**
  - Unauthenticated requests to `/admin` redirect to `/admin/login`.
  - Any Google account not in `admin_users` is rejected with `403 Unauthorized Account`.
  - The Owner account logs in via Google OAuth, invites a secondary email, verifies Magic Link generation/login, revokes the test invitee, and confirms both `user.invite` and `user.revoke` appear in `audit_ledger`.

---

## Issue #8 (Epic 6.3): Admin Dashboard Shell, Telemetry Command Center & Audit Trail Explorer / Replay Studio (`/admin` & `/admin/audit`)
- **GitHub Issue:** [#8](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/8)
- **Status:** `[x] Completed`
- **Objective:** Build the unified Admin Dashboard navigation shell (`/admin`) and the interactive **Immutable Audit Trail Explorer, Replay & Disclosure Studio** (`/admin/audit`) so you can inspect every change ever made on the site, verify the cryptographic SHA-256 hash chain, view side-by-side `before`/`after` JSON diffs, deterministically revert/replay any change, and export public disclosure reports.
- **Automated Steps for Antigravity:**
  1. **Admin Layout & Navigation (`/admin/layout.tsx`, `/admin/page.tsx`):**
     - Build a protected, high-contrast SRE Command Center layout displaying the logged-in user's email, role badge (`OWNER` / `ADMIN`), auth method badge (`Google OAuth` / `Magic Link`), Chain Integrity status indicator (`AUDIT CHAIN VERIFIED`), and navigation tabs:
       - **Overview (`/admin`)**: System health, quick-action triggers (Run Ingest, Run Synthesis, Generate Episode), active feed count, active filter count, total incidents, and recent audit events.
       - **Episodes (`/admin/episodes`)**: Manage, delete, edit, and generate podcast episodes.
       - **Inbound Feeds (`/admin/feeds`)**: Manage RSS/Atom source feeds.
       - **Triage Filters (`/admin/filters`)**: Manage keyword, regex, and Jev threshold filters.
       - **Incidents & Transforms (`/admin/incidents`)**: De-alarmist headline rewriter, image attachments, and brief overrides.
       - **Published Feeds (`/admin/publishing`)**: Outbound podcast & incident RSS/Atom/JSON feed customization.
       - **Users & Invites (`/admin/users`)**: Google & Magic Link user access control.
       - **Audit Ledger (`/admin/audit`)**: Full immutable replayable audit trail & disclosure exporter.
  2. **Audit Trail Explorer & Replay Studio (`/admin/audit/page.tsx`):**
     - **Cryptographic Chain Verifier Banner:** Live check against `/api/admin/audit/verify` showing total ledger entries, `GENESIS` hash, current `HEAD` hash, and green verification seal.
     - **Filterable Event Log:** Filter by `action_type`, `target_type`, `actor_email`, `target_id`, or date range.
     - **Side-by-Side Diff & Replay Drawer:** Click any audit event to inspect the exact `before_state_json` vs. `after_state_json` field-level diff, the actor's disclosure `reason`, and a **"Revert / Replay State"** button (with confirmation modal + reason input) that restores the prior state while appending a new audit record.
     - **One-Click Disclosure Export:** Download a complete or filtered **Public Disclosure Report** in Markdown (`.md`) or signed JSON (`.json`) showing the full provenance and edit history of any incident, feed, filter, or episode.
  3. **Build, Test & Deploy Live:**
     - Run `npx tsc --noEmit` and `npm run build`.
     - Deploy Worker (`npx wrangler deploy`) and Vercel frontend (`npx vercel --prod --yes`).
- **Verification:** `/admin` and `/admin/audit` render live data from production D1, verify the SHA-256 hash chain, display diffs, and export a disclosure bundle.
- **Human Action Gate:** None.

---

## Issue #9 (Epic 6.4): Podcast Episode Admin Studio — Delete Episodes, Purge R2 Audio, Edit Transcripts & Generate New Episodes (`/admin/episodes`)
- **GitHub Issue:** [#9](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/9)
- **Status:** `[x] Completed`
- **Objective:** Give the Admin complete lifecycle control over all podcast episodes in `/admin/episodes`: delete any episode (removing it from D1 `episodes` and deleting/archiving its `.mp3` object in Cloudflare R2 `cabcall-audio`), generate a new podcast episode on-demand with customizable parameters, edit existing episode titles/summaries/transcripts, or restore a deleted episode directly from its immutable `audit_ledger` snapshot.
- **Automated Steps for Antigravity:**
  1. **R2 Delete Support & Worker Episode Admin Endpoints (`src/pipeline/rollup.ts`, `src/worker.ts`):**
     - Extend `R2BucketLike` interface with `delete(key: string | string[]): Promise<void>`.
     - Add `DELETE /api/admin/episodes/:id` (or `POST /api/admin/episodes/delete`):
       - Fetches the full existing episode row from `episodes` (`before_state_json`).
       - Deletes the row from D1 `episodes` (and optionally purges the R2 `.mp3` object if `purgeAudio=true`).
       - Appends an `episode.delete` entry to `audit_ledger` containing the complete `before_state_json` (including full transcript, metadata, and audio URL) so the episode can be 1-click restored via Audit Replay if ever needed.
     - Add `POST /api/admin/episodes/generate`:
       - Triggers `runWeeklyRollupPipeline` on-demand with optional admin overrides:
         - Custom `episodeNumber` or auto-increment
         - Custom `titleOverride` or `editorialFocusNote`
         - Custom `windowDays` (e.g., 7, 14, 30 days) or hand-picked `incidentIds: number[]`
         - TTS Voice / Provider selection
       - Appends an `episode.generate` entry to `audit_ledger` with `after_state_json`.
     - Add `PUT /api/admin/episodes/:id`:
       - Updates episode `title`, `summary`, `transcript`, `episode_number`, or `published_at`.
       - Option to re-synthesize TTS audio into R2 from the edited transcript.
       - Appends an `episode.update` entry to `audit_ledger` with `before_state_json` and `after_state_json`.
  2. **Admin Episodes UI (`/admin/episodes/page.tsx`):**
     - List all live D1 episodes with inline audio preview player, episode number, slug, R2 audio key, file size, duration, and published timestamp.
     - **"Generate New Episode" Modal/Panel:** Choose auto or custom episode number, select specific synthesized incidents (or use top 7-day incidents), add optional producer notes, and click **Generate & Publish Episode**.
     - **"Edit Episode" Drawer:** Edit title, summary, or 3-part transcript (`[00:00]`, `[01:15]`, `[03:30]`), with a checkbox to regenerate the R2 MP3 audio.
     - **"Delete Episode" Button:** Confirmation modal requiring an audit reason (e.g., `"Superseded by re-recorded Episode #44"`), checkbox to also purge the `.mp3` from R2, and instant cache invalidation so `/archive` and `/feed.xml` update immediately.
  3. **Build, Test & Deploy Live:**
     - Run `npx tsc --noEmit` and `npm run build`.
     - Deploy Worker (`npx wrangler deploy`) and Vercel frontend (`npx vercel --prod --yes`).
- **Verification:**
  - Generate a test episode via `/admin/episodes`, verify it appears in `/archive` and `/feed.xml`, then delete the test episode via `/admin/episodes`, verify it is removed from `/archive` and `/feed.xml`, and verify both `episode.generate` and `episode.delete` are recorded in `audit_ledger`.
- **Human Action Gate:** None.

---

## Issue #10 (Epic 6.5): Dynamic Inbound RSS Feed & Triage Filter Management (`/admin/feeds` & `/admin/filters`)
- **GitHub Issue:** [#10](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/10)
- **Status:** `[x] Completed`
- **Objective:** Replace hardcoded RSS feed arrays and static filter patterns with dynamic D1-backed tables (`ingest_feeds` and `ingest_filters`) and build `/admin/feeds` and `/admin/filters` so you can add new feeds, remove or pause existing feeds, test/preview any RSS/Atom URL before adding it, and add/edit/remove ingestion filters (keyword/regex drop rules, priority boost rules, domain rules, and Jev systemic probability thresholds)—all backed by the immutable audit trail.
- **Automated Steps for Antigravity:**
  1. **D1 Migration (`migrations/0005_dynamic_feeds_and_filters.sql`):**
     - Create `ingest_feeds` table:
       - `id INTEGER PRIMARY KEY AUTOINCREMENT`
       - `name TEXT NOT NULL UNIQUE`
       - `url TEXT NOT NULL UNIQUE`
       - `focus_area TEXT NOT NULL`
       - `domain_sector_override TEXT` (optional default sector)
       - `items_per_poll INTEGER NOT NULL DEFAULT 5`
       - `enabled INTEGER NOT NULL DEFAULT 1`
       - `last_polled_at TEXT`
       - `last_status TEXT DEFAULT 'nominal'`
       - `last_error TEXT`
       - `total_ingested INTEGER NOT NULL DEFAULT 0`
       - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
       - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
     - Seed `ingest_feeds` with the 5 baseline feeds (`NPR Top News`, `PBS NewsHour Nation`, `NYT HomePage`, `WSJ US Business`, `Ars Technica`).
     - Create `ingest_filters` table:
       - `id INTEGER PRIMARY KEY AUTOINCREMENT`
       - `name TEXT NOT NULL`
       - `description TEXT NOT NULL DEFAULT ''`
       - `filter_type TEXT NOT NULL` (`'Drop_Keyword_Regex' | 'Require_Keyword_Regex' | 'Boost_Systemic_Prob' | 'Block_Source_Pattern' | 'Force_Working_Tool'`)
       - `match_target TEXT NOT NULL DEFAULT 'title_and_excerpt'` (`'title' | 'excerpt' | 'title_and_excerpt' | 'url'`)
       - `pattern TEXT NOT NULL` (comma-separated keywords or regular expression)
       - `scope_feed_id INTEGER` (`NULL` = applies to all feeds, or specific `ingest_feeds.id`)
       - `action_value TEXT` (e.g. `'drop'`, `'+0.20'`, `'square'`, etc.)
       - `enabled INTEGER NOT NULL DEFAULT 1`
       - `hit_count INTEGER NOT NULL DEFAULT 0`
       - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
       - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
     - Seed `ingest_filters` with the baseline low-signal noise exclusion rules (sports, celebrity, box office, recipes, horoscopes, wordle, etc.) and high-signal institutional boost rules from `src/pipeline/jev.ts`, plus a `system_settings` table holding global thresholds (`jev_min_systemic_prob = 0.70`, `jev_min_confidence = 0.50`, `max_net_new_per_run = 10`).
  2. **Upgrade Ingestion & Jev Pipeline (`src/pipeline/ingest.ts`, `src/pipeline/jev.ts`):**
     - Update `collectLatestUsRssItems` and `runD1IngestPipeline` to load active `ingest_feeds` (`WHERE enabled = 1`) from D1 (falling back to `US_HIGH_IMPACT_FEEDS` only if the table doesn't exist).
     - Before and after calling Jev, evaluate all active `ingest_filters` from D1:
       - `Drop_Keyword_Regex`: Immediately mark as `dropped` (or skip) before wasting System-2 tokens, incrementing `hit_count` on the filter row.
       - `Boost_Systemic_Prob`: Adjust systemic probability by the configured delta.
       - Apply the dynamic `jev_min_systemic_prob` threshold from `system_settings`.
     - Update `last_polled_at`, `last_status`, `last_error`, and `total_ingested` on each `ingest_feeds` row during ingestion.
  3. **Worker & Next.js Admin Endpoints:**
     - `GET / POST / PUT / DELETE /api/admin/feeds` + `POST /api/admin/feeds/test` (fetches and parses any candidate RSS/Atom URL live and returns a 5-item preview).
     - `GET / POST / PUT / DELETE /api/admin/filters` + `POST /api/admin/filters/test` (tests all active filters + a candidate pattern against live D1 articles or sample text to preview what gets dropped vs. triaged).
     - Every create, update, enable/disable toggle, threshold change, or delete logs a full `before`/`after` record in `audit_ledger`.
  4. **Admin Feeds UI (`/admin/feeds`) & Filters UI (`/admin/filters`):**
     - **`/admin/feeds`**: Add new feed (with **"Test RSS URL"** live preview button), edit feed name/URL/focus area/items-per-poll, toggle active/paused, or delete feed (with audit reason). Shows live health status and last poll timestamp for each feed.
     - **`/admin/filters`**: Add/edit/remove drop filters, boost rules, and regex patterns; adjust the global Jev Systemic Probability threshold slider (`0.50` – `0.95`); run the interactive **Filter Dry-Run Tester** against recent headlines.
  5. **Build, Apply Migrations & Deploy Live:**
     - Apply `0005_dynamic_feeds_and_filters.sql` locally and to remote D1 (`--remote`).
     - Deploy Worker (`npx wrangler deploy`) and Vercel (`npx vercel --prod --yes`).
- **Verification:**
  - Add a new RSS feed and a new filter rule via the API/UI, verify they persist in D1, verify the ingestion pipeline uses them, and verify `feed.create` / `filter.create` entries appear in `audit_ledger`.
- **Human Action Gate:** None.

---

## Issue #11 (Epic 6.6): Editorial Pipeline & Incident Studio — De-Alarmist Title Rewriting, Image Attachment Pipeline & Brief Overrides (`/admin/incidents` & `/admin/transforms`)
- **GitHub Issue:** [#11](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/11)
- **Status:** `[x] Completed`
- **Objective:** Enable both manual and automated editorial governance over articles and incidents: rewrite sensationalized, clickbait, or alarmist source headlines into calm, clinical SRE incident titles (while preserving `original_title` for audit disclosure), attach or generate incident images (via R2 upload, RSS media extraction, external URL, or SVG/PNG telemetry card generation), edit Socratic briefs/classifications, and configure automated pipeline transforms.
- **Automated Steps for Antigravity:**
  1. **D1 Migration (`migrations/0006_editorial_pipeline_and_images.sql`):**
     - Alter `telemetry_articles` to add editorial & media columns:
       - `original_title TEXT` (populated automatically with the raw RSS `<title>` on ingest so `title` can serve as the active display title, or vice versa—never losing the source headline)
       - `title_rewritten INTEGER NOT NULL DEFAULT 0`
       - `title_rewrite_reason TEXT`
       - `image_url TEXT`
       - `image_alt TEXT`
       - `image_caption TEXT`
       - `image_source_type TEXT` (`'rss_extracted' | 'r2_upload' | 'external_url' | 'generated_card' | NULL`)
       - `editorial_notes TEXT`
       - `is_pinned INTEGER NOT NULL DEFAULT 0`
       - `is_hidden INTEGER NOT NULL DEFAULT 0`
     - Backfill `original_title = title` for all existing rows in `telemetry_articles`.
     - Create `pipeline_transforms` table to configure automated pipeline stages:
       - `id INTEGER PRIMARY KEY AUTOINCREMENT`
       - `transform_key TEXT NOT NULL UNIQUE` (`'auto_deescalate_titles' | 'auto_extract_rss_images' | 'auto_generate_fallback_cards' | 'custom_system2_directive'`)
       - `name TEXT NOT NULL`
       - `description TEXT NOT NULL`
       - `enabled INTEGER NOT NULL DEFAULT 0`
       - `config_json TEXT NOT NULL DEFAULT '{}'`
       - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
     - Seed default `pipeline_transforms` rows:
       1. `auto_deescalate_titles`: Automatically rewrites alarmist, partisan, or clickbait headlines during System-2 synthesis into neutral, operational SRE incident titles while preserving `original_title`.
       2. `auto_extract_rss_images`: Extracts `<media:content>`, `<media:thumbnail>`, `<enclosure type="image/*">`, or `<img>` URLs from RSS items during ingestion.
       3. `auto_generate_fallback_cards`: Attaches a dynamic SVG/PNG Working Tool + SRE Failure Mode visual telemetry card when an incident has no source image.
       4. `custom_system2_directive`: Custom editorial prompt addendum injected into Gemini System-2 synthesis.
  2. **De-Alarmist Headline Rewriter & Image Pipeline (`src/pipeline/synthesize.ts`, `src/pipeline/ingest.ts`, `src/worker.ts`):**
     - Add `deescalateHeadlineWithGemini(title, excerpt, geminiApiKey)` (plus deterministic de-alarmist fallback) that strips sensational adjectives, all-caps shouting, partisan framing, and emotional bait, returning `{ neutralTitle: string, rationale: string }`.
     - When `auto_deescalate_titles` is enabled in `pipeline_transforms` (or when an Admin clicks **"De-Escalate Headline"** on any incident in `/admin/incidents`), save `original_title`, update `title` to the neutralized headline, set `title_rewritten = 1`, and log an `incident.rewrite_title` event to `audit_ledger` with both the original and rewritten titles.
     - Add R2 image upload & serving route (`POST /api/admin/media/upload` -> stores in R2 under `media/<timestamp>-<slug>.<ext>` and serves via `GET /media/:filename`).
     - Update RSS parser (`parseRssFeedItems`) to extract `<media:content>`, `<media:thumbnail>`, or image `<enclosure>` tags when `auto_extract_rss_images` is enabled.
  3. **Public UI & Admin Incident Studio (`/admin/incidents`):**
     - Build `/admin/incidents`:
       - Search and filter all `synthesized`, `triaged`, and `dropped` articles.
       - **Headline De-Escalation Panel:** View `Original Source Headline` vs. `Published Display Title`. Click **"AI De-Escalate Title"** to generate a clinical, non-alarmist rewrite, or type a manual title override with an audit reason.
       - **Image Attachment Panel:** Upload an image file to R2, paste an image URL, extract from source RSS, or attach a generated Working Tool telemetry card, with alt text and caption.
       - **Brief & Classification Override Editor:** Edit the Executive Summary, Socratic Brief, Proportionality Check, Questions, Primary/Secondary Working Tool, SRE Failure Mode, or status (`synthesized` / `triaged` / `dropped` / `hidden`), recording every edit in `audit_ledger`.
     - Update public Trestleboard (`src/app/page.tsx`) and Incident Detail page (`src/app/incidents/[slug]/page.tsx`) to display attached incident images (when present) and a subtle **"Title Neutralized · View Original in Audit Log"** transparency badge whenever `title_rewritten === 1`.
  4. **Build, Apply Migrations & Deploy Live:**
     - Apply `0006_editorial_pipeline_and_images.sql` locally and to remote D1 (`--remote`).
     - Deploy Worker (`npx wrangler deploy`) and Vercel (`npx vercel --prod --yes`).
- **Verification:**
  - In `/admin/incidents`, rewrite an alarmist headline and attach an image to a live incident; verify the updated title, transparency badge, and image render on `https://thecabcall.com/incidents/<slug>`, and verify `incident.rewrite_title` and `incident.attach_image` entries exist in `audit_ledger`.
- **Human Action Gate:** None.

---

## Issue #12 (Epic 6.7): Outbound Published Feeds & Syndication Studio (`/admin/publishing`, `/feed.xml` & `/feeds/incidents.*`)
- **GitHub Issue:** [#12](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/12)
- **Status:** `[x] Completed`
- **Objective:** Give the Admin full control over all feeds that `thecabcall.com` publishes to the outside world—allowing you to modify the podcast RSS feed (`/feed.xml`) metadata and rules, and publishing new syndicated **Incident Brief Feeds** (`/feeds/incidents.xml` RSS 2.0, `/feeds/incidents.json` JSON Feed) where you can choose whether subscribers receive de-alarmed titles, attached incident images (`<media:content>` / `<enclosure>`), full Socratic briefs or executive summaries, and optional inline audit provenance links.
- **Automated Steps for Antigravity:**
  1. **D1 Migration (`migrations/0007_outbound_published_feeds.sql`):**
     - Create `outbound_feeds` table:
       - `id INTEGER PRIMARY KEY AUTOINCREMENT`
       - `slug TEXT NOT NULL UNIQUE` (`'podcast-rss'`, `'incidents-rss'`, `'incidents-json'`)
       - `title TEXT NOT NULL`
       - `subtitle TEXT NOT NULL`
       - `description TEXT NOT NULL`
       - `author_name TEXT NOT NULL`
       - `owner_email TEXT NOT NULL`
       - `cover_image_url TEXT`
       - `language TEXT NOT NULL DEFAULT 'en-us'`
       - `category TEXT NOT NULL DEFAULT 'Technology'`
       - `max_items INTEGER NOT NULL DEFAULT 50`
       - `use_deescalated_titles INTEGER NOT NULL DEFAULT 1`
       - `include_original_title_note INTEGER NOT NULL DEFAULT 1`
       - `include_attached_images INTEGER NOT NULL DEFAULT 1`
       - `include_full_socratic_brief INTEGER NOT NULL DEFAULT 1`
       - `include_audit_ledger_footer INTEGER NOT NULL DEFAULT 1`
       - `filter_working_tool TEXT` (`NULL` = all tools)
       - `enabled INTEGER NOT NULL DEFAULT 1`
       - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
     - Seed default rows for `'podcast-rss'` (`/feed.xml`), `'incidents-rss'` (`/feeds/incidents.xml`), and `'incidents-json'` (`/feeds/incidents.json`).
  2. **Dynamic Outbound Feed Endpoints (`src/app/feed.xml/route.ts`, `src/app/feeds/incidents.xml/route.ts`, `src/app/feeds/incidents.json/route.ts`):**
     - Upgrade `/feed.xml` to read its channel title, description, author, cover image, max items, and episode list dynamically from D1 `outbound_feeds` + `episodes`.
     - Create `/feeds/incidents.xml` (valid RSS 2.0 with `xmlns:media="http://search.yahoo.com/mrss/"` and `xmlns:content="http://purl.org/rss/1.0/modules/content/"`) and `/feeds/incidents.json` (JSON Feed 1.1):
       - Respects `use_deescalated_titles` (outputs the neutralized `title` or raw `original_title`).
       - When `include_original_title_note = 1` and a headline was rewritten, appends a transparent provenance line in the item body (`Original source headline: "..."`).
       - When `include_attached_images = 1` and an incident has `image_url`, emits `<media:content url="..." medium="image" />` and `<enclosure>` / JSON Feed `image` fields so RSS readers and newsletter tools automatically render the attached images.
       - When `include_audit_ledger_footer = 1`, includes the cryptographic audit verification summary in each item footer.
       - Supports query filter `?tool=square` or custom admin-created feed slugs (`/feeds/[slug].xml`).
  3. **Admin Publishing Studio UI (`/admin/publishing/page.tsx`):**
     - Edit channel metadata (Title, Subtitle, Description, Cover Art upload/URL, Author, Max Items) for both Podcast RSS (`/feed.xml`) and Incident Feeds (`/feeds/incidents.xml`, `/feeds/incidents.json`).
     - Toggle feed behavior switches (`Use De-Alarmed Titles`, `Show Original Headline Provenance Note`, `Attach Incident Images (<media:content>)`, `Include Full Socratic Brief`, `Include Audit Trail Verification Footer`).
     - Create custom filtered outbound feeds (e.g. a dedicated feed for `The Square` or `Technology & Cyber`).
     - Live XML / JSON previewer inside `/admin/publishing` and full `outbound_feed.update` audit logging in `audit_ledger`.
  4. **Build, Apply Migrations & Deploy Live:**
     - Apply `0007_outbound_published_feeds.sql` locally and to remote D1 (`--remote`).
     - Deploy Worker (`npx wrangler deploy`) and Vercel (`npx vercel --prod --yes`).
- **Verification:**
  - Verify `https://thecabcall.com/feed.xml`, `https://thecabcall.com/feeds/incidents.xml`, and `https://thecabcall.com/feeds/incidents.json` return `200 OK` with valid XML/JSON, reflect settings modified in `/admin/publishing`, include `<media:content>` images and de-alarmed titles, and log `outbound_feed.update` in `audit_ledger`.
- **Human Action Gate:** None.

---

# Epic #21: Admin Dashboard Redesign — "The Editor's Study" (Simplification & UI Polish — Issues #22 – #26)

- **GitHub Epic:** [#21](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/21)
- **Status:** `[x] Completed`
- **Objective:** Transform `/admin` from an overcrowded 3 AM NOC database terminal into **"The Editor's Study"**—a calm, cohesive, plain-English editorial command desk matching the public Trestleboard aesthetic (`#0B0E14` Deep Obsidian, `#111726` Lodge Room, `#C5A059` / `#8A6D3B` Burnished Brass, `Cinzel` & `Newsreader` serif typography, architectural corner brackets) while preserving 100% of our cryptographic `audit_ledger` guarantees.

### Issue #22 (Sub-Issue 1): Navigation Consolidation & Header De-cluttering
- **GitHub Issue:** [#22](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/22)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/AdminShellNav.tsx`, `src/app/admin/layout.tsx`, `src/components/SiteHeader.tsx`, `src/components/AdminOverviewClient.tsx`
- **Deliverables:**
  1. Consolidate the 8 scrolling tabs in `ADMIN_NAV_TABS` (`src/components/AdminShellNav.tsx`) into 4 clean, non-scrolling tabs: `Overview` (`/admin`), `Editorial & Feeds` (`/admin/incidents`), `Podcast Studio` (`/admin/episodes`), and `Settings & Audit` (`/admin/audit`).
  2. Strip noisy telemetry metadata (`Owner Lock`, OAuth method badges, `jev-1.14.0`, `gemini-2.5-flash`) from the header; replace with a single compact status badge next to `Public Site ↗` and `Sign Out`, and only surface an alert banner if an actual error or chain verification failure (`chainIntegrity.valid === false`) occurs.
  3. Apply `font-display` (`Cinzel`) typography and subtle Burnished Brass (`#C5A059` / `#8A6D3B`) accents to the admin header.

### Issue #23 (Sub-Issue 2): Overview Tab Simplification & Plain-English Action Cards
- **GitHub Issue:** [#23](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/23)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/AdminOverviewClient.tsx`, `src/app/admin/page.tsx`
- **Deliverables:**
  1. Redesign the 4 Quick-Action cards into tactile, plain-English editorial triggers (`"Fetch Latest News"`, `"Synthesize Case Briefs"`, `"Generate Weekly Episode"`, `"Verify Ledger"`), removing `POST /api/...` labels and `STAGE 1–5` jargon, with clean loading states and inline feedback.
  2. Condense the 6 giant KPI cards into a single compact 5-metric horizontal summary strip (**Active Stories**, **Monitored Feeds**, **Filter Rules**, **Published Episodes**, **Ledger Status**).
  3. Remove the 20-row SHA-256 `Recent Audit Trail Events` table and raw `PIPELINE_RUNS` table from Overview; replace with a 5-item plain-English **"Recent Activity & Pipeline Runs"** feed with a subtle checkmark badge revealing hash/latency details only on hover.

### Issue #24 (Sub-Issue 3): Podcast Studio Overhaul (Compact List & Slide-Out Inspector Drawer)
- **GitHub Issue:** [#24](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/24)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/AdminEpisodesClient.tsx`, `src/app/admin/episodes/page.tsx`
- **Deliverables:**
  1. Replace bloated vertical episode cards with a sleek, scannable episode list/grid showing Episode #, Title, Series Badge (`Weekly Brief` vs `Legacy Archive`), Publish Date, Duration, and a 2-line truncated description (`line-clamp-2`).
  2. Implement a slide-out side inspector drawer when clicking an episode to handle playback (single shared audio player), full description/transcript editing, metadata inspection (`r2Key`, `fileSizeBytes`), and deletion.
  3. Remove the redundant `"Recent Episode Lifecycle Events"` log at the bottom of `/admin/episodes`.

### Issue #25 (Sub-Issue 4): Unified "Editorial & Feeds" Workspace
- **GitHub Issue:** [#25](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/25)
- **Status:** `[x] Completed`
- **Target Files:** `src/app/admin/incidents/page.tsx`, `src/components/AdminIncidentsClient.tsx`, `src/components/AdminFeedsClient.tsx`, `src/components/AdminFiltersClient.tsx`, `src/app/admin/feeds/page.tsx`, `src/app/admin/filters/page.tsx`, `src/app/admin/transforms/page.tsx`
- **Deliverables:**
  1. Create a unified editorial workspace where stories ("Incidents") are the primary view, styled with the readability of the public site.
  2. Provide clean collapsible drawers or segmented sub-views for managing the 5 RSS sources and Triage Rules without leaving the editorial context.
  3. Replace raw internal jargon (`P(systemic) >= 0.70`, `jev-1.14.0`, `Headline De-escalation`, `Drop_Keyword_Regex`) with clear, human-readable labels (**"Minimum Relevance Score"**, **"Editorial Tone & Filtering"**, **"Calm Headline Rewrite"**).

### Issue #26 (Sub-Issue 5): Aesthetic Polish & Micro-Interactions ("Delight" Pass)
- **GitHub Issue:** [#26](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/26)
- **Status:** `[x] Completed`
- **Target Files:** `src/app/globals.css`, `src/components/AdminShellNav.tsx`, `src/components/AdminOverviewClient.tsx`, `src/components/AdminEpisodesClient.tsx`, `src/components/AdminIncidentsClient.tsx`, `src/components/AdminFeedsClient.tsx`, `src/components/AdminFiltersClient.tsx`, `src/components/AdminUsersClient.tsx`, `src/components/AdminAuditClient.tsx`, `src/components/AdminLoginClient.tsx`
- **Deliverables:**
  1. Align `/admin` CSS tokens with the public Trestleboard palette (`#0B0E14` obsidian surfaces, `#111726` lodge room cards, `#C5A059` / `#8A6D3B` burnished brass highlights, `#F3EFE6` parchment text, subtle corner brackets on primary containers).
  2. Reserve `font-mono` strictly for actual code/IDs/hashes inside tooltips or the advanced audit view—use clean `font-display` (`Cinzel`), `font-serif` (`Newsreader`), and `font-sans` (`Inter`) pairings for all primary labels and tables.
  3. Add smooth transitions for tab switching, drawer opening, and pipeline trigger buttons.

---

# Epic #27: Header & Navigation Architecture — Two-Tier Editorial Masthead & Extensible Dropdown System (Issues #28 – #32)

- **GitHub Epic:** [#27](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/27)
- **Status:** `[x] Completed`
- **Objective:** Restructure the site header into an authoritative **Two-Tier Editorial Masthead** (Tier 1: The Masthead, Tier 2: The Sticky Navigation Ledger) aligned horizontally with the `CAB Weekly Brief` hero container (`max-w-7xl mx-auto px-4 sm:px-6`), enhance `SquareAndCompassesCrest` with a solid `#070A10` seal backing, ambient gold glow, `15deg` / `600ms` degree-ring hover rotation, and a `1px` vertical gold plumb-line divider, and replace the individual boxed nav buttons with a data-driven horizontal ledger bar featuring architectural hover dropdown panels (1-column & 2-column mega-menus, gold corner-tick brackets, `150ms` hover-intent delay + `10px` CSS bridge, sticky Tier-2 scrolling, and full touch/keyboard accessibility).

### Issue #28 (Sub-Issue 1): Refactor header into a two-tier editorial masthead and align max-width container
- **GitHub Issue:** [#28](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/28)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/SiteHeader.tsx`, `src/components/TrestleboardClient.tsx`

### Issue #29 (Sub-Issue 2): Enhance Square & Compasses logo emblem with solid seal backing, scaling, and plumb-line divider
- **GitHub Issue:** [#29](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/29)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/MasonicEngravings.tsx`, `src/components/SiteHeader.tsx`

### Issue #30 (Sub-Issue 3): Create a data-driven navigation configuration schema for multi-level dropdowns
- **GitHub Issue:** [#30](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/30)
- **Status:** `[x] Completed`
- **Target Files:** `src/lib/navigation.ts`, `src/components/SiteHeader.tsx`, `src/app/incidents/page.tsx`

### Issue #31 (Sub-Issue 4): Build architectural dropdown menu panels and ledger navigation bar styling
- **GitHub Issue:** [#31](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/31)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/SiteHeader.tsx`, `src/app/globals.css`

### Issue #32 (Sub-Issue 5): Implement dropdown hover-intent protection, sticky nav bar, and keyboard/touch accessibility
- **GitHub Issue:** [#32](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/32)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/SiteHeader.tsx`, `src/app/globals.css`

---

# Epic #33: Podcast Archive Unification & Episode Description Data Cleanup (Issues #34 – #38)

- **GitHub Epic:** [#33](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/33)
- **Status:** `[x] Completed`
- **Objective:** Unify the Podcast Archive (`/archive` and `/podcast`) around our core two-host NotebookLM conversational deep-dive workflow fed by live `thecabcall.com` pages and ledger briefs, eliminate the deprecating `"Legacy"` vs. `"5-Minute Brief"` split, sanitize raw Markdown/tables/URLs out of historical Episode #1–#21 descriptions into structured source records, deduplicate AI generation disclaimers, standardize left-aligned square artwork thumbnails (with engraved SVG fallback emblems), and adapt the expandable drawer into a cohesive **"Episode Guide & Transcript"** viewer.

### Issue #34 (Sub-Issue 1): Simplify Podcast Page Masthead & Replace "Legacy / 5m Brief" Filter Tabs
- **GitHub Issue:** [#34](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/34)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/PodcastArchiveClient.tsx`, `src/app/archive/page.tsx`, `src/lib/navigation.ts`, `next.config.ts`, `src/app/feed.xml/route.ts`

### Issue #35 (Sub-Issue 2): Sanitize Episode #1–#21 Descriptions (Strip Raw Markdown, Tables, and Inline URLs)
- **GitHub Issue:** [#35](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/35)
- **Status:** `[x] Completed`
- **Target Files:** `scripts/import-legacy-episodes.ts`, `src/lib/episode-metadata.ts`, `src/lib/d1-bridge.ts`, `src/lib/dto.ts`, `src/lib/types.ts`, `src/lib/seed-data.ts`, `src/components/PodcastArchiveClient.tsx`, `migrations/0008_podcast_archive_unification_and_cleanup.sql`

### Issue #36 (Sub-Issue 3): Deduplicate AI Generation Disclaimers Across Episode Cards
- **GitHub Issue:** [#36](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/36)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/PodcastArchiveClient.tsx`, `scripts/import-legacy-episodes.ts`, `src/lib/episode-metadata.ts`, `src/lib/d1-bridge.ts`, `src/components/SiteFooter.tsx`, `src/app/feed.xml/route.ts`

### Issue #37 (Sub-Issue 4): Unify Episode Card Layout & Artwork Thumbnails
- **GitHub Issue:** [#37](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/37)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/PodcastArchiveClient.tsx`, `src/components/MasonicEngravings.tsx`

### Issue #38 (Sub-Issue 5): Adapt the Expandable "Read Script" Drawer for NotebookLM Episodes
- **GitHub Issue:** [#38](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/38)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/PodcastArchiveClient.tsx`, `src/lib/episode-metadata.ts`, `src/lib/types.ts`, `src/lib/dto.ts`, `src/lib/d1-bridge.ts`, `src/components/AdminEpisodesClient.tsx`

---

# Epic #44: Information Architecture & Scale — Dedicated Tool/SRE Hub Pages, Navigation Alignment & 1,000-Item Archive Pagination (Issues #39 – #43)

- **GitHub Epic:** [#44](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/44)
- **Status:** `[x] Completed`
- **Objective:** Align the Two-Tier Navigation Ledger (`src/lib/navigation.ts`) and URL routing directly with the canonical 3-axis taxonomy (`src/lib/taxonomy.ts`), introduce dedicated monograph Hub pages for all 6 Masonic Working Tools (`/tools/[slug]`) and all 6 Structural Failure Modes (`/failures/[slug]`) with bespoke copperplate engravings and live cross-axis telemetry breakdowns, streamline `/rubric` into a clean Three-Axis Methodology Codex & Visual Directory, and refactor `/archive` (with `/knowledge-graph` alias and `/podcast` dedicated route) for 1,000-item scale with D1 composite indexes (`migrations/0010_archive_pagination_indexes.sql`), URL-synchronized pagination (`25` per page), a 6×6 brass heatmap matrix (`#matrix`), a Monitored Publications view (`?view=sources`), and a 6-column zero-horizontal-overflow ledger table.

### Issue #39 (Sub-Issue 1): [Navigation & Taxonomy] Align Header Dropdowns & Canonical Slug Mappings with `taxonomy.ts`
- **GitHub Issue:** [#39](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/39)
- **Status:** `[x] Completed`
- **Target Files:** `src/lib/taxonomy.ts`, `src/lib/navigation.ts`, `src/components/SiteHeader.tsx`, `src/components/SiteFooter.tsx`

### Issue #40 (Sub-Issue 2): [Routing & Content] Create Dedicated Dynamic Hub Pages for the Six Working Tools (`/tools/[slug]`)
- **GitHub Issue:** [#40](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/40)
- **Status:** `[x] Completed`
- **Target Files:** `src/app/tools/[slug]/page.tsx`, `src/components/WorkingToolHubClient.tsx`, `src/lib/taxonomy.ts`, `src/lib/d1-bridge.ts`, `src/lib/store.ts`

### Issue #41 (Sub-Issue 3): [Routing & Content] Create Dedicated Dynamic Hub Pages for the Six Structural Failure Modes (`/failures/[slug]`)
- **GitHub Issue:** [#41](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/41)
- **Status:** `[x] Completed`
- **Target Files:** `src/app/failures/[slug]/page.tsx`, `src/components/FailureModeHubClient.tsx`, `src/components/MasonicEngravings.tsx`, `src/lib/taxonomy.ts`, `src/lib/d1-bridge.ts`, `src/lib/store.ts`

### Issue #42 (Sub-Issue 4): [UX Refactor] Streamline `/rubric` into a Clean Methodology Codex & Visual Directory
- **GitHub Issue:** [#42](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/42)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/RubricCodexClient.tsx`, `src/components/RubricInspectorDrawer.tsx`, `src/app/rubric/page.tsx`

### Issue #43 (Sub-Issue 5): [Scale & Data] Archive Scalability Refactor: Server-Side Pagination, URL State, 6×6 Brass Heatmap & Zero Horizontal Overflow
- **GitHub Issue:** [#43](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/43)
- **Status:** `[x] Completed`
- **Target Files:** `migrations/0010_archive_pagination_indexes.sql`, `src/lib/d1-bridge.ts`, `src/lib/store.ts`, `src/worker.ts`, `src/components/KnowledgeGraphClient.tsx`, `src/app/archive/page.tsx`, `src/app/knowledge-graph/page.tsx`, `src/app/podcast/page.tsx`, `next.config.ts`, `src/middleware.ts`

---

# Epic #45: Krug "Don't Make Me Think" Global UI/UX Flattening & Readability Overhaul (`thecabcall.com` + `admin.thecabcall.com`) (Issues #46 – #51)

- **GitHub Epic:** [#45](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/45)
- **Status:** `[x] Completed`
- **Objective:** Bring the clean, flat, effortlessly scannable broadsheet hierarchy of the homepage (`The Trestleboard`) to every public page, dynamic hub, case brief, and `admin.thecabcall.com` view by enforcing four global rules: (1) **Max 1 Border Depth** (no nested bordered boxes), (2) **1 Eyebrow + 1 Heading Maximum** (no triple-stacked headers or `//` dual-subtitles inside cards), (3) **One Primary Action Per Card**, and (4) **Never Repeat Identical Metadata** across cards or rows.

### Issue #46 (Sub-Issue 1): Podcast Page (`/podcast`) — Transcript Formatting, Paragraph Segmentation & Drawer Flattening
- **GitHub Issue:** [#46](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/46)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/PodcastArchiveClient.tsx`, `src/app/podcast/page.tsx`, `src/lib/episode-metadata.ts`, `scripts/import-legacy-episodes.ts`

### Issue #47 (Sub-Issue 2): Working Tools & Rubric Page (`/rubric`) — 50% Card Diet & Redundancy Removal
- **GitHub Issue:** [#47](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/47)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/RubricCodexClient.tsx`, `src/components/RubricInspectorDrawer.tsx`, `src/app/rubric/page.tsx`

### Issue #48 (Sub-Issue 3): About & Feeds Page (`/about`, `/status`, `/feeds`) — Collapse the 51-Card Wall, De-Nest Pillars & Slim Feed Cards
- **GitHub Issue:** [#48](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/48)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/SystemStatusClient.tsx`, `src/app/status/page.tsx`, `src/app/feeds/page.tsx`, `src/app/about/page.tsx`

### Issue #49 (Sub-Issue 4): Unseen Public Pages Audit & Flattening (`/archive`, `/tools/[slug]`, `/failures/[slug]`, `/incidents/[slug]`)
- **GitHub Issue:** [#49](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/49)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/KnowledgeGraphClient.tsx`, `src/components/WorkingToolHubClient.tsx`, `src/components/FailureModeHubClient.tsx`, `src/components/IncidentBriefClient.tsx`

### Issue #50 (Sub-Issue 5): `admin.thecabcall.com` — Apply Krug "Don't Make Me Think" Discipline Across the Admin Portal
- **GitHub Issue:** [#50](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/50)
- **Status:** `[x] Completed`
- **Target Files:** `src/components/AdminOverviewClient.tsx`, `src/components/AdminIncidentsClient.tsx`, `src/components/AdminEpisodesClient.tsx`, `src/components/AdminFeedsClient.tsx`, `src/components/AdminFiltersClient.tsx`, `src/components/AdminAuditClient.tsx`, `src/components/AdminUsersClient.tsx`, `src/components/AdminLoginClient.tsx`, `src/app/admin/publishing/page.tsx`

### Issue #51 (Sub-Issue 6): Global CSS & Component Primitives Enforcement — Max 1 Border Depth & Flat Broadsheet Primitives
- **GitHub Issue:** [#51](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/51)
- **Status:** `[x] Completed`
- **Target Files:** `src/app/globals.css`, `src/components/MasonicEngravings.tsx`, `src/components/ui/BroadsheetPrimitives.tsx`, `src/components/TrestleboardClient.tsx`, `src/components/IncidentCard.tsx`

