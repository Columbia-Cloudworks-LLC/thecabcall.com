---
name: Antigravity Autonomous Issue
about: End-to-end autonomous implementation, testing, live deployment, audit trail binding, and Human Action Gate runbook
title: "Issue #X: [Short Descriptive Title]"
labels: ["autonomous-issue", "admin-governance"]
assignees: []
---

## 1. Objective & Operational Scope
Describe what capability is being built, why it matters, and what live user/admin workflow it unlocks on `thecabcall.com`.

## 2. Immutable Audit Trail Binding
Specify the `audit_ledger` `action_type` and `target_type` events that this feature emits, ensuring full `before_state_json`, `after_state_json`, `actor_email`, and `replay_command_json` are captured in D1.

## 3. Automated Implementation Steps (Antigravity)
1. **Database / D1 Schema (`migrations/`):**
   - [ ] Define migration SQL (if applicable) and apply locally + remotely (`npx wrangler d1 migrations apply cabcall-db --local` and `--remote`).
2. **Cloudflare Worker Edge API (`src/worker.ts`, `src/pipeline/`):**
   - [ ] Implement Worker routes, validation, R2/D1 operations, and cryptographic audit logging.
3. **Next.js Frontend & Bridge (`src/lib/`, `src/app/`, `src/components/`):**
   - [ ] Implement Server/Client components, API route bridges, and interactive UI controls.

## 4. Automated Testing & Live Production Verification
1. [ ] TypeScript validation: `npx tsc --noEmit` exits with `0`.
2. [ ] Next.js production build: `npm run build` exits with `0`.
3. [ ] Cloudflare D1 & Worker live deployment: `npx wrangler deploy` succeeds and edge endpoints respond `200 OK`.
4. [ ] Vercel production deployment: `npx vercel --prod --yes` succeeds and `https://thecabcall.com` reflects the live changes.
5. [ ] Audit trail verification: Trigger a test action and verify a valid SHA-256 hash-chained row is appended to `audit_ledger`.

## 5. `[HUMAN ACTION GATE]` (Only If External Action Is Required)
> **Rule for Antigravity:** Do **NOT** stop during execution unless you hit a step below that requires human credentials, interactive browser login, or external dashboard configuration. When pausing at a gate:
> 1. Explain what was just completed.
> 2. Walk the user through the exact step-by-step instructions to perform.
> 3. Ask the user to confirm when they are done (`"Done, continue"`) before proceeding.

- **Gate Condition:** [None / Describe external credential or dashboard step]
- **Walkthrough Steps for User:**
  1. [Step 1]
  2. [Step 2]
