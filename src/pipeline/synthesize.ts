import { D1DatabaseLike } from "./ingest";
import {
  JEV_SRE_FAILURE_MODE_CRITERIA,
  JEV_WORKING_TOOL_CRITERIA,
  JevSreFailureModeKey,
  JevWorkingToolKey,
} from "./jev";
import {
  buildOrSanitizeArticleDiagnostics,
  normalizeQuestionSentenceCase,
  sanitizeStringConcatenation,
  validateAndNormalizeIncidentSummary,
} from "../lib/sanitize";
import { SreFailureModeId, WorkingToolId } from "../lib/taxonomy";

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
  twenty_four_inch_gauge: "24-Inch Gauge",
  common_gavel: "Common Gavel",
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
  capacity_exhaustion: "Technical & Institutional Debt",
};

const JEV_TO_TAXONOMY_TOOL: Record<JevWorkingToolKey, WorkingToolId> = {
  twenty_four_inch_gauge: "24-Inch Gauge",
  common_gavel: "Common Gavel",
  plumb: "The Plumb",
  square: "The Square",
  level: "The Level",
  trowel: "The Trowel",
};

const JEV_TO_TAXONOMY_FAILURE: Record<JevSreFailureModeKey, SreFailureModeId> = {
  configuration_drift: "Configuration Drift",
  cascading_failure: "Cascading Failure",
  untested_failover: "Single Point of Failure (SPOF) / Untested Failover",
  alert_fatigue: "Alert Fatigue & Signal Loss",
  blameless_postmortem_gap: "Blame Culture vs. Root-Cause Isolation",
  capacity_exhaustion: "Technical & Institutional Debt",
};

export const SOCRATIC_SYNTHESIS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    executive_summary: {
      type: "STRING",
      description:
        "Exactly 2 plain-English factual sentences summarizing the news event derived directly from the source article. Never mention classifier names, decimal weights, or pipeline jargon.",
    },
    socratic_brief: {
      type: "STRING",
      description:
        "1 concise, unvarnished factual paragraph (2 to 3 plain-English sentences) summarizing the verifiable facts of the news event. Do NOT include paragraphs reciting classifier weights or boilerplate caveats.",
    },
    proportionality_check: {
      type: "OBJECT",
      properties: {
        noise_overblown: {
          type: "STRING",
          description:
            "What reactive headline spin, partisan theater, or sensationalized panic in the commentary cycle is overblown media jitter for this specific story.",
        },
        structural_signal: {
          type: "STRING",
          description:
            "How the underlying architectural, governance, incentive, or capacity constraint applies specifically to the facts of this article, without repeating generic rubric definitions verbatim.",
        },
      },
      required: ["noise_overblown", "structural_signal"],
    },
    questions: {
      type: "ARRAY",
      description:
        "Exactly 2 high-impact Socratic diagnostic questions in standard sentence case anchored to the primary and secondary Working Tools.",
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

  const systemInstruction = `You are the Post-Incident Review (PIR) editorial synthesizer for Change Advisory Board (thecabcall.com), analyzing current events through Site Reliability Engineering (SRE) and the Working Tools of Freemasonry.

HARD GOVERNANCE CONSTRAINTS (NON-NEGOTIABLE):
1. STRICT CLASSIFICATION BINDING: You are bound by the following diagnostic classification:
   - Primary Working Tool: ${primaryDisplay} — Criteria: ${JEV_WORKING_TOOL_CRITERIA[row.primary_tool]}
   - Secondary Working Tool: ${secondaryDisplay} — Criteria: ${JEV_WORKING_TOOL_CRITERIA[secondaryTool]}
   - SRE Failure Mode: ${sreDisplay} — Criteria: ${JEV_SRE_FAILURE_MODE_CRITERIA[row.sre_failure_mode]}
   - 6-Tool Probability Vector: ${JSON.stringify(toolProbs)}

2. ZERO PIPELINE JARGON & ZERO DEFINITIONS RULE:
   - NEVER mention internal classifier names ("Jev", "TypeSafe Jev", "jev-1.14.0", "System-1", "ingestion gate") or raw decimal weights ("0.61 primary weight") anywhere in your output.
   - NEVER use Mad-Libs templates like "{Source} reports on '{Headline}', exposing an active operational friction point...".
   - Do NOT recite dictionary or monitorial definitions of what a Square, Plumb, Level, Gauge, Gavel, or Trowel is.
   - Zero partisan punditry, zero moralizing conclusions, zero AI clichés ("delve", "testament", "stark reminder", "wake-up call", "underscores").`;

  const userPrompt = `Synthesize a Post-Incident Review brief for the following source dispatch:

ARTICLE METADATA:
- Headline: ${row.title}
- Source Feed: ${row.source_feed}
- Published At: ${row.published_at}
- Source URL: ${row.source_url}
- Source Excerpt:
"""
${row.raw_excerpt}
"""

CLASSIFICATION LENS:
- Primary Working Tool: ${primaryDisplay}
- Secondary Working Tool: ${secondaryDisplay}
- SRE Failure Mode: ${sreDisplay}

Return ONLY valid JSON matching the required schema with:
1. "executive_summary": 2 plain-English factual sentences summarizing what happened in the news event based on the source excerpt. No classifier names or percentages.
2. "socratic_brief": 1 concise, unvarnished factual paragraph (2 to 3 plain-English sentences) stating the facts of the incident. Do not include a second or third paragraph reciting tool weights or telemetry caveats.
3. "proportionality_check": { "noise_overblown": "...", "structural_signal": "..." } where "structural_signal" explains how the structural constraint (${sreDisplay} under ${primaryDisplay}) applies specifically to the facts of this article rather than repeating a generic rubric definition.
4. "questions": Exactly 2 high-impact Socratic diagnostic questions in standard sentence case anchored to ${primaryDisplay} and ${secondaryDisplay}.`;

  return { systemInstruction, userPrompt };
}

