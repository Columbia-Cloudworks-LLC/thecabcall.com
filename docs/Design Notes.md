**Change Advisory Board** (*The CAB Call*) is designed as a cross between a high-precision Site Reliability Engineering observability dashboard and an 18th-century Masonic tracing board. Rather than looking like a standard news blog, the site treats current events as active system incidents analyzed through an ancient, structured moral framework.

---

## 1. Site Architecture: Pages & Taxonomy

To give an LLM or developer a complete blueprint to build from, the site is structured into six core page templates and a dual-axis categorization taxonomy.

### Core Pages

1. **The Trestleboard (Home / Live Telemetry Dashboard)**
* **Purpose:** The operational command center and landing page.
* **Contents:**
* **System Posture Header:** A macro-telemetry bar showing the past 7 days of ingested news—displaying the dominant Masonic Working Tool percentage (e.g., *The Square: 44%*) and top recurring SRE Failure Mode (e.g., *Configuration Drift*).


* **Pinned CAB Rollup:** An embedded audio module at the top featuring the latest 5-minute Friday *CAB Weekly Brief* episode.


* **Active Incident Feed:** A filterable grid of the latest high-signal news briefs (Event Cards) that passed the classification threshold.






2. **Incident Brief (Single Article / Post-Incident Review View)**
* **Purpose:** The deep-dive page for an individual analyzed news event.
* **Contents:**
* **Telemetry Sidebar:** Displays the original RSS source link, ingestion timestamp, overall signal confidence score, the full probability distribution bar chart across all six Working Tools, and the assigned SRE Failure Mode tag.


* **The Socratic Brief:** A concise, objective summary of the event stripped of emotional punditry.


* **Diagnostic Application:** A breakdown of *why* the primary Working Tool and SRE lens triggered for this specific event.


* **The Inquiry (Socratic Questions):** 3 to 4 structured, open-ended questions framed inside an ornate border, challenging the reader to judge the event fairly and consistently.






3. **The Knowledge Graph (Taxonomy & Archive Explorer)**
* **Purpose:** An interactive filtering matrix allowing users to cross-reference historical news events by moral tool and technical failure.


* **Contents:** Two interactive selector ribbons (Working Tools on the X-axis, SRE Failure Modes on the Y-axis), a search bar, date-range selectors, and a high-density table/card toggle of all historical records.




4. **The CAB Call Archive (Podcast Hub)**
* **Purpose:** Houses both the new 5-minute Friday telemetry rollups and the legacy *Change Advisory Board* podcast episodes.


* **Contents:**
* **Series Toggle:** Filter between *Weekly Telemetry Rollups (5-Min)* and *Legacy Deep-Dive Archive*.


* **Episode Directory:** Each entry includes an inline audio player, episode metadata, a collapsible full transcript, and direct links to the week's underlying Incident Briefs referenced in that episode.


* **Direct RSS Subscription Block:** One-click copy for the custom Cloudflare R2/Worker RSS feed (`[thecabcall.com/feed.xml](https://thecabcall.com/feed.xml)`), plus Apple Podcasts and Spotify links.






5. **The Rubric & Working Tools (Methodology & Reference Codex)**
* **Purpose:** Onboarding for newcomers and transparency into how the automated classification pipeline evaluates the world.


* **Contents:** An interactive split-screen reference guide pairing each Masonic Working Tool with its SRE equivalent, complete with authentic historical engravings, moral definitions, systems engineering definitions, and the exact diagnostic prompt questions used by the classifier.




6. **System Status & Pipeline Architecture (Colophon / Transparency)**
* **Purpose:** An SRE-style status page showing the actual health and economics of the website's own automated pipeline.


* **Contents:** Live metrics pulled from Cloudflare D1 (total RSS items evaluated vs. rejected as noise, average classifier latency, cron job uptime, and the "Epistemic Humility / Zero AI Slop" governance charter).





### Dual-Axis Categorization Taxonomy

Every analyzed article in the database is indexed across three dimensions so users can slice the archive any way they choose:

* **Axis 1: The Working Tools (Moral & Philosophical Lens)**
1. *The 24-Inch Gauge:* Time allocation, attention stewardship, and prioritization.


