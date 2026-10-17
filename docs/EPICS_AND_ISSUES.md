# The CAB Call (`thecabcall.com`) — Master Epics & Issues Roadmap

> **How to use this document with Antigravity:**
> Open a new Antigravity session in this repository and simply say:
> - **`"Implement Epic #1"`** (or `"Implement Epic #2"`, `"Implement Epic #3"`, etc.)
> - Or target a specific issue: **`"Implement Issue 2.1"`**
>
> Antigravity is configured via [`AGENTS.md`](../AGENTS.md) to execute every issue in the requested Epic **autonomously from start to finish**, running all verification checks automatically, and **only pausing when it hits a `[HUMAN ACTION GATE]`** (a step requiring your interactive login, external dashboard action, or files). When it pauses at a gate, it will give you exact, copy-pasteable instructions for what to do and wait for you to reply `"Done, continue"`.

---

## Current Project Snapshot

| Component | Current Status | Location |
| :--- | :--- | :--- |
| **Next.js 15 Frontend (6 Core Pages)** | Built & working locally | `src/app/`, `src/components/` |
| **System-1 Classifier (TypeSafe Jev `jev-1.14.0`)** | Live on Cloudflare Edge & working locally | `src/pipeline/jev.ts`, `src/pipeline/ingest.ts` |
| **System-2 Synthesis (Gemini 2.5 Flash)** | Live on Cloudflare Edge & working locally | `src/pipeline/synthesize.ts` |
| **Friday 5-Min Podcast Rollup + TTS Audio** | Live on Cloudflare Edge & R2 (`cabcall-audio`) | `src/pipeline/rollup.ts` |
| **Cloudflare Worker Entrypoint & Crons** | Deployed (`https://thecabcall.thecabcall.workers.dev`) | `src/worker.ts`, `wrangler.jsonc` |
| **D1 SQLite Schema & Migrations** | Applied to remote `cabcall-db` (`094cf69c-0fe3-409b-a871-06f3610a28a6`) & local `.wrangler` | `migrations/0001_init.sql`, `migrations/0002_pipeline_runs.sql` |
| **Database & Audio Bridge** | Live Cloud Worker Bridge (`/api/snapshot` + R2 audio) with local `.wrangler` fallback | `src/lib/d1-bridge.ts`, `src/lib/store.ts` |

---

## Epic Overview (Synced with GitHub Issues)

- [x] **Epic #1 ([GitHub Issue #1](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/1)): Repository Baseline, Clean Build & Git Synchronization**
- [x] **Epic #2 ([GitHub Issue #2](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/2)): Cloudflare Cloud Provisioning (Live D1 Database, R2 Audio Bucket & Worker Deployment)**
- [x] **Epic #3 ([GitHub Issue #3](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/3)): Cloud Bridge — Connecting the Live Next.js Website to Production Cloudflare D1 & R2**
- [ ] **Epic #4 ([GitHub Issue #4](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/4)): Production Frontend Deployment (Vercel) & Custom Domain Cutover (`thecabcall.com`)**
- [ ] **Epic #5 ([GitHub Issue #5](https://github.com/Columbia-Cloudworks-LLC/thecabcall.com/issues/5)): Legacy Podcast Archive Migration & Voice Cloning / TTS Enhancement**

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
- **Automated Steps for Antigravity:**
  1. Run `npx wrangler whoami` to check if Wrangler has an active Cloudflare session.
  2. If authenticated, proceed immediately to Issue 2.2.
  3. If `npx wrangler whoami` fails with an expired/missing token error, **STOP** and trigger the Human Action Gate below.
- **[HUMAN ACTION GATE] — Cloudflare Login Required:**
  > **Why Antigravity paused:** Your Cloudflare Wrangler CLI token is expired or not logged in, and Cloudflare requires an interactive browser login.
  >
  > **Steps for you to perform:**
  > 1. Open your terminal in `d:\repos\thecabcall.com`
  > 2. Run:
  >    ```powershell
  >    npx wrangler login
  >    ```
  > 3. Click **Allow** in the browser window that opens.
  > 4. Come back here and reply: **`"Done, continue"`**

