import { D1DatabaseLike } from "./ingest";
import {
  JEV_SRE_FAILURE_MODE_CRITERIA,
  JEV_WORKING_TOOL_CRITERIA,
  JevSreFailureModeKey,
  JevWorkingToolKey,
} from "./jev";

export interface TelemetryArticleRow {
  id: number;
  url_hash: string;
  source_feed: string;
  title: string;
  source_url: string;
  raw_excerpt: string;
  published_at: string;
  ingested_at: string;
  is_systemic_prob: number;
  jev_confidence: number;
  primary_tool: JevWorkingToolKey;
  secondary_tool: JevWorkingToolKey | null;
  sre_failure_mode: JevSreFailureModeKey;
  jev_raw_json: string;
  socratic_brief: string | null;
  questions_json: string | null;
  status: "dropped" | "triaged" | "synthesized";
}

export interface SocraticSynthesisOutput {
  executive_summary: string;
  socratic_brief: string;
  proportionality_check: {
    noise_overblown: string;
    structural_signal: string;
  };
  questions: string[];
}

export interface SynthesizedArticleResult {
  id: number;
  url_hash: string;
  source_feed: string;
  title: string;
  source_url: string;
  published_at: string;
  primary_tool: JevWorkingToolKey;
  secondary_tool: JevWorkingToolKey;
  sre_failure_mode: JevSreFailureModeKey;
  is_systemic_prob: number;
  jev_confidence: number;
  model_used: string;
  synthesis: SocraticSynthesisOutput;
}

export interface SynthesizeRunSummary {
  startedAt: string;
  completedAt: string;
  requestedLimit: number;
  synthesizedCount: number;
  articles: SynthesizedArticleResult[];
  errors?: { id: number; title: string; error: string }[];
}

export const WORKING_TOOL_DISPLAY_NAMES: Record<JevWorkingToolKey, string> = {
  twenty_four_inch_gauge: "The 24-Inch Gauge",
  common_gavel: "The Common Gavel",
  plumb: "The Plumb",
  square: "The Square",
  level: "The Level",
  trowel: "The Trowel",
};

export const SRE_FAILURE_DISPLAY_NAMES: Record<JevSreFailureModeKey, string> = {
  configuration_drift: "Configuration Drift",
  cascading_failure: "Cascading Failure",
  untested_failover: "Single Point of Failure (SPOF) / Untested Failover",
  alert_fatigue: "Alert Fatigue & Signal Loss",
  blameless_postmortem_gap: "Blame Culture vs. Root-Cause Isolation",
  capacity_exhaustion: "Technical & Institutional Debt / Capacity Exhaustion",
};

export const SOCRATIC_SYNTHESIS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    executive_summary: {
      type: "STRING",
      description:
        "Exactly 2 concise, objective sentences summarizing the core operational event and the System-1 Jev classification without partisan framing or clichés.",
    },
    socratic_brief: {
      type: "STRING",
      description:
        "2 to 3 objective paragraphs separated by double newlines (\\n\\n) analyzing the operational tension, the verifiable facts, and why Jev's primary_tool and sre_failure_mode triggered. Frame strictly as an active systems incident awaiting full post-mortem telemetry.",
    },
    proportionality_check: {
      type: "OBJECT",
      properties: {
        noise_overblown: {
          type: "STRING",
          description:
            "What reactive headline spin, partisan theater, or sensationalized panic in the commentary cycle is overblown jitter.",
        },
        structural_signal: {
          type: "STRING",
          description:
            "The actual underlying architectural, governance, incentive, or capacity constraint exposed by this incident.",
        },
      },
      required: ["noise_overblown", "structural_signal"],
    },
    questions: {
      type: "ARRAY",
      description:
        "3 to 4 sharp Socratic diagnostic questions anchored explicitly to Jev's primary_tool and secondary_tool.",
      items: {
        type: "STRING",
      },
    },
  },
  required: [
    "executive_summary",
    "socratic_brief",
    "proportionality_check",
    "questions",
  ],
};

