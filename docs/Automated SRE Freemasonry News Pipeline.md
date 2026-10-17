# **Automated SRE Freemasonry News Pipeline**

[https\://gemini.google.com/app/4e4464ec401edc4a](https://gemini.google.com/app/4e4464ec401edc4a)

*User prompt: I have an idea. I own thecabcall.com and it was supposed to be a podcast that analyzes life through the lens of Site Reliability Engineering with morality rooted in Freemasonry. I stopped about a year ago because it was cost prohibitive but the landscape has changed a lot and I have learned a lot since then. One thing I enjoyed was being able to take in the news and literally apply the working tools of freemasonry to summarize the event and then basically tell you how to fairly and consistantly judge the event by asking cetain questions. It doesn't propose to know the answer, it simply looks at the event, applies the tool, and states how the tool could be applied to aspects of the story. Now, there is a tool called Jev and Microsoft released a competetor classifier model. If I could get a couple of RSS feeds and aggregate them into a site, I could use a very cheap AI model to literally apply the tools to the articles as they come in and then store all of that in a database. Then use a cheap model that can write an article based on what the database has captured form the RSS feed. That means we would be behind the feed in terms of publishing, but what you get is sourced information with what I originally had planned. I think it would also be a good move to get off of WordPress and just build that site from scratch. I think I'm past the point of needing platforms like WordPress to build sites now.*

Response: Turning thecabcall.com into an automated, structured analysis platform is a massive upgrade over the traditional podcast grind. You are essentially applying **System 1 vs. System 2 architecture** to philosophical and operational news analysis—where the pipeline acts like a structured Post-Incident Review (PIR) for current events, using Masonic working tools as your diagnostic rubric.

Instead of paying for podcast hosting, audio editing, and hours of recording time, you can run this entire pipeline for pennies a month while keeping complete ownership of the stack.

## **1\. The Pipeline Architecture: System 1 \+ System 2**

The breakthrough with **Jev** (by TypeSafe AI) and Microsoft's zero-shot NLI classifiers (like **DeBERTa-v3**) is that they separate *classification* from *generation*. You don't need an expensive frontier LLM to read every single RSS item just to figure out which working tool applies.

> * **Stage 1: Ingestion & De-duplication (Cron / Edge Function)** Pull RSS feeds (Reuters, AP, Ars Technica, Hacker News, etc.) on a schedule. Hash the URLs/GUIDs so you only process net-new articles, stripping the HTML down to clean markdown or plain text.  
> * **Stage 2: The "System 1" Triage (Jev or DeBERTa)** Pass the raw article state into **Jev** (at **\$0.042 per million input tokens** and free output) or a local/hosted Microsoft DeBERTa zero-shot classifier. In a single forward pass (70–500ms), you ask typed questions:  
  * *Signal vs. Noise (noul / boolean)*: Does this story involve systemic failure, leadership decisions, ethical friction, or public accountability? (If confidence is less than 0.70, drop it before spending generation tokens).  
  * *Primary & Secondary Working Tool (choice)*: Which tool best diagnoses the core tension of this event?  
  * *SRE Failure Mode (choice)*: Is this a cascading failure, a bad deployment, a human-factors/blameless culture issue, or technical debt?  
> * **Stage 3: Structured Storage (Supabase / PostgreSQL)** Store the raw source metadata, the Jev probability distribution (e.g., Plumb: 0.78, Level: 0.15, Square: 0.07), and the confidence scores directly in a JSONB column.  
> * **Stage 4: The "System 2" Synthesis (Cheap Generative Model)** For articles that pass the confidence threshold, trigger a lightweight generative model (like **Gemini 2.5 Flash** or **GPT-4o-mini**). Importantly, the LLM is **not** allowed to invent the angle—it is strictly bound by the database record. It writes a tight, sourced brief summarizing the facts, explaining why the chosen Working Tool and SRE lens apply, and presenting 3 to 4 Socratic questions for the reader to weigh the event fairly.

## **2\. Mapping the Working Tools \+ SRE Rubric**

To keep the classifier sharp and avoid overlapping probabilities (which dilute zero-shot accuracy), each tool needs distinct, mutually exclusive criteria in your Jev/classifier payload:

| Working Tool | Moral / Philosophical Lens | SRE / Systems Equivalent | Diagnostic Question Pattern |
| :---- | :---- | :---- | :---- |
| **24-Inch Gauge** | Time allocation, prioritization, resource stewardship | Capacity planning, toil reduction, error budgets | Where was attention spent vs. where the real systemic risk lived? |
| **Common Gavel** | Stripping away vices, superfluities, and ego | Blameless post-mortems, root-cause isolation, cutting scope creep | What emotional noise or political theater needs to be chipped away to see the raw failure? |
| **The Plumb** | Upright conduct, integrity under pressure | Adherence to SLAs/SLOs, compliance rigor, operational honesty | Did the actors hold the line when incentives pushed them to cut corners? |
| **The Square** | Morality, fair dealing, squaring actions with stated values | Spec vs. production reality, configuration drift, auditability | How far did actual execution drift from the stated policy or social contract? |
| **The Level** | Equality, shared mortality, accountability across hierarchies | Shared on-call burden, democratization of data, flat incident command | Are the people who designed the fragile system bearing the same cost as the end users? |
| **The Trowel** | Spreading the cement of affection, uniting disparate parts | Cross-team incident response, API contracts, institutional trust | What connective tissue broke down between silos, and what binds the recovery together? |

## **3\. Ditching WordPress for a Custom Stack**

Moving off WordPress is the right call. WordPress is built for manual WYSIWYG blogging; what you are building is a **data-driven telemetry dashboard for current events**.

Since you already work rapidly in React/TypeScript, Tailwind, and Supabase (or Astro/Next.js for static/SSR SEO performance), building from scratch gives you three huge advantages:

> 1. **Native Structured UI:** Instead of a wall of blog text, each post on thecabcall.com can render an actual "Incident / Event Card" showing the source links, the Jev confidence meter for which Working Tool triggered, the SRE failure tag, the summary, and the Socratic questions in a clean, scannable layout.  
> 2. **Filterable Knowledge Graph:** Readers can click "The Plumb" or "Configuration Drift" and immediately filter the database for every historical news event that scored greater than 80% on that specific tool.  
> 3. **Zero Maintenance Bloat:** No PHP plugin vulnerabilities, no database bloat, and you can deploy the frontend on Vercel or Cloudflare Pages for \$0/month while running the RSS \+ Jev \+ LLM cron job via Supabase Edge Functions or GitHub Actions.

## **Interactive Pipeline Explorer**

Use the interactive diagram below to step through how a raw RSS article flows through the Jev classification gate into your database and frontend, and see how the token economics scale.

**Sources**

> 1. [What Is Jev? Inside the AI Classifier Model Developers Are Racing](https://www.mindstudio.ai/blog/what-is-jev-classifier-model)  
> 2. [What Is Jev? Inside TypeSafe's Decision-Only AI Model and Its](https://www.firecrawl.dev/blog/what-is-jev)  
> 3. [Jev: A System One Model, Not an LLM \- innFactory AI Consulting](https://innfactory.ai/en/blog/jev-system-one-model-classifier-not-llm/)

---

*User prompt: I would like to be able to possibly produce a weekly podcast as well, but I think it could be better than the standard AI deep dive that just repeats the exact same points from the old sources. Masons don't need to be reminded what a plumb is each and every week. But we can use the same database to produce the transcripts for a weekly podcast that is much shorter. Say 5 minutes. It's the kind of podcast you would consume once you've already gotten the news for the day. This would just be a reflection of the week and how those involved and those listening should apply the tools this week. Maybe it's an opportunity to take the sting out of the news by reminding people of the SRE principals that keep everyone at every stage honest but not in the same way the news does. (we do not yet know if this means troubling news for xyz) but more like "Their upcoming challenges will require use of the following tools of freemasonry in the following ways as we also remember the logic that makes good systems architecture so we know when there are gaps and don't overblow insignificant details" if that makes sense.*

Response: That approach solves the exact failure mode of almost every automated news podcast on the internet: **repeating the news and lecturing the listener.**

If your listener already knows what happened, and already knows what the Plumb and the Level mean, spending 30 minutes summarizing the news and reading out the monitorial lecture is pure toil. Instead, treating the 5-minute weekly show as a **Friday Change Advisory Board (CAB) Rollup** or **Weekly Systems Retro** flips the script: you are measuring the *aggregate signal* of the week and setting the operational posture for the next seven days.

## **1\. The Weekly Rollup Query (Database → Transcript)**

Because your daily pipeline is already tagging every incoming article with Jev probability scores and SRE failure modes in Supabase, you don't feed raw news articles into the weekly podcast prompt. You feed it **the week's telemetry**.

Every Friday, a scheduled job runs an aggregation query across the past 7 days of stored articles:

> * **Dominant Working Tool Distribution:** Which tool triggered most frequently across high-confidence events this week? (e.g., *48% of major stories this week scored highest on The Square—signaling widespread drift between stated policy and actual execution*).  
> * **Top 3 High-Signal Events:** Pull only the structured briefs and diagnostic questions for the top 3 highest-confidence stories from different domains.  
> * **Primary SRE Anti-Pattern:** What was the recurring systems failure of the week? (e.g., *Cascading failures from single points of failure, or alert fatigue masking a slow degradation*).

## **2\. The 5-Minute "CAB Weekly Brief" Format (\~750 Words)**

At a natural speaking pace of 150 words per minute, a 5-minute podcast is roughly **750 words** (about 4,500 characters). You can enforce a strict 3-part runbook in the LLM prompt so it never preaches or explains basic definitions:

> 1. **The Weekly Telemetry (0:00 – 1:15 | \~180 words)** Acknowledge the macro pattern from the database without rehashing the headlines.  
   * *Example framing:* "If you watched the feeds this week, you saw three separate institutions hit the same wall. Whether it was the supply chain bottleneck or the regulatory walkback, the common thread wasn't malice—it was **configuration drift**. In our telemetry this week, **The Square** led every other tool by two-to-one."  
> 2. **Separating Signal from Panic (1:15 – 3:30 | \~350 words)** Apply the SRE logic directly to take the sting out of the outrage cycle. Point out where the media is treating a localized component failure like a total system outage, and identify the actual architectural gap that needs watching.  
   * *Example framing:* "The commentary wants you to believe the entire structure is failing. Good systems architecture tells us otherwise: a noisy alert on an edge node isn't a core outage. However, the real gap those involved are going to face next week is an **untested failover**..."  
> 3. **The Forward Posture / Tools on the Trestleboard (3:30 – 5:00 | \~220 words)** State clearly how the principals in the story—and we as observers—need to apply the tools in the coming week. Assume the listener already knows the tools; focus strictly on *where to place them*.  
   * *Example framing:* "For the leadership walking into next week's hearings, the challenge requires **The Common Gavel** first—stripping away the defensive PR noise before attempting a root-cause fix—followed immediately by **The Plumb** when the pressure to quietly patch the spec kicks in. For us watching from the outside, keep **The 24-Inch Gauge** on your own attention budget so you aren't burning hours on an incident that hasn't even published its post-mortem yet."

## **3\. Prompt Rules to Prevent "AI Slop"**

To make sure the script sounds like *you* and not a generic AI summary, lock these constraints into the weekly synthesis system prompt:

> * **Zero Definitions Rule:** Explicitly forbid defining the Working Tools or basic SRE acronyms. If the script says "The Plumb teaches us to walk uprightly," the prompt fails. Use the tool names as operational verbs and nouns that the audience already speaks natively.  
> * **Epistemic Humility (The "Pending Post-Mortem" Rule):** Never declare who the villain is or predict a catastrophic outcome. Frame ongoing stories as *active incidents with incomplete telemetry*—highlighting what data is missing and what questions will prove whether the system is recovering or degrading.  
> * **Proportionality Check:** Require the model to explicitly identify one detail the news cycle is overblowing (noise/jitter) versus the underlying structural constraint (signal/capacity).

## **4\. Production & Cost Economics (Pennies per Episode)**

A 5-minute weekly show eliminates the exact cost and time barriers that killed the original podcast:

| Component | Implementation Option | Cost per 5-Min Episode (\~4,500 chars) | Monthly Cost (4 Episodes) |
| :---- | :---- | :---- | :---- |
| **Transcript Generation** | Gemini 2.5 Flash / Claude Haiku reading your weekly Supabase rollup | Less than **\$0.01** | **\~\$0.02** |
| **Voice Synthesis (Option A: Record It Yourself)** | Read the generated 750-word script into your mic in one 5-minute take on Friday | **\$0.00** | **\$0.00** |
| **Voice Synthesis (Option B: Cloned Voice API)** | **ElevenLabs** (Instant/Pro Voice Clone of your own voice via v4 Turbo or v3) or **OpenAI TTS** | **\$0.18 – \$0.36** (at $0.04–$0.08 per 1k chars) | **\$0.72 – \$1.44** (or \$6/mo Starter plan) |
| **Podcast RSS & Audio Hosting** | **Cloudflare R2** (10GB free tier, zero egress fees) \+ dynamic /podcast.xml route on thecabcall.com | **\$0.00** | **\$0.00** |

Because you are ditching WordPress and building thecabcall.com as a custom app, you don't even need to pay Libsyn, Buzzsprout, or Spotify $15–$25/month for podcast hosting. You can drop the .mp3 files into a free **Cloudflare R2** or **Supabase Storage** bucket and serve a standard RSS 2.0 XML route (\[thecabcall.com/feed/podcast.xml\](https\://thecabcall.com/feed/podcast.xml)) directly from your site to Apple Podcasts and Spotify for **\$0/month**.

---

*User prompt: The name of the actual podcast is "Change Advisory Board" and I bought the cabcall.com because those who know, know. The name is intriguing and the fact that it has a big old freemasonry symbol on it is also intriguing. If I wanted to get started on this project from scratch, where would I start? I still have all of my old podcast files so I can re-host them. I would want to stick with cloudflare for this because Deno was just bought by them and another supabase instance would be too expensive.*

Response: Consolidating the entire stack onto Cloudflare is the smartest architectural move you can make here. With Cloudflare acquiring the Deno team to supercharge workerd and Durable Objects—while winding down standalone Deno runtime development in October 2027—writing standard Web-API TypeScript directly on **Cloudflare Workers \+ D1 \+ R2** aligns you with where the edge ecosystem is actually going.

Better yet, instead of spinning up another \$25/month Supabase instance, this entire architecture fits easily inside **Cloudflare’s \$0 Free Tier** (100,000 Worker requests/day, 5 GB of D1 SQL storage, 5 million D1 row reads/day, and 10 GB of R2 audio storage with zero egress fees).

## **1\. The All-Cloudflare Architecture Mapping**

Since you already use React, TypeScript, and Tailwind for EquipQR, you don't need to learn a new frontend paradigm—you just swap the backend primitives from Supabase to Cloudflare's native bindings:

| Layer | Supabase / Old Stack | New Cloudflare Stack (thecabcall.com) | Cost |
| :---- | :---- | :---- | :---- |
| **Database** | Supabase PostgreSQL | **Cloudflare D1** (Serverless SQLite at the edge; supports json\_extract for Jev scores) | **\$0/mo** (5 GB \+ 5M reads/day free) |
| **Audio & Archive Host** | Paid Podcast Host (Libsyn/Spotify) | **Cloudflare R2** (media.thecabcall.com custom domain, zero bandwidth/egress fees) | **\$0/mo** (First 10 GB free) |
| **RSS Ingestion & Cron** | Supabase pg\_cron / Edge Functions | **Cloudflare Workers Cron Triggers** (scheduled() handler in TypeScript) | **\$0/mo** (Built into Workers) |
| **Frontend & Podcast Feed** | WordPress | **React \+ Vite (or Astro) on Cloudflare Workers/Pages** with a dynamic /feed.xml route | **\$0/mo** |

## **2\. Step-by-Step Build Order**

Start from the foundation and get your legacy episodes back online before wiring up the automated news pipeline.

**1Scaffold the Cloudflare Monorepo & Provision D1 \+ R2**

Run via PowerShell using Wrangler CLI

Initialize a single Cloudflare Worker project with static assets (React/Vite or Astro) and bind your database and object storage directly in wrangler.jsonc.

* Run npm create cloudflare@latest thecabcall  
* Create the SQLite database: npx wrangler d1 create cabcall-db  
* Create the audio bucket for your MP3s: npx wrangler r2 bucket create cabcall-audio  
* Attach a custom subdomain (audio.thecabcall.com) to the R2 bucket in the Cloudflare dashboard so Apple Podcasts and Spotify get fast, cacheable HTTP byte-range requests with zero egress fees.

**2Deploy the D1 Schema (Legacy Episodes \+ News Telemetry)**

Create two core tables in D1 (migrations/0001\_init.sql):

* episodes: Stores both your historical "Change Advisory Board" archive and future 5-minute weekly rollups (id, slug, title, summary, transcript, audio\_url, duration\_seconds, file\_size\_bytes, published\_at, episode\_number).  
* telemetry\_articles: Stores incoming RSS items and Jev's probability vectors (id, url\_hash UNIQUE, source\_feed, title, source\_url, published\_at, jev\_confidence, primary\_tool, sre\_failure\_mode, jev\_raw\_json, socratic\_brief, questions\_json).

**3Migrate Your Old Podcast Archive & Cut Over DNS**

Before writing a single line of AI code, get your old work live and off WordPress:

* Upload your historical .mp3 files into cabcall-audio on R2 (you can bulk-upload via rclone or a quick PowerShell loop calling wrangler r2 object put).  
* Insert the metadata for those legacy episodes into the D1 episodes table.  
* Build a lightweight Worker route at \[thecabcall.com/feed.xml\](https\://thecabcall.com/feed.xml) that queries the episodes table and returns a valid iTunes/Spotify RSS 2.0 XML feed pointing to your R2 MP3 URLs.  
* Point thecabcall.com away from WordPress to your Cloudflare Worker. Your legacy show is now permanently hosted for \$0.

**4Wire Up the Daily Cron Worker (RSS \-**

Jev \-\> D1)" subtitle="Uses standard Web Fetch APIs native to both Deno and Cloudflare workerd"\> Add a Cron Trigger ("crons": \["0 \*/6 \* \* \*"\]) in wrangler.jsonc that runs every 6 hours:

* Fetch your target RSS feeds and hash the article URLs against telemetry\_articles to skip duplicates.  
* Send net-new articles to the **Jev API** (stored via npx wrangler secret put JEV\_API\_KEY) to score the Working Tool probabilities and SRE failure mode.  
* If the signal confidence exceeds your threshold (e.g., 0.75), call Gemini 2.5 Flash (or Cloudflare Workers AI right on the edge) to generate the objective summary and the 3 Socratic questions, then INSERT the record into D1.

**5Add the Weekly 5-Minute CAB Rollup Job**

Add a second Cron Trigger ("crons": \["0 12 \* \* 5"\]) for Friday mornings:

* Query D1 for all telemetry\_articles from the past 7 days, grouped by primary\_tool and sre\_failure\_mode.  
* Pass that aggregated telemetry into your strict "Zero Definitions / Epistemic Humility" prompt to generate the 750-word Friday script.  
* Either record the 5-minute audio yourself from the dashboard or trigger your TTS API to write the .mp3 directly into cabcall-audio R2 and insert a new row into episodes.

## **3\. Execution Checklist**

Use this tracker to knock out Phase 1 (getting off WordPress and re-hosting the archive) and Phase 2 (the Jev telemetry pipeline):

**Sources**

> 1. [Cloudflare acquires Deno startup in Workers platform deal \- Quartz](https://qz.com/cloudflare-acquiring-deno-workers-platform-101226)  
> 2. [How much does Cloudflare Workers cost in 2026? The real bill](https://buildoto.com/en/blog/cloudflare-workers-pricing-real-costs)

---