### Issue 2.2: Provision Production Cloudflare D1 Database & R2 Bucket
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Check existing D1 databases via `npx wrangler d1 list`. If `cabcall-db` does not exist, create it via:
     ```powershell
     npx wrangler d1 create cabcall-db
     ```
  2. Extract the real `database_id` UUID from the output and replace `"00000000-0000-0000-0000-000000000000"` in [`wrangler.jsonc`](../wrangler.jsonc).
  3. Check existing R2 buckets via `npx wrangler r2 bucket list`. If `cabcall-audio` does not exist, create it via:
     ```powershell
     npx wrangler r2 bucket create cabcall-audio
     ```
- **Verification:** `wrangler.jsonc` contains a real UUID for `cabcall-db`, and both `cabcall-db` and `cabcall-audio` exist in the Cloudflare account.
- **Human Action Gate:** Only if Cloudflare R2 is not yet enabled on the user's Cloudflare account (if Wrangler reports R2 needs activation, instruct the user to click **R2 Object Storage -> Activate** in the Cloudflare Dashboard at `https://dash.cloudflare.com`).

### Issue 2.3: Apply D1 Migrations to Remote Production Database
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Execute remote D1 migrations against Cloudflare:
     ```powershell
     npx wrangler d1 migrations apply cabcall-db --remote
     ```
  2. Verify tables exist remotely:
     ```powershell
     npx wrangler d1 execute cabcall-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
     ```
- **Verification:** Remote `cabcall-db` contains `telemetry_articles`, `episodes`, and `pipeline_runs`.
- **Human Action Gate:** None.

### Issue 2.4: Configure Production Secrets & Deploy Cloudflare Worker
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Read `TYPESAFE_API_KEY`, `GEMINI_API_KEY`, and `ADMIN_SECRET` from local `.dev.vars` (if `.dev.vars` is missing any key, trigger a Human Action Gate asking the user to add it to `.dev.vars`).
  2. Deploy the Cloudflare Worker:
     ```powershell
     npx wrangler deploy
     ```
  3. Push each secret to the deployed Cloudflare Worker (`TYPESAFE_API_KEY`, `GEMINI_API_KEY`, `ADMIN_SECRET`) using `npx wrangler secret put <KEY_NAME>` via stdin pipe.
  4. Record the live Worker URL (`https://thecabcall.thecabcall.workers.dev`).
- **Verification:** `GET https://thecabcall.thecabcall.workers.dev/` returns `200 OK` JSON with service health metadata.
- **Human Action Gate:** Only if `.dev.vars` is missing `TYPESAFE_API_KEY` or `GEMINI_API_KEY`.

### Issue 2.5: Seed Live Cloud Telemetry (Run Ingest, Synthesis & Rollup on Production Worker)
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Call `POST https://thecabcall.thecabcall.workers.dev/api/test-jev` with `x-admin-secret` to verify live TypeSafe Jev classification on the edge.
  2. Call `POST https://thecabcall.thecabcall.workers.dev/api/run-ingest?synthesize=true` with `x-admin-secret` to ingest live RSS feeds into remote D1 and synthesize Socratic briefs via Gemini.
  3. Call `POST https://thecabcall.thecabcall.workers.dev/api/run-rollup` with `x-admin-secret` to generate the Friday 5-Minute CAB Weekly Brief and store its MP3 in remote R2 (`cabcall-audio`).
  4. Verify `GET https://thecabcall.thecabcall.workers.dev/audio/cab-weekly-brief-43-2026-10-17.mp3` returns `200 OK` (`audio/mpeg`).
- **Verification:** Remote D1 contains synthesized articles and a live episode, and remote R2 streams the episode MP3.
- **Human Action Gate:** None.

---

# Epic #3: Cloud Bridge — Connecting the Live Next.js Website to Production Cloudflare D1 & R2

**Objective:** Upgrade `src/worker.ts`, `src/lib/d1-bridge.ts`, `src/lib/store.ts`, and the Next.js API routes so that when the Next.js frontend runs in the cloud (e.g., on Vercel where `.wrangler/` local SQLite files do not exist), it automatically reads and writes live incidents, episodes, pipeline runs, and MP3 audio from the deployed Cloudflare Worker (`WORKER_API_URL`) instead of falling back to static dummy data.