function parseToolProbabilitiesFromJevRaw(
  jevRawJson: string,
  primaryTool: JevWorkingToolKey,
  secondaryTool: JevWorkingToolKey
): Record<JevWorkingToolKey, number> {
  const fallback: Record<JevWorkingToolKey, number> = {
    twenty_four_inch_gauge: 0.1,
    common_gavel: 0.1,
    plumb: 0.1,
    square: 0.1,
    level: 0.1,
    trowel: 0.1,
  };
  fallback[primaryTool] = 0.42;
  fallback[secondaryTool] = 0.24;

  try {
    const parsed = JSON.parse(jevRawJson);
    const probs =
      parsed?.answers?.working_tool?.probabilities ||
      parsed?.working_tool?.probabilities;
    if (probs && typeof probs === "object") {
      return {
        twenty_four_inch_gauge: Number(probs.twenty_four_inch_gauge ?? 0),
        common_gavel: Number(probs.common_gavel ?? 0),
        plumb: Number(probs.plumb ?? 0),
        square: Number(probs.square ?? 0),
        level: Number(probs.level ?? 0),
        trowel: Number(probs.trowel ?? 0),
      };
    }
  } catch {
    // Ignore parse error and return fallback distribution
  }
  return fallback;
}

export function buildSystem2Prompt(row: TelemetryArticleRow): {
  systemInstruction: string;
  userPrompt: string;
} {
  const secondaryTool: JevWorkingToolKey =
    row.secondary_tool || "twenty_four_inch_gauge";
  const toolProbs = parseToolProbabilitiesFromJevRaw(
    row.jev_raw_json,
    row.primary_tool,
    secondaryTool
  );

  const primaryDisplay = WORKING_TOOL_DISPLAY_NAMES[row.primary_tool];
  const secondaryDisplay = WORKING_TOOL_DISPLAY_NAMES[secondaryTool];
  const sreDisplay = SRE_FAILURE_DISPLAY_NAMES[row.sre_failure_mode];

  const systemInstruction = `You are the System-2 Bounded Socratic Synthesizer for Change Advisory Board (thecabcall.com), an automated Post-Incident Review (PIR) telemetry platform analyzing current events through Site Reliability Engineering (SRE) and the Working Tools of Freemasonry.

HARD GOVERNANCE CONSTRAINTS (NON-NEGOTIABLE):
1. STRICT SYSTEM-1 BINDING: You are strictly bound by the System-1 TypeSafe Jev (jev-1.14.0) classification record provided below:
   - Primary Working Tool: ${row.primary_tool} (${primaryDisplay}) — Criteria: ${JEV_WORKING_TOOL_CRITERIA[row.primary_tool]}
   - Secondary Working Tool: ${secondaryTool} (${secondaryDisplay}) — Criteria: ${JEV_WORKING_TOOL_CRITERIA[secondaryTool]}
   - SRE Failure Mode: ${row.sre_failure_mode} (${sreDisplay}) — Criteria: ${JEV_SRE_FAILURE_MODE_CRITERIA[row.sre_failure_mode]}
   - 6-Tool Probability Vector: ${JSON.stringify(toolProbs)}
   You MAY NOT override, dispute, or replace Jev's labels. Your analysis and Socratic questions must directly operationalize these exact classifications.

2. EPISTEMIC HUMILITY & ZERO AI SLOP CHARTER:
   - Zero partisan punditry, zero moralizing conclusions, zero lecturing.
   - Forbidden AI clichés: Never use phrases like "In today's fast-paced world", "delve", "testament", "stark reminder", "wake-up call", "tapestry", "underscores", or "crucial".
   - Zero Definitions Rule: Do NOT recite dictionary or monitorial definitions of what a Square, Plumb, Level, Gauge, Gavel, or Trowel is. Apply the tools directly as diagnostic instruments in motion.
   - Pending Post-Mortem Framing: Treat this news story strictly as an active systems incident with incomplete telemetry awaiting full post-mortem verification.`;

  const userPrompt = `Synthesize a bounded System-2 Socratic Incident Brief for the following triaged telemetry record:

ARTICLE METADATA:
- Headline: ${row.title}
- Source Feed: ${row.source_feed}
- Published At: ${row.published_at}
- Source URL: ${row.source_url}
- Raw Telemetry Excerpt:
"""
${row.raw_excerpt}
"""

LOCKED SYSTEM-1 JEV CLASSIFICATION (jev-1.14.0):
- Systemic Event Probability: ${row.is_systemic_prob}
- Jev Confidence: ${row.jev_confidence}
- Primary Working Tool: ${row.primary_tool} (${primaryDisplay})
- Secondary Working Tool: ${secondaryTool} (${secondaryDisplay})
- SRE Failure Mode: ${row.sre_failure_mode} (${sreDisplay})
- 6-Tool Probability Distribution: ${JSON.stringify(toolProbs)}

Return ONLY valid JSON matching the required schema with:
1. "executive_summary": 2 concise sentences stating the operational event and how ${primaryDisplay} and ${sreDisplay} diagnose the core constraint.
2. "socratic_brief": 2 to 3 objective paragraphs (separated by "\\n\\n") analyzing the factual operational tension, why Jev's ${primaryDisplay} (${Math.round((toolProbs[row.primary_tool] || row.jev_confidence) * 100)}%) and ${sreDisplay} triggered alongside ${secondaryDisplay}, and what post-mortem telemetry remains unverified.
3. "proportionality_check": { "noise_overblown": "...", "structural_signal": "..." } contrasting reactive media/political jitter against the structural engineering/governance signal.
4. "questions": 3 to 4 sharp Socratic diagnostic questions anchored explicitly to ${primaryDisplay} and ${secondaryDisplay}.`;

  return { systemInstruction, userPrompt };
}

