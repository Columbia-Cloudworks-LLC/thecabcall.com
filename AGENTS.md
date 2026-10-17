# Antigravity Workspace Rules — `thecabcall.com`

## 1. Autonomous Issue & Epic Execution Protocol (`"Implement Issue X"` / `"Implement Epic #N"`)

When the user says **`"Implement Issue 6"`**, **`"Implement Issue #6"`**, **`"Implement Issue 7"`**, etc. (or asks to implement any sub-issue like **`"Implement Issue 5.1"`** or an entire Epic like **`"Implement Epic #6"`**):

1. **Read the Master Plan First:**
   - Immediately view [`docs/EPICS_AND_ISSUES.md`](./docs/EPICS_AND_ISSUES.md) (and `.github/ISSUE_TEMPLATE/antigravity-issue.md` when creating new issues) to load the exact implementation steps, audit trail bindings, verification checks, live deployment steps, and `[HUMAN ACTION GATE]` definitions for the requested Issue or Epic.
2. **Implement, Test & Deploy Live Uninterrupted Until Completion or a Human Action Gate:**
   - Execute the complete lifecycle for the issue **autonomously without stopping to ask permission** for normal development or deployment actions:
     1. Write/update D1 SQL migrations (`migrations/`), Cloudflare Worker routes (`src/worker.ts`, `src/pipeline/`), and Next.js frontend/API code (`src/lib/`, `src/app/`, `src/components/`).
     2. Run local validation (`npx tsc --noEmit`, `npm run build`, local D1 migrations).
     3. Apply remote D1 migrations (`npx wrangler d1 migrations apply cabcall-db --remote`) and deploy the Cloudflare Worker (`npx wrangler deploy`).
     4. Deploy the Next.js frontend to Vercel production (`npx vercel --prod --yes`) or push to `origin/main` and verify the live routes on `https://thecabcall.com` and `https://thecabcall.thecabcall.workers.dev`.
   - **DO NOT** stop mid-issue or between issues if you can complete the work yourself.
3. **When You Hit a `[HUMAN ACTION GATE]` (Or Anything Requiring User Action):**
   - If a step requires human intervention that the agent cannot perform non-interactively (for example: configuring a Google OAuth Client ID, supplying an owner email or transactional email API key, interactive CLI login via `npx wrangler login` or `npx vercel login`, DNS updates, or providing local files):
   - **STOP immediately** at that gate, walk the user through the exact steps they need to take, and ask them to let you know when they are done before proceeding:
     ```markdown
     ### 🛑 Action Required From You (Human Action Gate — Issue #X)

     **What I just completed:**
     - [Brief bullet list of completed code, tests, or migrations]

     **Why I paused:**
     - [1 sentence in plain English explaining what requires your action]

     **Exact steps for you to take right now:**
     1. [Step-by-step walkthrough with exact URLs, clicks, or copy-pasteable commands]
     2. ...

     **When you are done:**
     Please let me know once you have completed the steps above (reply **`"Done, continue"`**), and I will immediately resume, verify, and deploy the rest of Issue #X live.
     ```
4. **Track Progress Automatically in Both Docs and GitHub Issues:**
   - As you complete each Issue (and when an entire Epic finishes), update the checkboxes (`[ ] Pending` -> `[x] Completed`) in [`docs/EPICS_AND_ISSUES.md`](./docs/EPICS_AND_ISSUES.md).
   - Commit and push changes to `origin/main`.
   - Post a verification summary comment and close the corresponding GitHub Issue in `Columbia-Cloudworks-LLC/thecabcall.com` via `gh issue close <number> --comment "..."`.

---

## 2. Immutable Replayable Audit Trail Mandate

- **Every Admin & Editorial Mutation Must Be Audited:**
  - Any state change initiated by an administrator or automated editorial transform (user invite/revoke, episode generation/deletion/edit, inbound RSS feed add/update/delete, triage filter add/update/delete, incident headline de-escalation/rewrite, image attachment, brief override, or outbound feed configuration change) **MUST** write an append-only record to the D1 `audit_ledger` table.
  - Each `audit_ledger` entry must capture:
    - `event_id`, `timestamp`, `actor_email`, `auth_method` (`google_oauth` | `magic_link` | `system_bootstrap`)
    - `action_type`, `target_type`, `target_id`, `reason`
    - `before_state_json` (complete snapshot prior to change)
    - `after_state_json` (complete snapshot after change)
    - `replay_command_json` (deterministic payload allowing replay or rollback)
    - `prev_hash` and `entry_hash` (cryptographic SHA-256 hash chain linking every entry back to `GENESIS`).
  - `audit_ledger` is enforced as immutable via SQLite `BEFORE UPDATE` and `BEFORE DELETE` triggers (`RAISE(ABORT, ...)`). Replays or rollbacks never delete audit rows—they append a new cryptographically linked reversal/replay event.

---

## 3. Architecture & Codebase Guardrails

- **Stack Overview:**
  - **Frontend:** Next.js 15 App Router (`src/app/`), React 19, Tailwind CSS v4.
  - **Edge Pipeline & Worker:** Cloudflare Worker (`src/worker.ts`, `wrangler.jsonc`) with Cloudflare D1 (`cabcall-db`) and R2 (`cabcall-audio`).
  - **System-1 Classifier:** TypeSafe Jev (`jev-1.14.0` via `https://api.typesafe.ai/v1/systemone`) in `src/pipeline/jev.ts`.
  - **System-2 Synthesis & Rollup:** Google Gemini (`gemini-2.5-flash`) in `src/pipeline/synthesize.ts` and `src/pipeline/rollup.ts`.
- **Editorial & Prompt Governance:**
  - **Zero Definitions Rule:** Never define Masonic Working Tools or basic SRE acronyms in generated briefs or podcast transcripts. Use them as operational nouns and verbs.
  - **Epistemic Humility & De-Escalation:** Treat current events as active incidents awaiting full post-mortem telemetry. Avoid partisan punditry, clickbait alarmism, or moralizing lectures. When rewriting alarmist source headlines, always preserve `original_title` alongside `display_title` in the audit trail for full disclosure.
- **Secrets & Environment Safety:**
  - Never commit `.dev.vars`, `.env*` (other than `.dev.vars.example`), or `.wrangler/` local SQLite state to Git.
