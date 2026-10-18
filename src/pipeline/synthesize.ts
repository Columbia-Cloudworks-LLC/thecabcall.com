import {
  D1DatabaseLike,
  D1PreparedStatementLike,
  executeD1Batch,
} from "./ingest";
import {
  JEV_SRE_FAILURE_MODE_CRITERIA,
  JEV_WORKING_TOOL_CRITERIA,
  JevSreFailureModeKey,
  JevWorkingToolKey,
} from "./jev";
import {
  buildOrSanitizeArticleDiagnostics,
  isTemplatedOrMalformedCopy,
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
  status:
    | "dropped"
    | "triaged"
    | "synthesized"
    | "QUARANTINED"
    | "PENDING_RETRY";
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
  quarantinedCount: number;
  pendingRetryCount: number;
  articles: SynthesizedArticleResult[];
  errors?: {
    id: number;
    title: string;
    disposition: "QUARANTINED" | "PENDING_RETRY";
    error: string;
  }[];
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

export type SynthesisAttemptOutcome =
  | {
      ok: true;
      synthesis: SocraticSynthesisOutput;
      modelUsed: string;
    }
  | {
      ok: false;
      disposition: "QUARANTINED" | "PENDING_RETRY";
      reason: string;
    };

/**
 * Validates a candidate `SocraticSynthesisOutput` against strict editorial copy rules,
 * rejecting any incomplete, truncated, or Mad-Libs templated output.
 */
export function validateSynthesizedBriefOutput(
  row: TelemetryArticleRow,
  parsed: unknown
): { valid: true; synthesis: SocraticSynthesisOutput } | { valid: false; reason: string } {
  if (!parsed || typeof parsed !== "object") {
    return { valid: false, reason: "Synthesis payload is not an object" };
  }
  const obj = parsed as Record<string, any>;
  if (
    typeof obj.executive_summary !== "string" ||
    typeof obj.socratic_brief !== "string" ||
    !obj.proportionality_check ||
    typeof obj.proportionality_check !== "object" ||
    !Array.isArray(obj.questions) ||
    obj.questions.length < 2
  ) {
    return {
      valid: false,
      reason: "Synthesis payload missing required fields or has fewer than 2 questions",
    };
  }

  if (
    isTemplatedOrMalformedCopy(obj.executive_summary) ||
    isTemplatedOrMalformedCopy(obj.socratic_brief) ||
    isTemplatedOrMalformedCopy(obj.proportionality_check.noise_overblown) ||
    isTemplatedOrMalformedCopy(obj.proportionality_check.structural_signal)
  ) {
    return {
      valid: false,
      reason: "Synthesis output contains banned pipeline jargon or Mad-Libs template patterns",
    };
  }

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
    executiveSummary: obj.executive_summary,
    socraticBrief: obj.socratic_brief,
    logWarnings: false,
  });

  if (!validation.valid) {
    return {
      valid: false,
      reason: validation.reason || "Failed factual summary validation",
    };
  }

  const cleanExec =
    validation.executiveSummary ||
    sanitizeStringConcatenation(obj.executive_summary.trim());
  const cleanBrief =
    validation.factualBriefParagraph ||
    sanitizeStringConcatenation(obj.socratic_brief.split(/\n\s*\n/)[0].trim());

  const diagnostics = buildOrSanitizeArticleDiagnostics({
    title: row.title,
    sourceFeed: row.source_feed,
    factualSummary: cleanBrief,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    existingNoise: obj.proportionality_check.noise_overblown,
    existingSignal: obj.proportionality_check.structural_signal,
    existingQuestions: obj.questions.map((q: unknown) =>
      normalizeQuestionSentenceCase(String(q || ""))
    ),
  });

  if (!diagnostics.valid || diagnostics.questions.length < 2) {
    return {
      valid: false,
      reason:
        diagnostics.reason ||
        "Failed editorial diagnostics validation (incomplete or templated copy)",
    };
  }

  return {
    valid: true,
    synthesis: {
      executive_summary: cleanExec,
      socratic_brief: cleanBrief,
      proportionality_check: {
        noise_overblown: diagnostics.noiseOverblown,
        structural_signal: diagnostics.structuralSignal,
      },
      questions: [diagnostics.questions[0], diagnostics.questions[1]],
    },
  };
}

