import { appendAuditEntry } from "./audit";
import {
  deescalateHeadlineDeterministic,
  deescalateHeadlineWithGemini,
  ensureEditorialPipelineSchema,
  extractImageFromSourceArticleUrl,
  getPipelineTransformMap,
  HeadlineDeescalationResult,
  ImageSourceType,
  isAlarmistHeadline,
  resolveContextualPublicDomainImage,
} from "./editorial";
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
  hasSyntheticPlaceholderIdentifier,
  isTemplatedOrMalformedCopy,
  normalizeQuestionSentenceCase,
  sanitizeStringConcatenation,
  sanitizeSyntheticPlaceholders,
  validateAndNormalizeIncidentSummary,
} from "../lib/sanitize";
import { SreFailureModeId, WorkingToolId } from "../lib/taxonomy";

export {
  deescalateHeadlineDeterministic,
  deescalateHeadlineWithGemini,
  isAlarmistHeadline,
};
export type { HeadlineDeescalationResult };

export interface TelemetryArticleRow {
  id: number;
  url_hash: string;
  source_feed: string;
  title: string;
  original_title?: string | null;
  title_rewritten?: number | null;
  title_rewrite_reason?: string | null;
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
  image_url?: string | null;
  image_alt?: string | null;
  image_caption?: string | null;
  image_source_type?: ImageSourceType;
  editorial_notes?: string | null;
  is_pinned?: number | null;
  is_hidden?: number | null;
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
        "Exactly 2 plain-English factual sentences summarizing the news event derived directly from the source article. Never mention classifier names, decimal weights, or pipeline jargon. Never invent, extrapolate, or insert placeholder identifiers, CVE numbers (such as CVE-2026-99999), bill numbers, or statistics not explicitly present verbatim in the source text.",
    },
    socratic_brief: {
      type: "STRING",
      description:
        "1 concise, unvarnished factual paragraph (2 to 3 plain-English sentences) summarizing the verifiable facts of the news event. Do NOT include paragraphs reciting classifier weights or boilerplate caveats. Never invent, extrapolate, or insert placeholder identifiers, CVE numbers (such as CVE-2026-99999), bill numbers, or statistics not explicitly present verbatim in the source text.",
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

export function buildSystem2Prompt(
  row: TelemetryArticleRow,
  customDirective?: string
): {
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

  const directiveBlock =
    customDirective && customDirective.trim().length > 0
      ? `\n\n3. CUSTOM SYSTEM-2 EDITORIAL DIRECTIVE:\n   ${customDirective.trim()}`
      : "";

  const systemInstruction = `You are the Post-Incident Review (PIR) editorial synthesizer for Change Advisory Board (thecabcall.com), analyzing current events through Site Reliability Engineering (SRE) and the Working Tools of Freemasonry.

HARD GOVERNANCE CONSTRAINTS (NON-NEGOTIABLE):
1. STRICT CLASSIFICATION BINDING: You are bound by the following diagnostic classification:
   - Primary Working Tool: ${primaryDisplay} — Criteria: ${JEV_WORKING_TOOL_CRITERIA[row.primary_tool]}
   - Secondary Working Tool: ${secondaryDisplay} — Criteria: ${JEV_WORKING_TOOL_CRITERIA[secondaryTool]}
   - SRE Failure Mode: ${sreDisplay} — Criteria: ${JEV_SRE_FAILURE_MODE_CRITERIA[row.sre_failure_mode]}
   - 6-Tool Probability Vector: ${JSON.stringify(toolProbs)}

2. ZERO PIPELINE JARGON, ZERO HEADLINE INTERPOLATION & ZERO DEFINITIONS RULE:
   - NEVER mention internal classifier names ("Jev", "TypeSafe Jev", "jev-1.14.0", "System-1", "ingestion gate") or raw decimal weights ("0.61 primary weight") anywhere in your output.
   - NEVER paste or interpolate the article headline string into "noise_overblown", "structural_signal", or "questions" (e.g. never write "Public commentary around {Headline} focuses on..." or "In {Headline}, which specific check..."). Instead, refer naturally in plain workshop English to "this case", "this decision", "this action", or "this breakdown" and name the specific actors or systems involved.
   - NEVER use corporate compliance legalese like "live operational practice to diverge from the stated legal or institutional charter" or "without triggering an earlier corrective audit". Write in plain, direct workshop English.
   - Do NOT recite dictionary or monitorial definitions of what a Square, Plumb, Level, Gauge, Gavel, or Trowel is.
   - STRICT ANTI-HALLUCINATION CONSTRAINT: Never invent, extrapolate, or insert placeholder identifiers, CVE numbers (such as CVE-2026-99999), bill numbers, or statistics not explicitly present verbatim in the source text.
   - Zero partisan punditry, zero moralizing conclusions, zero AI clichés ("delve", "testament", "stark reminder", "wake-up call", "underscores").${directiveBlock}`;

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
1. "executive_summary": 2 plain-English factual sentences summarizing what happened in the news event based on the source excerpt. No classifier names or percentages. Never invent, extrapolate, or insert placeholder identifiers, CVE numbers (such as CVE-2026-99999), bill numbers, or statistics not explicitly present verbatim in the source text.
2. "socratic_brief": 1 concise, unvarnished factual paragraph (2 to 3 plain-English sentences) stating the facts of the incident. Do not include a second or third paragraph reciting tool weights or telemetry caveats. Never invent, extrapolate, or insert placeholder identifiers, CVE numbers (such as CVE-2026-99999), bill numbers, or statistics not explicitly present verbatim in the source text.
3. "proportionality_check": { "noise_overblown": "...", "structural_signal": "..." } written in plain, direct workshop English referring naturally to "this case", "this decision", "this action", or "this breakdown" (never interpolating the raw headline string or repeating sentences from socratic_brief).
4. "questions": Exactly 2 direct, plain-spoken Socratic questions in standard sentence case anchored to ${primaryDisplay} and ${secondaryDisplay} that refer naturally to "this case", "this decision", or the specific institutions involved without pasting the headline string.`;

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
  const propObj =
    obj.proportionality_check && typeof obj.proportionality_check === "object"
      ? obj.proportionality_check
      : obj.proportionality && typeof obj.proportionality === "object"
        ? obj.proportionality
        : null;

  if (
    typeof obj.executive_summary !== "string" ||
    typeof obj.socratic_brief !== "string" ||
    !propObj ||
    !Array.isArray(obj.questions) ||
    obj.questions.length < 2
  ) {
    return {
      valid: false,
      reason: "Synthesis payload missing required fields or has fewer than 2 questions",
    };
  }

  const rawNoise = String(propObj.noise_overblown ?? propObj.noise ?? "").trim();
  const rawSignal = String(propObj.structural_signal ?? propObj.signal ?? "").trim();

  if (rawNoise.length < 25 || rawSignal.length < 25) {
    return {
      valid: false,
      reason: "Synthesis proportionality_check fields are missing or too short",
    };
  }

  if (
    isTemplatedOrMalformedCopy(obj.executive_summary, row.title) ||
    isTemplatedOrMalformedCopy(obj.socratic_brief, row.title) ||
    isTemplatedOrMalformedCopy(rawNoise, row.title) ||
    isTemplatedOrMalformedCopy(rawSignal, row.title) ||
    obj.questions.some((q: unknown) =>
      isTemplatedOrMalformedCopy(String(q || ""), row.title)
    )
  ) {
    return {
      valid: false,
      reason: "Synthesis output contains banned pipeline jargon or Mad-Libs template patterns",
    };
  }

  // Reject hallucinated CVE identifiers not present in the source text (or synthetic placeholder CVEs when source had none)
  const combinedCandidateText = [
    obj.executive_summary,
    obj.socratic_brief,
    rawNoise,
    rawSignal,
    ...obj.questions.map((q: unknown) => String(q || "")),
  ].join(" ");
  const sanitizedSourceText = `${row.title || ""} ${sanitizeSyntheticPlaceholders(
    row.raw_excerpt || ""
  )}`.toUpperCase();
  const cveMatches = combinedCandidateText.match(/\bCVE-\d{4}-\d{4,7}\b/gi) || [];
  const sourceHadSyntheticCve = hasSyntheticPlaceholderIdentifier(
    row.raw_excerpt
  );
  for (const cve of cveMatches) {
    if (hasSyntheticPlaceholderIdentifier(cve) && !sourceHadSyntheticCve) {
      return {
        valid: false,
        reason: `Synthesis output contains fabricated placeholder identifier (${cve}) not present verbatim in source text`,
      };
    }
    if (
      !hasSyntheticPlaceholderIdentifier(cve) &&
      !sanitizedSourceText.includes(cve.toUpperCase())
    ) {
      return {
        valid: false,
        reason: `Synthesis output contains hallucinated CVE identifier (${cve}) not present verbatim in source text`,
      };
    }
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
    factualSummary: `${cleanBrief}\n\n${cleanExec}`,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    existingNoise: rawNoise,
    existingSignal: rawSignal,
    existingQuestions: obj.questions.map((q: unknown) =>
      normalizeQuestionSentenceCase(String(q || ""), row.title)
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
    customDirective?: string;
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

  const { systemInstruction, userPrompt } = buildSystem2Prompt(
    row,
    options?.customDirective
  );
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
  original_title,
  title_rewritten,
  title_rewrite_reason,
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
  status,
  image_url,
  image_alt,
  image_caption,
  image_source_type,
  editorial_notes,
  is_pinned,
  is_hidden
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

  await ensureEditorialPipelineSchema(options.db);
  const transformMap = await getPipelineTransformMap(options.db).catch(() => ({
    auto_deescalate_titles: {
      transformKey: "auto_deescalate_titles",
      enabled: true,
      config: { mode: "alarmist_only" },
      updatedBy: "system_bootstrap",
      updatedAt: startedAt,
    },
    auto_extract_rss_images: {
      transformKey: "auto_extract_rss_images",
      enabled: true,
      config: {},
      updatedBy: "system_bootstrap",
      updatedAt: startedAt,
    },
    auto_generate_fallback_cards: {
      transformKey: "auto_generate_fallback_cards",
      enabled: true,
      config: {},
      updatedBy: "system_bootstrap",
      updatedAt: startedAt,
    },
    custom_system2_directive: {
      transformKey: "custom_system2_directive",
      enabled: true,
      config: { directive: "" },
      updatedBy: "system_bootstrap",
      updatedAt: startedAt,
    },
  }));

  const autoDeescalateEnabled =
    transformMap.auto_deescalate_titles?.enabled ?? true;
  const autoFallbackCardEnabled =
    transformMap.auto_generate_fallback_cards?.enabled ?? true;
  const customDirective =
    transformMap.custom_system2_directive?.enabled &&
    typeof transformMap.custom_system2_directive?.config?.directive === "string"
      ? String(transformMap.custom_system2_directive.config.directive)
      : "";

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

      let activeTitle = row.title;
      const originalTitle = row.original_title || row.title;
      let titleRewritten = Number(row.title_rewritten ?? 0) === 1 ? 1 : 0;
      let titleRewriteReason = row.title_rewrite_reason || null;

      if (
        autoDeescalateEnabled &&
        !titleRewritten &&
        isAlarmistHeadline(row.title)
      ) {
        const deesc = await deescalateHeadlineWithGemini(
          row.title,
          row.raw_excerpt,
          options.geminiApiKey,
          {
            fetchImpl: options.fetchImpl,
            forceRewrite: true,
          }
        );
        if (deesc.changed && deesc.neutralTitle !== row.title) {
          activeTitle = deesc.neutralTitle;
          titleRewritten = 1;
          titleRewriteReason = deesc.rationale;
        }
      }

      const rowForSynthesis: TelemetryArticleRow = {
        ...row,
        title: activeTitle,
        original_title: originalTitle,
        title_rewritten: titleRewritten,
        title_rewrite_reason: titleRewriteReason,
      };

      const outcome = await callGeminiStructuredSynthesis(
        rowForSynthesis,
        options.geminiApiKey,
        {
          fetchImpl: options.fetchImpl,
          synthesisOverride: options.synthesisOverride,
          customDirective,
        }
      );

      if (!outcome.ok) {
        return {
          ok: false as const,
          row: rowForSynthesis,
          disposition: outcome.disposition,
          reason: outcome.reason,
        };
      }

      return {
        ok: true as const,
        row: rowForSynthesis,
        previousTitle: row.title,
        headlineChanged: activeTitle !== row.title,
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

      const hasRealExistingImage =
        typeof res.row.image_url === "string" &&
        res.row.image_url.trim().length > 0 &&
        res.row.image_source_type !== "none" &&
        res.row.image_source_type !== "svg_card" &&
        !res.row.image_url.trim().startsWith("/media/card-d1-");

      let resolvedImageUrl: string | null = hasRealExistingImage
        ? res.row.image_url!.trim()
        : null;
      let resolvedImageSourceType: ImageSourceType = hasRealExistingImage
        ? (res.row.image_source_type as ImageSourceType) || "rss_extracted"
        : "none";
      let resolvedImageAlt: string | null = hasRealExistingImage
        ? res.row.image_alt || res.row.title
        : null;
      let resolvedImageCaption: string | null = hasRealExistingImage
        ? res.row.image_caption || null
        : null;

      if (
        !resolvedImageUrl &&
        (!options.synthesisOverride || Boolean(options.fetchImpl))
      ) {
        const ogExtracted = await extractImageFromSourceArticleUrl(
          res.row.source_url,
          res.row.title,
          options.fetchImpl
        );
        if (ogExtracted) {
          resolvedImageUrl = ogExtracted.imageUrl;
          resolvedImageAlt = ogExtracted.imageAlt;
          resolvedImageCaption = ogExtracted.imageCaption;
          resolvedImageSourceType = "og_scraped";
        } else {
          const archival = await resolveContextualPublicDomainImage(
            res.row.title,
            res.row.raw_excerpt,
            undefined,
            options.fetchImpl
          );
          if (archival) {
            resolvedImageUrl = archival.imageUrl;
            resolvedImageAlt = archival.imageAlt;
            resolvedImageCaption = archival.imageCaption;
            resolvedImageSourceType = "wikimedia_commons";
          }
        }
      }

      const imageUrl = resolvedImageUrl
        ? resolvedImageUrl
        : autoFallbackCardEnabled
        ? `/media/card-d1-${res.row.id}.svg`
        : null;
      const imageSourceType: ImageSourceType = resolvedImageUrl
        ? resolvedImageSourceType
        : autoFallbackCardEnabled
        ? "svg_card"
        : "none";
      const imageAlt = resolvedImageUrl
        ? resolvedImageAlt || res.row.title
        : autoFallbackCardEnabled
        ? `${WORKING_TOOL_DISPLAY_NAMES[res.row.primary_tool]} · ${SRE_FAILURE_DISPLAY_NAMES[res.row.sre_failure_mode]} telemetry blueprint for ${res.row.title}`
        : null;
      const imageCaption = resolvedImageUrl
        ? resolvedImageCaption
        : autoFallbackCardEnabled
        ? `Blueprint Card · ${WORKING_TOOL_DISPLAY_NAMES[res.row.primary_tool]} / ${SRE_FAILURE_DISPLAY_NAMES[res.row.sre_failure_mode]}`
        : null;

      updateStatements.push(
        options.db
          .prepare(
            `UPDATE telemetry_articles
             SET title = ?,
                 original_title = ?,
                 title_rewritten = ?,
                 title_rewrite_reason = ?,
                 socratic_brief = ?,
                 questions_json = ?,
                 image_url = ?,
                 image_alt = ?,
                 image_caption = ?,
                 image_source_type = ?,
                 status = 'synthesized'
             WHERE id = ?`
          )
          .bind(
            res.row.title,
            res.row.original_title || res.row.title,
            res.row.title_rewritten ?? 0,
            res.row.title_rewrite_reason ?? null,
            res.synthesis.socratic_brief,
            questionsPayload,
            imageUrl,
            imageAlt,
            imageCaption,
            imageSourceType,
            res.row.id
          )
      );

      if (res.headlineChanged) {
        await appendAuditEntry(options.db, {
          actorEmail: "system_pipeline@thecabcall.com",
          authMethod: "system_bootstrap",
          actionType: "incident.rewrite_title",
          targetType: "incident_article",
          targetId: String(res.row.id),
          reason:
            res.row.title_rewrite_reason ||
            "Automated System-2 de-alarmist headline rewrite.",
          beforeState: {
            id: res.row.id,
            title: res.previousTitle,
            original_title: res.row.original_title || res.previousTitle,
            title_rewritten: 0,
          },
          afterState: {
            id: res.row.id,
            title: res.row.title,
            original_title: res.row.original_title || res.previousTitle,
            title_rewritten: 1,
            title_rewrite_reason: res.row.title_rewrite_reason,
          },
          replayCommand: {
            type: "d1.upsert_row",
            table: "telemetry_articles",
            primaryKeyColumn: "id",
            primaryKeyValue: res.row.id,
            row: {
              id: res.row.id,
              title: res.row.title,
              original_title: res.row.original_title || res.previousTitle,
              title_rewritten: 1,
              title_rewrite_reason: res.row.title_rewrite_reason,
            },
          },
        }).catch(() => {});
      }

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