### Issue 3.1: Add Live Telemetry Snapshot Endpoint to Cloudflare Worker (`src/worker.ts`)
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Add `GET /api/snapshot` to [`src/worker.ts`](../src/worker.ts) that queries `env.DB` (`telemetry_articles`, `episodes`, `pipeline_runs`) and returns the structured snapshot JSON with short edge caching (`Cache-Control: public, s-maxage=30, stale-while-revalidate=120`) and CORS headers.
  2. Redeploy the Cloudflare Worker via `npx wrangler deploy` and verify `GET <WORKER_URL>/api/snapshot` returns all live D1 rows.
- **Verification:** `GET <WORKER_URL>/api/snapshot` returns `200 OK` with `articles`, `episodes`, and `pipelineRuns` arrays from production D1.
- **Human Action Gate:** None.

### Issue 3.2: Upgrade Next.js Data Layer & API Routes to Use Production Worker Bridge
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Update [`src/lib/d1-bridge.ts`](../src/lib/d1-bridge.ts) and [`src/lib/store.ts`](../src/lib/store.ts) so that when `WORKER_API_URL` (or `NEXT_PUBLIC_WORKER_URL`) is configured (or in production when local `.wrangler` SQLite is absent), data reads/writes sync with the remote Cloudflare Worker `/api/snapshot`, `/api/run-ingest`, `/api/run-synthesize`, `/api/run-rollup`, and `/audio/:filename` endpoints.
  2. Update `/audio/[filename]/route.ts`, `/api/cron/ingest/route.ts`, and `/api/cron/weekly-rollup/route.ts` so Vercel Cron or UI triggers proxy cleanly to the production Cloudflare Worker when running in the cloud.
  3. Preserve local `.wrangler` SQLite support as a seamless local fallback when developing offline.
- **Verification:** Running Next.js with `WORKER_API_URL` set (and `.wrangler` temporarily bypassed) renders live D1 articles, live posture telemetry, and plays live R2 audio from the production Worker.
- **Human Action Gate:** None.

### Issue 3.3: Build, Commit & Push Cloud Bridge
- **Status:** `[x] Completed`
- **Automated Steps for Antigravity:**
  1. Run `npm run build` to ensure all Server Components and API routes compile cleanly.
  2. Commit and push changes to `origin/main`.
- **Verification:** `npm run build` succeeds and `git status` is clean.
- **Human Action Gate:** None.

---

# Epic #4: Production Frontend Deployment (Vercel) & Custom Domain Cutover (`thecabcall.com`)

**Objective:** Deploy the Next.js frontend to Vercel production with all cloud environment variables wired to the production Cloudflare Worker, verify that `thecabcall.com` points to the live deployment, and verify all 6 pages + podcast RSS feed (`/feed.xml`) in production.

### Issue 4.1: Configure Vercel Environment Variables & Deploy Production Release
- **Status:** `[ ] Pending`
- **Automated Steps for Antigravity:**
  1. Verify Vercel CLI authentication via `npx vercel whoami` (if not logged in, trigger Human Action Gate for `npx vercel login`).
  2. Add/update production environment variables on Vercel (`WORKER_API_URL`, `NEXT_PUBLIC_WORKER_URL`, `ADMIN_SECRET`, `TYPESAFE_API_KEY`, `GEMINI_API_KEY`) using `npx vercel env`.
  3. Trigger a production deployment via `npx vercel --prod --yes`.
- **Verification:** Production Vercel URL returns `200 OK` and displays live D1 telemetry from the Cloudflare Worker.
- **Human Action Gate:** Only if `npx vercel whoami` shows the session is expired (instruct user to run `npx vercel login`).

### Issue 4.2: Custom Domain (`thecabcall.com`) DNS & SSL Cutover
- **Status:** `[ ] Pending`
- **Automated Steps for Antigravity:**
  1. Check domain configuration on the Vercel project via `npx vercel domains inspect thecabcall.com` or `npx vercel alias`.
  2. Check live DNS resolution for `thecabcall.com` and `www.thecabcall.com` using `Resolve-DnsName thecabcall.com`.
  3. If `thecabcall.com` is not yet attached or DNS points to an old WordPress host, attach the domain to the project and trigger the Human Action Gate with the exact DNS records required.
