# Antigravity Workspace Rules — `thecabcall.com`

## 1. Autonomous Epic & Issue Execution Protocol (`"Implement Epic #N"`)

When the user says **`"Implement Epic #1"`**, **`"Implement Epic #2"`**, **`"Implement Epic #3"`**, **`"Implement Epic #4"`**, **`"Implement Epic #5"`** (or asks to implement any specific Issue like **`"Implement Issue 2.1"`**):

1. **Read the Master Plan First:**
   - Immediately view [`docs/EPICS_AND_ISSUES.md`](./docs/EPICS_AND_ISSUES.md) to load the exact issues, steps, verification checks, and `[HUMAN ACTION GATE]` definitions for the requested Epic.
2. **Execute Uninterrupted Until Completion or a Human Action Gate:**
   - Work through each Issue in the Epic sequentially (`Issue N.1` -> `Issue N.2` -> ...).
   - Run all terminal commands, file edits, builds, deployments, and verification checks **autonomously without stopping to ask permission** for normal development actions.
   - **DO NOT** stop between issues if you can complete the next issue yourself.
3. **When You Hit a `[HUMAN ACTION GATE]` (Or Something You Cannot Do Yourself):**
   - If a command fails or a step requires human intervention that the agent cannot perform non-interactively (for example: interactive browser login via `npx wrangler login` or `npx vercel login`, enabling Cloudflare R2 in the billing dashboard, updating DNS records, or providing local legacy `.mp3` files):
   - **STOP immediately** at that gate and present a clear, plain-English block formatted like this:
     ```markdown
     ### 🛑 Action Required From You (Human Action Gate — Issue X.Y)

     **What I just completed:**
     - [Brief bullet list of completed steps]

     **Why I paused:**
     - [1 sentence in plain English explaining what requires your action]

     **Exact steps to perform right now:**
     1. [Step-by-step instructions / exact command to copy and paste]
     2. ...

     **How to resume:**
     Reply **`"Done, continue"`** once you finish the steps above, and I will automatically finish the rest of Epic #N.
     ```
4. **Track Progress Automatically in Both Docs and GitHub Issues:**
   - As you complete each Issue (and when the entire Epic finishes), update the checkboxes (`[ ] Pending` -> `[x] Completed`) in [`docs/EPICS_AND_ISSUES.md`](./docs/EPICS_AND_ISSUES.md).
   - If a matching GitHub Issue exists in `Columbia-Cloudworks-LLC/thecabcall.com` (check via `gh issue list`), post a brief completion comment or close the GitHub Issue via `gh issue close <number> --comment "..."`.

---

## 2. Architecture & Codebase Guardrails

- **Stack Overview:**
  - **Frontend:** Next.js 15 App Router (`src/app/`), React 19, Tailwind CSS v4.
  - **Edge Pipeline & Worker:** Cloudflare Worker (`src/worker.ts`, `wrangler.jsonc`) with Cloudflare D1 (`cabcall-db`) and R2 (`cabcall-audio`).
  - **System-1 Classifier:** TypeSafe Jev (`jev-1.14.0` via `https://api.typesafe.ai/v1/systemone`) in `src/pipeline/jev.ts`.
  - **System-2 Synthesis & Rollup:** Google Gemini (`gemini-2.5-flash`) in `src/pipeline/synthesize.ts` and `src/pipeline/rollup.ts`.
- **Editorial & Prompt Governance:**
  - **Zero Definitions Rule:** Never define Masonic Working Tools or basic SRE acronyms in generated briefs or podcast transcripts. Use them as operational nouns and verbs.
  - **Epistemic Humility:** Treat current events as active incidents awaiting full post-mortem telemetry. Avoid partisan punditry or moralizing lectures.
- **Secrets & Environment Safety:**
  - Never commit `.dev.vars`, `.env*` (other than `.dev.vars.example`), or `.wrangler/` local SQLite state to Git.
