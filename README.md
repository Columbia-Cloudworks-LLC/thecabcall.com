# Change Advisory Board (`thecabcall.com`)

**Change Advisory Board (*The CAB Call*)** is an automated Site Reliability Engineering & Masonic news telemetry platform. Rather than operating as a traditional blog or punditry outlet, the platform treats current events as active system incidents analyzed through a dual-axis diagnostic rubric:

1. **Axis 1 — The Six Working Tools of Freemasonry (Moral & Philosophical Lens):**
   - `24-Inch Gauge` — Time allocation, attention stewardship, and prioritization
   - `Common Gavel` — Stripping away vices, political theater, and emotional noise
   - `The Plumb` — Upright conduct, holding the line under pressure, and integrity
   - `The Square` — Squaring actual execution with stated policy, contracts, and values
   - `The Level` — Shared accountability across hierarchies; leadership bearing the same cost as end users
   - `The Trowel` — Connective tissue, institutional trust, and uniting disparate silos
2. **Axis 2 — SRE Failure Modes (Systems Architecture Lens):**
   - `Configuration Drift`
   - `Cascading Failure`
   - `Alert Fatigue & Signal Loss`
   - `Single Point of Failure (SPOF) / Untested Failover`
   - `Blame Culture vs. Root-Cause Isolation`
   - `Technical & Institutional Debt`

---

## Core Pages & Architecture

1. **The Trestleboard (`/`)**: Live Telemetry Dashboard featuring the 7-Day System Posture Header, Pinned Friday 5-Minute *CAB Weekly Brief* audio module, and Triage-First Active Incident Feed.
2. **Incident Brief (`/incidents/[slug]`)**: Post-Incident Review deep dive with fixed Telemetry Spec Sheet sidebar, Jev 6-Tool probability bar + hexagonal radar chart, Socratic Brief, Diagnostic Lens, Proportionality Check, and framed Socratic Questions.
3. **The Knowledge Graph (`/knowledge-graph`)**: Interactive 6×6 Dual-Axis Cross-Reference Matrix (Working Tools × SRE Failure Modes), search, confidence gate slider, and High-Density Table / Card toggle.
4. **The CAB Call Archive (`/archive`)**: Podcast Hub housing both the 5-minute Friday *CAB Weekly Brief* telemetry rollups (~750 words obeying the Zero Definitions & Epistemic Humility rules) and the *Legacy Deep-Dive Archive*, with a self-hosted RSS 2.0 feed at `/feed.xml`.
5. **The Rubric & Working Tools (`/rubric`)**: Interactive split-screen reference codex pairing each Masonic Working Tool with its SRE equivalent, copperplate SVG engravings, and exact classifier prompt payloads.
6. **System Status & Pipeline Architecture (`/status`)**: Live pipeline observability metrics, interactive System-1 + System-2 live ingestion sandbox, and the Epistemic Humility / Zero AI Slop Governance Charter.

---

## Automated Pipeline Endpoints

- `GET / POST /api/cron/ingest` — Stage 1–4 RSS Ingestion, URL Hash Deduplication, System-1 Jev Classification, and System-2 Bounded Socratic Synthesis.
- `GET / POST /api/cron/weekly-rollup` — Friday 5-Minute *CAB Weekly Brief* generator (~750-word 3-part script).
- `GET /feed.xml` (and `/feed/podcast.xml`) — Valid iTunes / Spotify / Apple Podcasts RSS 2.0 XML feed.
- `GET /api/telemetry` — Full JSON telemetry snapshot.