/**
 * Calls Gemini via the REST generateContent API with `responseMimeType: "application/json"`
 * and `responseSchema`. Never falls back to Mad-Libs string-interpolation templates:
 * - If API key is unconfigured or upstream fails transiently -> returns `disposition: "PENDING_RETRY"`.
 * - If model output is malformed, incomplete, or templated -> returns `disposition: "QUARANTINED"`.
 */
export async function callGeminiStructuredSynthesis(
  row: TelemetryArticleRow,
  geminiApiKey?: string,
  options?: {
    fetchImpl?: typeof fetch;
    synthesisOverride?: unknown;
  }
): Promise<SynthesisAttemptOutcome> {
  if (options?.synthesisOverride !== undefined) {
    const check = validateSynthesizedBriefOutput(row, options.synthesisOverride);
    if (!check.valid) {
      return {
        ok: false,
        disposition: "QUARANTINED",
        reason: check.reason,
      };
    }
    return {
      ok: true,
      synthesis: check.synthesis,
      modelUsed: "gemini-2.5-flash",
    };
  }

  const trimmedKey = geminiApiKey?.trim() || "";
  if (!trimmedKey || trimmedKey === "your_gemini_api_key_here") {
    return {
      ok: false,
      disposition: "PENDING_RETRY",
      reason:
        "GEMINI_API_KEY is not configured; transitioning article to PENDING_RETRY without fallback templates.",
    };
  }

  const { systemInstruction, userPrompt } = buildSystem2Prompt(row);
  const fetchFn = options?.fetchImpl ?? fetch;

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];

  let lastError = "";
  let sawMalformedOutput = false;

  for (const modelName of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
      trimmedKey
    )}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetchFn(endpoint, {
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
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        lastError = `HTTP ${response.status} (${modelName}): ${errText.slice(0, 300)}`;
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
        sawMalformedOutput = true;
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        lastError = `Invalid JSON returned from ${modelName}`;
        sawMalformedOutput = true;
        continue;
      }

      const check = validateSynthesizedBriefOutput(row, parsed);
      if (!check.valid) {
        lastError = check.reason;
        sawMalformedOutput = true;
        continue;
      }

      return {
        ok: true,
        synthesis: check.synthesis,
        modelUsed: modelName,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    disposition: sawMalformedOutput ? "QUARANTINED" : "PENDING_RETRY",
    reason: lastError || "System-2 synthesis failed",
  };
}

export const TELEMETRY_ARTICLES_SYNTHESIS_COLUMNS = `
  id,
  url_hash,
  source_feed,
  title,
  source_url,
  raw_excerpt,
  published_at,
  ingested_at,
  is_systemic_prob,
  jev_confidence,
  primary_tool,
  secondary_tool,
  sre_failure_mode,
  jev_raw_json,
  socratic_brief,
  questions_json,
  status
`;

/**
 * Queries D1 for `status = 'triaged'` rows ordered by `published_at DESC` (or specific `articleIds`),
 * runs bounded Gemini System-2 synthesis on each, and batch-updates D1 via `db.batch()`:
 * - Valid syntheses transition to `status = 'synthesized'`.
 * - Malformed or templated syntheses transition to `status = 'QUARANTINED'`.
 * - Transient API failures transition to `status = 'PENDING_RETRY'`.
 */