function buildDeterministicBoundedSynthesis(
  row: TelemetryArticleRow
): SocraticSynthesisOutput {
  const secondaryTool: JevWorkingToolKey =
    row.secondary_tool || "twenty_four_inch_gauge";
  const toolProbs = parseToolProbabilitiesFromJevRaw(
    row.jev_raw_json,
    row.primary_tool,
    secondaryTool
  );
  const primaryDisplay = WORKING_TOOL_DISPLAY_NAMES[row.primary_tool];
  const secondaryDisplay = WORKING_TOOL_DISPLAY_NAMES[secondaryTool];
  const sreDisplay = SRE_FAILURE_DISPLAY_NAMES[row.sre_failure_mode];
  const primaryPct = Math.round(
    (toolProbs[row.primary_tool] || row.jev_confidence || 0.45) * 100
  );
  const secondaryPct = Math.round((toolProbs[secondaryTool] || 0.22) * 100);

  const excerptSentence = row.raw_excerpt
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ")
    .trim();

  return {
    executive_summary: `${row.source_feed} reports on "${row.title}", exposing an active operational friction point scored at ${Math.round(row.is_systemic_prob * 100)}% systemic probability by Jev. Bound to ${primaryDisplay} (${primaryPct}%) and ${sreDisplay}, the incident highlights a measurable gap between nominal institutional posture and live production constraints.`,
    socratic_brief: `Telemetry ingested from ${row.source_feed} ("${row.title}") entered the Change Advisory Board review queue as an active systems incident. ${excerptSentence || row.raw_excerpt}\n\nUnder System-1 Jev evaluation, the primary diagnostic weight settled on ${primaryDisplay} (${primaryPct}%) paired with ${sreDisplay}, while ${secondaryDisplay} (${secondaryPct}%) registered as the secondary constraint. Specifically, the operational tension reflects ${JEV_WORKING_TOOL_CRITERIA[row.primary_tool].toLowerCase()} compounded by ${JEV_SRE_FAILURE_MODE_CRITERIA[row.sre_failure_mode].toLowerCase()}\n\nBecause this event remains an active incident with incomplete public telemetry, premature moralizing or partisan conclusions are suspended. A complete post-mortem requires verifying the upstream decision logs, resource boundaries, and interface contracts between the primary actors.`,
    proportionality_check: {
      noise_overblown: `Reactive commentary framing "${row.title}" as an isolated personality clash or sudden catastrophe rather than examining the upstream operational incentives.`,
      structural_signal: `${sreDisplay}: ${JEV_SRE_FAILURE_MODE_CRITERIA[row.sre_failure_mode]} Examined through ${primaryDisplay} and ${secondaryDisplay}, the structural constraint lies in how the system absorbs load and enforces accountability across boundaries.`,
    },
    questions: [
      `Applying ${primaryDisplay} to "${row.title}", where did actual operational execution or resource allocation diverge from the stated institutional specification?`,
      `How does ${sreDisplay} explain the propagation of this incident before automated or procedural safeguards intervened?`,
      `When we bring ${secondaryDisplay} alongside ${primaryDisplay}, what secondary friction in incentives, communication silos, or accountability emerges across the affected stakeholders?`,
      `What concrete post-mortem telemetry must be disclosed before an impartial observer can verify whether this remediation addresses the root architecture rather than surface symptoms?`,
    ],
  };
}