2. *The Common Gavel:* Stripping away vices, political theater, and emotional noise.


3. *The Plumb:* Upright conduct, holding the line under pressure, and integrity.


4. *The Square:* Squaring actual execution with stated policy, contracts, and values.


5. *The Level:* Shared accountability across hierarchies; leadership bearing the same cost as end users.


6. *The Trowel:* Connective tissue, institutional trust, and uniting disparate silos.




* **Axis 2: SRE Failure Modes (Systems Architecture Lens)**
1. *Configuration Drift:* Slow, unmonitored divergence between how a system is supposed to work and how it actually runs in production.


2. *Cascading Failure:* A localized failure knocking out downstream dependencies due to tight coupling or lack of circuit breakers.


3. *Alert Fatigue & Signal Loss:* Drowning in low-priority noise until a critical structural warning is ignored.


4. *Single Point of Failure (SPOF) / Untested Failover:* Relying on one fragile bottleneck or assuming a backup plan works without ever running a game-day drill.


5. *Blame Culture vs. Root-Cause Isolation:* Punishing the operator who pressed the button instead of fixing the flawed system that allowed the error.


6. *Technical & Institutional Debt:* Deferring necessary maintenance for short-term velocity until the interest payments cause an outage.




* **Axis 3: Domain Sectors (Subject Matter)**
* *Public Policy & Governance*, *Infrastructure & Supply Chain*, *Technology & Cyber*, *Economics & Markets*, *Institutional Leadership*.



---

## 2. Visual Identity: Modern SRE Meets Ornate Masonry

The visual tension of the site comes from pairing **industrial dark-mode terminal precision** with **18th-century copperplate craftsmanship**. Neither aesthetic overpowers the other; the ornate Masonic elements act as the structural framing, while the SRE elements handle the data density inside those frames.

### Color Palette

* **Backgrounds:** Deep Obsidian (`#0B0E14`) for the primary canvas, paired with Lodgeroom Navy (`#111726`) for elevated cards and panels.
* **Accents & Framing:** Burnished Brass / Antique Gold (`#C5A059`) and Muted Bronze (`#8A6D3B`) for borders, dividers, and Masonic iconography.
* **Typography & Foreground:** Crisp Parchment White (`#F3EFE6`) for primary reading text (warmer and easier on the eyes than pure `#FFFFFF` against dark mode) and Slate Grey (`#94A3B8`) for secondary metadata.
* **Telemetry Status Colors:** Muted, high-contrast status indicators—Emerald (`#10B981`) for nominal/high-alignment, Amber (`#F59E0B`) for drift/warning, and Crimson (`#EF4444`) for critical systemic failure.

### Typography

* **Display & Headings (The Masonic Voice):** **Cinzel**, **Cormorant Garamond**, or **IM Fell English**. High-contrast, chiseled serifs that evoke carved stone and vintage ritual monitors. Used for page titles, Working Tool labels, and the Socratic Questions.
* **Body Copy (The Editorial Voice):** **Newsreader**, **Source Serif 4**, or **Instrument Serif** (paired with **Inter** for UI controls). Clean, highly legible editorial typography for reading the incident summaries.
* **Telemetry & Data (The SRE Voice):** **JetBrains Mono** or **IBM Plex Mono**. Used strictly for timestamps, confidence percentages (`0.84`), incident IDs, RSS source tags, and audio timecodes.

### Structural Ornamentation (CSS & SVG Only)

* **Double-Line Hairline Borders:** Cards use a 1px outer border in muted slate and an inset 1px border with subtle geometric corner brackets in Burnished Brass—reminiscent of both a Masonic tracing board border and a technical blueprint.
* **The Checkered Pavement:** Used extremely sparingly as a subtle, low-opacity (`3%` to `5%`) geometric SVG background pattern in the hero header and footer.
* **Section Dividers:** Horizontal rules (`<hr>`) rendered as fine brass lines with a small, centered geometric diamond or compass-point SVG vector in the middle.

---

## 3. Non-AI Asset Sourcing Strategy