export async function runSynthesizePipeline(options: {
  db: D1DatabaseLike;
  geminiApiKey?: string;
  limit?: number;
  articleIds?: number[];
  fetchImpl?: typeof fetch;
  synthesisOverride?: unknown;
}): Promise<SynthesizeRunSummary> {
  const startMs = Date.now();
  const startedAt = new Date().toISOString();
  const limit = options.limit ?? 5;

  let rows: TelemetryArticleRow[] = [];

  if (options.articleIds && options.articleIds.length > 0) {
    const placeholders = options.articleIds.map(() => "?").join(", ");
    const queryResult = await options.db
      .prepare(
        `SELECT ${TELEMETRY_ARTICLES_SYNTHESIS_COLUMNS}
         FROM telemetry_articles
         WHERE id IN (${placeholders})
         ORDER BY published_at DESC`
      )
      .bind(...options.articleIds)
      .all<TelemetryArticleRow>();
    rows = queryResult.results || [];
  } else {
    const queryResult = await options.db
      .prepare(
        `SELECT ${TELEMETRY_ARTICLES_SYNTHESIS_COLUMNS}
         FROM telemetry_articles
         WHERE status = 'triaged'
         ORDER BY published_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all<TelemetryArticleRow>();
    rows = queryResult.results || [];
  }

  const articles: SynthesizedArticleResult[] = [];
  const errors: {
    id: number;
    title: string;
    disposition: "QUARANTINED" | "PENDING_RETRY";
    error: string;
  }[] = [];
  const updateStatements: D1PreparedStatementLike[] = [];
  let quarantinedCount = 0;
  let pendingRetryCount = 0;

  const results = await Promise.all(
    rows.map(async (row) => {
      const validation = validateAndNormalizeIncidentSummary({
        id: row.id,
        title: row.title,
        sourceFeed: row.source_feed,
        rawExcerpt: row.raw_excerpt,
        logWarnings: true,
      });
      if (!validation.valid) {
        return {
          ok: false as const,
          row,
          disposition: "QUARANTINED" as const,
          reason:
            validation.reason ||
            "Quarantined by defensive summary validation gate.",
        };
      }

      const outcome = await callGeminiStructuredSynthesis(
        row,
        options.geminiApiKey,
        {
          fetchImpl: options.fetchImpl,
          synthesisOverride: options.synthesisOverride,
        }
      );

      if (!outcome.ok) {
        return {
          ok: false as const,
          row,
          disposition: outcome.disposition,
          reason: outcome.reason,
        };
      }

      return {
        ok: true as const,
        row,
        synthesis: outcome.synthesis,
        modelUsed: outcome.modelUsed,
      };
    })
  );

  for (const res of results) {
    if (res.ok) {
      const secondaryTool: JevWorkingToolKey =
        res.row.secondary_tool || "twenty_four_inch_gauge";
      const questionsPayload = JSON.stringify({
        executive_summary: res.synthesis.executive_summary,
        proportionality_check: res.synthesis.proportionality_check,
        questions: res.synthesis.questions,
        model_used: res.modelUsed,
        synthesized_at: new Date().toISOString(),
      });

      updateStatements.push(
        options.db
          .prepare(
            `UPDATE telemetry_articles
             SET socratic_brief = ?,
                 questions_json = ?,
                 status = 'synthesized'
             WHERE id = ?`
          )
          .bind(res.synthesis.socratic_brief, questionsPayload, res.row.id)
      );

      articles.push({
        id: res.row.id,
        url_hash: res.row.url_hash,
        source_feed: res.row.source_feed,
        title: res.row.title,
        source_url: res.row.source_url,
        published_at: res.row.published_at,
        primary_tool: res.row.primary_tool,
        secondary_tool: secondaryTool,
        sre_failure_mode: res.row.sre_failure_mode,
        is_systemic_prob: res.row.is_systemic_prob,
        jev_confidence: res.row.jev_confidence,
        model_used: res.modelUsed,
        synthesis: res.synthesis,
      });
    } else {
      if (res.disposition === "QUARANTINED") {
        quarantinedCount++;
      } else {
        pendingRetryCount++;
      }

      updateStatements.push(
        options.db
          .prepare(
            `UPDATE telemetry_articles
             SET status = ?,
                 socratic_brief = NULL,
                 questions_json = NULL
             WHERE id = ?`
          )
          .bind(res.disposition, res.row.id)
      );

      errors.push({
        id: res.row.id,
        title: res.row.title,
        disposition: res.disposition,
        error: res.reason,
      });
    }
  }

  if (updateStatements.length > 0) {
    await executeD1Batch(options.db, updateStatements);
  }

  const completedAt = new Date().toISOString();
  const elapsedMs = Math.max(120, Date.now() - startMs);
  const avgLatencyMs =
    rows.length > 0 ? Math.round(elapsedMs / rows.length) : elapsedMs;

  const notes =
    articles.length > 0
      ? `Synthesized ${articles.length} triaged D1 incident(s) (IDs: ${articles.map((a) => a.id).join(", ")}), ${quarantinedCount} quarantined, ${pendingRetryCount} pending retry.`
      : rows.length === 0
      ? "System-2 synthesis sweep completed: 0 pending 'triaged' rows in D1 queue."
      : `System-2 synthesis evaluated ${rows.length} row(s): 0 synthesized, ${quarantinedCount} quarantined, ${pendingRetryCount} pending retry.`;

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
        quarantinedCount,
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
    quarantinedCount,
    pendingRetryCount,
    articles,
    errors: errors.length > 0 ? errors : undefined,
  };
}