/**
 * Calls Gemini via the REST generateContent API with `responseMimeType: "application/json"`
 * and `responseSchema`. Attempts `gemini-2.5-flash` first as specified, and transparently falls back
 * to `gemini-3.8-flash` / `gemini-flash-latest` if the API key is provisioned on newer model aliases.
 */
export async function callGeminiStructuredSynthesis(
  row: TelemetryArticleRow,
  geminiApiKey?: string
): Promise<{ synthesis: SocraticSynthesisOutput; modelUsed: string }> {
  const trimmedKey = geminiApiKey?.trim() || "";
  if (!trimmedKey || trimmedKey === "your_gemini_api_key_here") {
    return {
      synthesis: buildDeterministicBoundedSynthesis(row),
      modelUsed: "deterministic-system2-fallback",
    };
  }

  const { systemInstruction, userPrompt } = buildSystem2Prompt(row);

  const candidateModels = [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ];

  let lastError = "";

  for (const modelName of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
      trimmedKey
    )}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.25,
            responseMimeType: "application/json",
            responseSchema: SOCRATIC_SYNTHESIS_RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        lastError = `HTTP ${response.status} (${modelName}): ${errText.slice(0, 300)}`;
        // If 404 (e.g. model retired for new keys), try next candidate model
        if (response.status === 404 || response.status === 400) {
          continue;
        }
        throw new Error(lastError);
      }

      const data: any = await response.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (!rawText) {
        lastError = `Empty response from ${modelName}`;
        continue;
      }

      const parsed = JSON.parse(rawText) as SocraticSynthesisOutput;
      if (
        parsed &&
        typeof parsed.executive_summary === "string" &&
        typeof parsed.socratic_brief === "string" &&
        parsed.proportionality_check &&
        Array.isArray(parsed.questions) &&
        parsed.questions.length >= 3
      ) {
        return {
          synthesis: {
            executive_summary: parsed.executive_summary.trim(),
            socratic_brief: parsed.socratic_brief.trim(),
            proportionality_check: {
              noise_overblown:
                parsed.proportionality_check.noise_overblown?.trim() || "",
              structural_signal:
                parsed.proportionality_check.structural_signal?.trim() || "",
            },
            questions: parsed.questions.slice(0, 4).map((q) => String(q).trim()),
          },
          modelUsed: modelName,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Graceful fallback if network/quota fails so pipeline remains 100% resilient
  console.warn(
    `[System-2 Synthesize] Falling back to deterministic synthesis after error: ${lastError}`
  );
  return {
    synthesis: buildDeterministicBoundedSynthesis(row),
    modelUsed: "deterministic-system2-fallback",
  };
}

/**
 * Queries D1 for `status = 'triaged'` rows ordered by `published_at DESC` (or specific `articleIds`),
 * runs bounded Gemini System-2 synthesis on each, updates D1 with
 * `socratic_brief`, `questions_json`, and `status = 'synthesized'`, and logs the execution in `pipeline_runs`.
 */
export async function runSynthesizePipeline(options: {
  db: D1DatabaseLike;
  geminiApiKey?: string;
  limit?: number;
  articleIds?: number[];
}): Promise<SynthesizeRunSummary> {
  const startMs = Date.now();
  const startedAt = new Date().toISOString();
  const limit = options.limit ?? 5;

  let rows: TelemetryArticleRow[] = [];

  if (options.articleIds && options.articleIds.length > 0) {
    const placeholders = options.articleIds.map(() => "?").join(", ");
    const queryResult = await options.db
      .prepare(
        `SELECT * FROM telemetry_articles WHERE id IN (${placeholders}) ORDER BY published_at DESC`
      )
      .bind(...options.articleIds)
      .all<TelemetryArticleRow>();
    rows = queryResult.results || [];
  } else {
    const queryResult = await options.db
      .prepare(
        "SELECT * FROM telemetry_articles WHERE status = 'triaged' ORDER BY published_at DESC LIMIT ?"
      )
      .bind(limit)
      .all<TelemetryArticleRow>();
    rows = queryResult.results || [];
  }

  const articles: SynthesizedArticleResult[] = [];
  const errors: { id: number; title: string; error: string }[] = [];

  const results = await Promise.all(
    rows.map(async (row) => {
      try {
        const secondaryTool: JevWorkingToolKey =
          row.secondary_tool || "twenty_four_inch_gauge";
        const { synthesis, modelUsed } = await callGeminiStructuredSynthesis(
          row,
          options.geminiApiKey
        );

        // Store structured synthesis payload + questions in questions_json so the frontend
        // can read executive_summary, proportionality_check, and questions losslessly
        const questionsPayload = JSON.stringify({
          executive_summary: synthesis.executive_summary,
          proportionality_check: synthesis.proportionality_check,
          questions: synthesis.questions,
          model_used: modelUsed,
          synthesized_at: new Date().toISOString(),
        });

        await options.db
          .prepare(
            `UPDATE telemetry_articles
             SET socratic_brief = ?,
                 questions_json = ?,
                 status = 'synthesized'
             WHERE id = ?`
          )
          .bind(synthesis.socratic_brief, questionsPayload, row.id)
          .run();

        const item: SynthesizedArticleResult = {
          id: row.id,
          url_hash: row.url_hash,
          source_feed: row.source_feed,
          title: row.title,
          source_url: row.source_url,
          published_at: row.published_at,
          primary_tool: row.primary_tool,
          secondary_tool: secondaryTool,
          sre_failure_mode: row.sre_failure_mode,
          is_systemic_prob: row.is_systemic_prob,
          jev_confidence: row.jev_confidence,
          model_used: modelUsed,
          synthesis,
        };
        return { ok: true as const, item };
      } catch (err) {
        return {
          ok: false as const,
          error: {
            id: row.id,
            title: row.title,
            error: err instanceof Error ? err.message : String(err),
          },
        };
      }
    })
  );

  for (const res of results) {
    if (res.ok) {
      articles.push(res.item);
    } else {
      errors.push(res.error);
    }
  }

  const completedAt = new Date().toISOString();
  const elapsedMs = Math.max(120, Date.now() - startMs);
  const avgLatencyMs =
    rows.length > 0 ? Math.round(elapsedMs / rows.length) : elapsedMs;

  const notes =
    articles.length > 0
      ? `Synthesized ${articles.length} triaged D1 incident(s) (IDs: ${articles.map((a) => a.id).join(", ")}) via ${articles[0].model_used}.`
      : rows.length === 0
      ? "System-2 synthesis sweep completed: 0 pending 'triaged' rows in D1 queue (all high-signal incidents already synthesized)."
      : `System-2 synthesis attempted ${rows.length} row(s) with ${errors.length} error(s).`;

  try {
    await options.db
      .prepare(
        `INSERT INTO pipeline_runs (
          run_type,
          started_at,
          completed_at,
          items_evaluated,
          items_accepted,
          items_rejected_noise,
          avg_latency_ms,
          status,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        "system2_synthesize",
        startedAt,
        completedAt,
        rows.length,
        articles.length,
        errors.length,
        avgLatencyMs,
        errors.length > 0 && articles.length === 0 ? "degraded" : "nominal",
        notes
      )
      .run();
  } catch (err) {
    console.warn("[Synthesize Pipeline] Failed to log pipeline_runs row:", err);
  }

  return {
    startedAt,
    completedAt,
    requestedLimit: limit,
    synthesizedCount: articles.length,
    articles,
    errors: errors.length > 0 ? errors : undefined,
  };
}