- **[HUMAN ACTION GATE] — Domain DNS Cutover (If Needed):**
  > **Why Antigravity paused:** If `thecabcall.com` is still pointing to your old host or needs DNS records updated in your Cloudflare/Registrar DNS dashboard:
  >
  > **Steps for you to perform:**
  > 1. Log in to your DNS provider (Cloudflare Dashboard -> `thecabcall.com` -> **DNS -> Records**).
  > 2. Set the root `@` (`thecabcall.com`) `A` record to `76.76.21.21` (with Cloudflare Proxy set to **DNS Only / Grey Cloud** during SSL provisioning, or as instructed by Vercel).
  > 3. Set `www` `CNAME` to `cname.vercel-dns.com`.
  > 4. Reply **`"Done, continue"`** once saved.

### Issue 4.3: End-to-End Production Smoke Test
- **Status:** `[ ] Pending`
- **Automated Steps for Antigravity:**
  1. Verify HTTP `200 OK` and live data rendering across all 6 production routes:
     - `/` (The Trestleboard)
     - `/incidents/<live-slug>` (Post-Incident Review Brief)
     - `/knowledge-graph` (6×6 Matrix)
     - `/archive` (Podcast Hub)
     - `/rubric` (The Rubric & Working Tools)
     - `/status` (System Status & Live Sandbox)
  2. Verify `/feed.xml` returns valid RSS 2.0 XML with `<enclosure>` audio URLs that return HTTP `200`/`206` byte-range responses.
- **Verification:** All 6 pages, `/api/telemetry`, and `/feed.xml` respond live in production.
- **Human Action Gate:** None.

---

# Epic #5: Legacy Podcast Archive Migration & Voice Cloning / TTS Enhancement

**Objective:** Permanently re-host historical *Change Advisory Board* podcast episodes in Cloudflare R2 (`cabcall-audio`) and D1 (`episodes`) so old WordPress/podcast hosting can be retired completely, and optionally configure custom cloned voice synthesis (ElevenLabs / OpenAI TTS) for the Friday 5-minute rollup.

### Issue 5.1: Build Automated Legacy Podcast Bulk Importer (`scripts/import-legacy-episodes.ts`)
- **Status:** `[ ] Pending`
- **Automated Steps for Antigravity:**
  1. Create a CLI script `scripts/import-legacy-episodes.ts` (and npm script `"import:legacy"`) that accepts either a local directory of `.mp3` files + metadata JSON/CSV or an existing podcast RSS XML file.
  2. For each legacy episode, the script uploads the `.mp3` binary to Cloudflare R2 (`cabcall-audio`) via Wrangler R2 and inserts/upserts the episode metadata into remote D1 (`episodes` table).
- **Verification:** Running the script in `--dry-run` mode validates parsing, R2 key naming, and D1 SQL generation.
- **Human Action Gate:** None.

### Issue 5.2: Execute Legacy Archive Upload to Production R2 & D1
- **Status:** `[ ] Pending`
- **[HUMAN ACTION GATE] — Provide Legacy Episode Files:**
  > **Why Antigravity paused:** Antigravity needs to know where your historical *Change Advisory Board* `.mp3` files (and episode titles/dates, or old RSS feed XML) are stored on your computer.
  >
  > **Steps for you to perform:**
  > 1. Place your historical `.mp3` files (and any export/RSS XML file if you have one) into a folder on your computer, such as `d:\repos\thecabcall.com\legacy-episodes\`.
  > 2. Reply here with the folder path (e.g., **`"The files are in d:\repos\thecabcall.com\legacy-episodes"`**), or reply **`"Skip legacy upload for now"`** if you want to add them later.
- **Automated Steps for Antigravity (once path is provided):**
  1. Run the bulk import script to upload all `.mp3` files to production R2 `cabcall-audio` and insert their rows into production D1 `episodes`.
  2. Verify they appear under the **Legacy Deep-Dive Archive** tab on `/archive` and inside `/feed.xml`.

### Issue 5.3: Optional Custom Voice Clone TTS Integration (ElevenLabs / OpenAI TTS)
- **Status:** `[ ] Pending`
- **Automated Steps for Antigravity:**
  1. Inspect `src/pipeline/rollup.ts` (which currently synthesizes MP3 audio via Gemini TTS with WAV/MP3 fallback).
  2. Add optional support for `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` (so if you clone your own voice on ElevenLabs and add those secrets, Friday rollups automatically speak in your cloned voice, while keeping Gemini TTS as the zero-cost default).
- **Verification:** `npm run build` and Worker deployment succeed with multi-provider TTS support.
- **Human Action Gate:** Optional — only if the user wants to supply an `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`.