export function buildDeterministicBoundedSynthesis(
  row: TelemetryArticleRow
): SocraticSynthesisOutput {
  const secondaryToolKey: JevWorkingToolKey =
    row.secondary_tool || "twenty_four_inch_gauge";
  const primaryTool = JEV_TO_TAXONOMY_TOOL[row.primary_tool] || "The Square";
  const secondaryTool =
    JEV_TO_TAXONOMY_TOOL[secondaryToolKey] || "24-Inch Gauge";
  const sreFailureMode =
    JEV_TO_TAXONOMY_FAILURE[row.sre_failure_mode] || "Configuration Drift";

  const validation = validateAndNormalizeIncidentSummary({
    id: row.id,
    title: row.title,
    sourceFeed: row.source_feed,
    rawExcerpt: row.raw_excerpt,
    logWarnings: false,
  });

  const executiveSummary =
    validation.executiveSummary ||
    sanitizeStringConcatenation(validation.cleanedDescription);
  const factualBriefParagraph =
    validation.factualBriefParagraph ||
    sanitizeStringConcatenation(validation.cleanedDescription);

  const diagnostics = buildOrSanitizeArticleDiagnostics({
    title: row.title,
    sourceFeed: row.source_feed,
    factualSummary: factualBriefParagraph,
    primaryTool,
    secondaryTool,
    sreFailureMode,
  });

  return {
    executive_summary: executiveSummary,
    socratic_brief: factualBriefParagraph,
    proportionality_check: {
      noise_overblown: diagnostics.noiseOverblown,
      structural_signal: diagnostics.structuralSignal,
    },
    questions: diagnostics.questions,
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
    "gemini-2.5-flash",
    "gemini-3.8-flash",
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
        parsed.questions.length >= 2
      ) {
        const secondaryToolKey: JevWorkingToolKey =
          row.secondary_tool || "twenty_four_inch_gauge";
        const primaryTool =
          JEV_TO_TAXONOMY_TOOL[row.primary_tool] || "The Square";
        const secondaryTool =
          JEV_TO_TAXONOMY_TOOL[secondaryToolKey] || "24-Inch Gauge";
        const sreFailureMode =
          JEV_TO_TAXONOMY_FAILURE[row.sre_failure_mode] ||
          "Configuration Drift";

        const validation = validateAndNormalizeIncidentSummary({
          id: row.id,
          title: row.title,
          sourceFeed: row.source_feed,
          rawExcerpt: row.raw_excerpt,
          executiveSummary: parsed.executive_summary,
          socraticBrief: parsed.socratic_brief,
          logWarnings: false,
        });

        const cleanExec =
          validation.executiveSummary ||
          sanitizeStringConcatenation(parsed.executive_summary.trim());
        const cleanBrief =
          validation.factualBriefParagraph ||
          sanitizeStringConcatenation(
            parsed.socratic_brief.split(/\n\s*\n/)[0].trim()
          );

        const diagnostics = buildOrSanitizeArticleDiagnostics({
          title: row.title,
          sourceFeed: row.source_feed,
          factualSummary: cleanBrief,
          primaryTool,
          secondaryTool,
          sreFailureMode,
          existingNoise: parsed.proportionality_check.noise_overblown,
          existingSignal: parsed.proportionality_check.structural_signal,
          existingQuestions: parsed.questions.map((q) =>
            normalizeQuestionSentenceCase(String(q))
          ),
        });

        return {
          synthesis: {
            executive_summary: cleanExec,
            socratic_brief: cleanBrief,
            proportionality_check: {
              noise_overblown: diagnostics.noiseOverblown,
              structural_signal: diagnostics.structuralSignal,
            },
            questions: diagnostics.questions,
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
        // Defensive validation gate: quarantine rows that lack a valid 2-to-3 sentence factual summary
        const validation = validateAndNormalizeIncidentSummary({
          id: row.id,
          title: row.title,
          sourceFeed: row.source_feed,
          rawExcerpt: row.raw_excerpt,
          logWarnings: true,
        });
        if (!validation.valid) {
          await options.db
            .prepare(
              `UPDATE telemetry_articles SET status = 'dropped' WHERE id = ?`
            )
            .bind(row.id)
            .run();
          return {
            ok: false as const,
            error: {
              id: row.id,
              title: row.title,
              error:
                validation.reason ||
                "Quarantined by defensive summary validation gate.",
            },
          };
        }

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