To guarantee zero AI-generated imagery while making the site look rich and authentic, all visual assets come from two verifiable sources: **historical public domain archives** and **programmatic SVG geometry**.

1. **Historical Copperplate Engravings (Public Domain):**
* Source authentic 18th- and 19th-century engravings of the Square and Compasses, the Working Tools, architectural columns (Doric, Ionic, Corinthian), and celestial/terrestrial globes from **Wikimedia Commons**, the **Library of Congress Digital Collections**, the **Wellcome Collection**, and the **Internet Archive** (specifically digitized pages from early public-domain monitorial texts like Jeremy Cross's *The True Masonic Chart* or Thomas Smith Webb's *Freemason's Monitor*).
* **Visual Treatment:** Strip the white paper background from these high-resolution scans using alpha-channel thresholding, and tint the black ink lines to **Burnished Brass (`#C5A059`)** or **Parchment (`#F3EFE6`)** so they sit directly on the dark obsidian background like gold-leaf inlays.


2. **Mathematical & Architectural SVGs:**
* Use clean, hand-coded SVG vectors for telemetry gauges, radar charts, sparklines, and geometric dividers.
* Use open-source technical icon libraries (**Lucide** or **Phosphor Icons** with a `1.25px` stroke weight) for SRE and UI controls.



---

## 4. User Experience (UX) & Interaction Design

The UX is engineered to slow down reactive outrage and guide the user into a calm, analytical mindset.

### 1. The "Triage-First" Scanning Flow

When a user lands on **The Trestleboard**, they are not greeted by clickbait headlines or sensationalist stock photos (there are no article thumbnails anywhere on the site). Instead, each news story is presented as a structured **Incident Card**:

* **Top Bar (Monospace):** Incident ID (`#CAB-2026-1042`), Source (`REUTERS`), and Signal Confidence (`88%`).


* **Center:** The neutral headline and a two-sentence executive summary.


* **Bottom Bar (The Diagnostic Badges):** Two distinct pill badges—one in Brass showing the primary **Working Tool** (e.g., *The Plumb — 0.78*) and one in Slate/Amber showing the **SRE Failure Mode** (e.g., *Adherence to SLOs / Compliance*).


* **Hover State:** Hovering over a card illuminates its brass corner brackets and reveals a mini horizontal bar showing the secondary Working Tool probabilities before the user even clicks.



### 2. Instant Cross-Filtering (The Knowledge Graph UX)

Every badge on the site is an active filter trigger. If a user is reading an Incident Brief tagged with **The Common Gavel** and **Blame Culture**, clicking either badge smoothly transitions them to the Knowledge Graph view pre-filtered to show every historical event sharing that exact diagnostic signature. Users can immediately see macro patterns across months of news.

### 3. The "Zero-Toil" Persistent Audio Player

Because the 5-minute Friday *CAB Weekly Brief* is designed to be consumed alongside the week's telemetry, clicking "Play" on any podcast episode docks a sleek, low-profile audio bar to the bottom of the viewport.

* As the user clicks around the site—opening Incident Briefs or filtering the Knowledge Graph—the audio continues uninterrupted.
* When listening to a Weekly Rollup, the player displays clickable "Incident Markers" along the timeline; clicking a marker opens the exact Incident Brief being discussed at that timestamp.



### 4. Interactive Diagnostic Reveal on Article Pages

On an individual **Incident Brief** page, the layout prevents passive skimming:

* The left column holds the fixed **Telemetry Spec Sheet** (source link, raw classifier confidence scores, and a mini radar chart of the six Working Tools).


* The right column presents the **Facts of the Incident**, followed by **The Diagnostic Lens** (how the tool and SRE principle apply), and culminates in **The Trestleboard Inquiry**—where the 3–4 Socratic questions are presented inside a framed brass box.


* Next to each Working Tool badge is a subtle `[?]` inspection trigger; hovering or tapping it opens a slide-over drawer from *The Rubric*, reminding non-Masons or non-SREs of the exact moral and technical criteria without cluttering the article text itself.



---

Does this architecture and aesthetic direction hit the mark for what you envision on `thecabcall.com`, or would you like to adjust any of the page structures or visual elements before we turn this into an actionable build spec?