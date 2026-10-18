export type JevWorkingToolKey =
  | "twenty_four_inch_gauge"
  | "common_gavel"
  | "plumb"
  | "square"
  | "level"
  | "trowel";

export type JevSreFailureModeKey =
  | "configuration_drift"
  | "cascading_failure"
  | "untested_failover"
  | "alert_fatigue"
  | "blameless_postmortem_gap"
  | "capacity_exhaustion";

export interface JevArticleInput {
  title: string;
  source?: string;
  excerpt: string;
}

export interface JevSystemOneRequest {
  model: "jev-1.14.0";
  state: {
    title: string;
    source: string;
    excerpt: string;
  };
  questions: {
    is_systemic_event: {
      type: "noul";
      instructions: string;
    };
    working_tool: {
      type: "choice";
      instructions: string;
      criteria: Record<JevWorkingToolKey, string>;
    };
    sre_failure_mode: {
      type: "choice";
      instructions: string;
      criteria: Record<JevSreFailureModeKey, string>;
    };
  };
}

export interface JevSystemOneResponse {
  id?: string;
  model: string;
  mode?: "live_typesafe_api" | "local_deterministic_fallback";
  answers: {
    is_systemic_event: {
      type: "noul";
      noul: number;
    };
    working_tool: {
      type: "choice";
      probabilities: Record<JevWorkingToolKey, number>;
      confidence: number;
    };
    sre_failure_mode: {
      type: "choice";
      probabilities: Record<JevSreFailureModeKey, number>;
      confidence: number;
    };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface JevEvaluationOptions {
  minSystemicProb?: number;
  minConfidence?: number;
  systemicProbDelta?: number;
  forcedPrimaryTool?: JevWorkingToolKey;
  appliedFilterNames?: string[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  rawResponseOverride?: unknown;
}

export type JevDispositionStatus = "triaged" | "QUARANTINED" | "dropped";

export interface JevEvaluationResult {
  isSystemicProb: number;
  jevConfidence: number;
  primaryTool: JevWorkingToolKey;
  secondaryTool: JevWorkingToolKey;
  sreFailureMode: JevSreFailureModeKey;
  workingToolProbabilities: Record<JevWorkingToolKey, number>;
  sreFailureModeProbabilities: Record<JevSreFailureModeKey, number>;
  status: JevDispositionStatus;
  validationValid: boolean;
  quarantineReason?: string;
  rawJson: string;
  rawResponse: JevSystemOneResponse;
}

export interface JevBoundaryValidationResult {
  valid: boolean;
  quarantined: boolean;
  status: "triaged" | "QUARANTINED";
  reason?: string;
}

export const VALID_JEV_WORKING_TOOL_KEYS: readonly JevWorkingToolKey[] = [
  "twenty_four_inch_gauge",
  "common_gavel",
  "plumb",
  "square",
  "level",
  "trowel",
] as const;

export const VALID_JEV_SRE_FAILURE_MODE_KEYS: readonly JevSreFailureModeKey[] = [
  "configuration_drift",
  "cascading_failure",
  "untested_failover",
  "alert_fatigue",
  "blameless_postmortem_gap",
  "capacity_exhaustion",
] as const;

export const VALID_DISPLAY_WORKING_TOOLS = new Set<string>([
  "24-Inch Gauge",
  "Common Gavel",
  "The Plumb",
  "The Square",
  "The Level",
  "The Trowel",
]);

export const VALID_DISPLAY_SRE_FAILURE_MODES = new Set<string>([
  "Configuration Drift",
  "Cascading Failure",
  "Single Point of Failure (SPOF) / Untested Failover",
  "Alert Fatigue & Signal Loss",
  "Blame Culture vs. Root-Cause Isolation",
  "Technical & Institutional Debt",
]);

const JEV_TOOL_KEY_SET = new Set<string>(VALID_JEV_WORKING_TOOL_KEYS);
const JEV_SRE_KEY_SET = new Set<string>(VALID_JEV_SRE_FAILURE_MODE_KEYS);

/**
 * Verifies that a value is a finite number strictly within [0.0, 1.0].
 */
export function isFiniteUnitProbability(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    !Number.isNaN(value) &&
    value >= 0.0 &&
    value <= 1.0
  );
}

/**
 * Strict runtime validator for `jev-1.14.0` evaluation outputs.
 * Verifies valid enum mappings (SRE principles and Masonic working tools)
 * and checks that all confidence & probability scores are finite numbers within [0.0, 1.0].
 */
export function validateJevEvaluationOutput(
  candidate: unknown,
  thresholds?: { minSystemicProb?: number; minConfidence?: number }
): JevBoundaryValidationResult {
  if (!candidate || typeof candidate !== "object") {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: "Jev output is null or not an object",
    };
  }

  const obj = candidate as Record<string, unknown>;
  const isSystemicProb = obj.isSystemicProb;
  const jevConfidence = obj.jevConfidence;

  if (!isFiniteUnitProbability(isSystemicProb)) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: `Invalid isSystemicProb (${String(isSystemicProb)}): must be a finite number in [0.0, 1.0]`,
    };
  }

  if (!isFiniteUnitProbability(jevConfidence)) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: `Invalid jevConfidence (${String(jevConfidence)}): must be a finite number in [0.0, 1.0]`,
    };
  }

  const primaryTool = obj.primaryTool;
  const secondaryTool = obj.secondaryTool;
  const sreFailureMode = obj.sreFailureMode ?? obj.failureMode;

  const isPrimaryValid =
    typeof primaryTool === "string" &&
    (JEV_TOOL_KEY_SET.has(primaryTool) || VALID_DISPLAY_WORKING_TOOLS.has(primaryTool));
  if (!isPrimaryValid) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: `Invalid primaryTool enum value: "${String(primaryTool)}"`,
    };
  }

  const isSecondaryValid =
    typeof secondaryTool === "string" &&
    (JEV_TOOL_KEY_SET.has(secondaryTool) || VALID_DISPLAY_WORKING_TOOLS.has(secondaryTool));
  if (!isSecondaryValid) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: `Invalid secondaryTool enum value: "${String(secondaryTool)}"`,
    };
  }

  if (primaryTool === secondaryTool) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: `primaryTool and secondaryTool must be distinct (both were "${String(primaryTool)}")`,
    };
  }

  const isFailureModeValid =
    typeof sreFailureMode === "string" &&
    (JEV_SRE_KEY_SET.has(sreFailureMode) ||
      VALID_DISPLAY_SRE_FAILURE_MODES.has(sreFailureMode));
  if (!isFailureModeValid) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: `Invalid sreFailureMode enum value: "${String(sreFailureMode)}"`,
    };
  }

  const toolProbs = (obj.workingToolProbabilities ?? obj.toolProbabilities) as
    | Record<string, unknown>
    | undefined;
  if (!toolProbs || typeof toolProbs !== "object" || Array.isArray(toolProbs)) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: "Missing workingToolProbabilities distribution object",
    };
  }

  const toolKeys = Object.keys(toolProbs);
  if (toolKeys.length !== 6) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: `Expected 6 workingToolProbabilities entries, got ${toolKeys.length}`,
    };
  }

  let toolProbSum = 0;
  for (const [k, v] of Object.entries(toolProbs)) {
    if (!JEV_TOOL_KEY_SET.has(k) && !VALID_DISPLAY_WORKING_TOOLS.has(k)) {
      return {
        valid: false,
        quarantined: true,
        status: "QUARANTINED",
        reason: `Unknown working tool key "${k}" in probability distribution`,
      };
    }
    if (!isFiniteUnitProbability(v)) {
      return {
        valid: false,
        quarantined: true,
        status: "QUARANTINED",
        reason: `Invalid probability ${String(v)} for working tool "${k}"`,
      };
    }
    toolProbSum += v;
  }

  if (toolProbSum <= 0 || toolProbSum > 1.05) {
    return {
      valid: false,
      quarantined: true,
      status: "QUARANTINED",
      reason: `Working tool probability sum out of bounds: ${toolProbSum}`,
    };
  }

  const sreProbs = (obj.sreFailureModeProbabilities ??
    obj.failureModeProbabilities) as Record<string, unknown> | undefined;
  if (sreProbs !== undefined) {
    if (!sreProbs || typeof sreProbs !== "object" || Array.isArray(sreProbs)) {
      return {
        valid: false,
        quarantined: true,
        status: "QUARANTINED",
        reason: "Malformed sreFailureModeProbabilities distribution object",
      };
    }
    const sreKeys = Object.keys(sreProbs);
    if (sreKeys.length !== 6) {
      return {
        valid: false,
        quarantined: true,
        status: "QUARANTINED",
        reason: `Expected 6 sreFailureModeProbabilities entries, got ${sreKeys.length}`,
      };
    }
    let sreProbSum = 0;
    for (const [k, v] of Object.entries(sreProbs)) {
      if (!JEV_SRE_KEY_SET.has(k) && !VALID_DISPLAY_SRE_FAILURE_MODES.has(k)) {
        return {
          valid: false,
          quarantined: true,
          status: "QUARANTINED",
          reason: `Unknown SRE failure mode key "${k}" in probability distribution`,
        };
      }
      if (!isFiniteUnitProbability(v)) {
        return {
          valid: false,
          quarantined: true,
          status: "QUARANTINED",
          reason: `Invalid probability ${String(v)} for SRE failure mode "${k}"`,
        };
      }
      sreProbSum += v;
    }
    if (sreProbSum <= 0 || sreProbSum > 1.05) {
      return {
        valid: false,
        quarantined: true,
        status: "QUARANTINED",
        reason: `SRE failure mode probability sum out of bounds: ${sreProbSum}`,
      };
    }
  }

  const minSystemicProb = thresholds?.minSystemicProb ?? 0.7;
  const minConfidence = thresholds?.minConfidence ?? 0.5;

  if (isSystemicProb < minSystemicProb) {
    return {
      valid: true,
      quarantined: true,
      status: "QUARANTINED",
      reason: `isSystemicProb (${isSystemicProb}) below threshold (${minSystemicProb})`,
    };
  }

  if (jevConfidence < minConfidence) {
    return {
      valid: true,
      quarantined: true,
      status: "QUARANTINED",
      reason: `jevConfidence (${jevConfidence}) below threshold (${minConfidence})`,
    };
  }

  return {
    valid: true,
    quarantined: false,
    status: "triaged",
  };
}

export const JEV_WORKING_TOOL_CRITERIA: Record<JevWorkingToolKey, string> = {
  twenty_four_inch_gauge:
    "Resource allocation, time prioritization, neglected maintenance, or misspent attention budget.",
  common_gavel:
    "Stripping away political theater, ego, emotional escalation, or defensive blame-shifting to isolate root cause.",
  plumb:
    "Upright conduct under pressure, integrity failure, corruption, or refusing to cut corners when incentives push for compromise.",
  square:
    "Drift between stated policy/law/values and actual execution; contract or constitutional friction.",
  level:
    "Asymmetric accountability where leadership or system architects insulate themselves from the consequences borne by citizens or end users.",
  trowel:
    "Breakdown of institutional trust, cross-group coordination failure, or fractured communication between silos.",
};

export const JEV_SRE_FAILURE_MODE_CRITERIA: Record<JevSreFailureModeKey, string> =
  {
    configuration_drift:
      "Actual production behavior has diverged silently from the documented spec or rulebook.",
    cascading_failure:
      "A localized component failure or bottleneck triggered downstream systemic overload.",
    untested_failover:
      "A backup plan, safeguard, or oversight mechanism failed when actually called upon in production.",
    alert_fatigue:
      "Warning signs or audit flags were present beforehand but ignored due to noise or complacency.",
    blameless_postmortem_gap:
      "Actors are punishing a scapegoat or hiding telemetry instead of fixing the underlying system design.",
    capacity_exhaustion:
      "Demand or crisis load exceeded the system's provisioned error budget or physical throughput.",
  };

export function buildJevRequestPayload(
  article: JevArticleInput
): JevSystemOneRequest {
  return {
    model: "jev-1.14.0",
    state: {
      title: article.title.trim(),
      source: (article.source || "US Telemetry Feed").trim(),
      excerpt: article.excerpt.trim().slice(0, 2500),
    },
    questions: {
      is_systemic_event: {
        type: "noul",
        instructions:
          "Does this article describe a significant institutional, policy, infrastructure, leadership, or ethical accountability event affecting the public, rather than sports, entertainment, celebrity gossip, product reviews, or routine weather?",
      },
      working_tool: {
        type: "choice",
        instructions:
          "Which Masonic Working Tool best diagnoses the central tension of this event?",
        criteria: JEV_WORKING_TOOL_CRITERIA,
      },
      sre_failure_mode: {
        type: "choice",
        instructions:
          "Which Site Reliability Engineering concept best parallels the operational dynamic in this story?",
        criteria: JEV_SRE_FAILURE_MODE_CRITERIA,
      },
    },
  };
}

function normalizeDistribution<K extends string>(
  scores: Record<K, number>
): Record<K, number> {
  const keys = Object.keys(scores) as K[];
  const total = keys.reduce((sum, k) => sum + Math.max(0.001, scores[k]), 0);
  const normalized = {} as Record<K, number>;
  let runningSum = 0;

  keys.forEach((k, idx) => {
    if (idx === keys.length - 1) {
      normalized[k] = Math.max(0, Math.round((1 - runningSum) * 1000) / 1000);
    } else {
      const val = Math.round((Math.max(0.001, scores[k]) / total) * 1000) / 1000;
      normalized[k] = val;
      runningSum += val;
    }
  });

  return normalized;
}

function evaluateDeterministicFallback(
  payload: JevSystemOneRequest
): JevSystemOneResponse {
  const text =
    `${payload.state.title} ${payload.state.excerpt}`.toLowerCase();

  // Equal baseline across all 6 tools (no default bias toward 'square')
  const toolScores: Record<JevWorkingToolKey, number> = {
    twenty_four_inch_gauge: 0.1,
    common_gavel: 0.1,
    plumb: 0.1,
    square: 0.1,
    level: 0.1,
    trowel: 0.1,
  };

  if (
    /(maintenance|budget|staffing|shortage|resource|priorit|schedule|delay|attention|backlog|funding|allocation|million|billion|cost|spend|subsidy)/.test(
      text
    )
  ) {
    toolScores.twenty_four_inch_gauge += 0.48;
  }
  if (
    /(blame|theater|rhetoric|partisan|hearing|spin|feud|ego|lawsuit|accus|controversy|backlash|ousted|fired|transitioning out|press secretary|opinion|talk of|hero|pain)/.test(
      text
    )
  ) {
    toolScores.common_gavel += 0.49;
  }
  if (
    /(audit|skipped|ethics|corruption|fraud|whistleblower|safety|corner|violation|bribe|inspector|falsif|integrity|attack|beat|shooting|killed|violence|abuse)/.test(
      text
    )
  ) {
    toolScores.plumb += 0.51;
  }
  if (
    /(policy|law|constitution|court|ruling|compliance|contract|mandate|regulation|diverged|statute|drift|order|exempting|sanction|rules for|program|goals)/.test(
      text
    )
  ) {
    toolScores.square += 0.5;
  }
  if (
    /(executive|ceo|board|bonus|bailout|layoff|asymmetric|taxpayer|ratepayer|immunity|insulat|accountability|wall street|banks|shutdown|workers|union|drops dei)/.test(
      text
    )
  ) {
    toolScores.level += 0.51;
  }
  if (
    /(coordination|silo|trust|diploma|alliance|coalition|interagency|communication|fractur|supply chain|partner|relationship|allies|discuss|negoti|split)/.test(
      text
    )
  ) {
    toolScores.trowel += 0.52;
  }

  // Equal baseline across all 6 SRE failure modes
  const sreScores: Record<JevSreFailureModeKey, number> = {
    configuration_drift: 0.1,
    cascading_failure: 0.1,
    untested_failover: 0.1,
    alert_fatigue: 0.1,
    blameless_postmortem_gap: 0.1,
    capacity_exhaustion: 0.1,
  };

  if (
    /(policy|rule|compliance|spec|drift|law|court|diverged|unlawful|unconstitutional|mandate|exempting|order|drops|ends program)/.test(
      text
    )
  ) {
    sreScores.configuration_drift += 0.52;
  }
  if (
    /(outage|cascade|grid|chain|downstream|spillover|contagion|collapse|network|widespread|ruptur|allies|hurt|sell billions|market)/.test(
      text
    )
  ) {
    sreScores.cascading_failure += 0.51;
  }
  if (
    /(backup|safeguard|oversight|contingency|failover|emergency|redundan|failed to stop|check|shooting|security|protection)/.test(
      text
    )
  ) {
    sreScores.untested_failover += 0.52;
  }
  if (
    /(alert|warning|ignored|dismissed|skipped|repeatedly|flag|missed|complacen|inspection|few answers)/.test(
      text
    )
  ) {
    sreScores.alert_fatigue += 0.58;
  }
  if (
    /(blame|scapegoat|fired|resign|ousted|transitioning out|cover-up|conceal|punish|hearing|finger-pointing|casts doubt)/.test(
      text
    )
  ) {
    sreScores.blameless_postmortem_gap += 0.54;
  }
  if (
    /(shortage|staffing|overload|capacity|exhaust|crowded|deficit|surge|strain|bottleneck|inflation|post|funding|million|shutdown)/.test(
      text
    )
  ) {
    sreScores.capacity_exhaustion += 0.51;
  }

  const workingToolProbs = normalizeDistribution(toolScores);
  const sreProbs = normalizeDistribution(sreScores);

  const lowSignalPattern =
    /\b(nfl|nba|mlb|nhl|touchdown|playoff|box office|red carpet|celebrity|recipe|horoscope|review:|deal alert|best headphones|wordle|crossword|market talk|roundup:|hot flashes|night sweats)\b/i;
  const highSignalPattern =
    /\b(federal|court|agency|faa|sec|fcc|doj|pentagon|senate|congress|policy|infrastructure|outage|grid|security|audit|regulation|economy|bank|treasury|supply|governance|system|investigation|ruling|budget|cyber|administration|department|public|law|sanctions|allies|shutdown)\b/i;

  let isSystemicProb = 0.76;
  if (lowSignalPattern.test(text)) {
    isSystemicProb = 0.34;
  } else if (highSignalPattern.test(text)) {
    isSystemicProb = 0.89;
  } else if (payload.state.excerpt.length < 60) {
    isSystemicProb = 0.54;
  }

  const topToolProb = Math.max(...Object.values(workingToolProbs));
  const topSreProb = Math.max(...Object.values(sreProbs));

  return {
    id: `jev_local_${Date.now()}`,
    model: "jev-1.14.0",
    mode: "local_deterministic_fallback",
    answers: {
      is_systemic_event: {
        type: "noul",
        noul: isSystemicProb,
      },
      working_tool: {
        type: "choice",
        probabilities: workingToolProbs,
        confidence: Math.round(Math.min(0.96, topToolProb + 0.35) * 1000) / 1000,
      },
      sre_failure_mode: {
        type: "choice",
        probabilities: sreProbs,
        confidence: Math.round(Math.min(0.96, topSreProb + 0.35) * 1000) / 1000,
      },
    },
  };
}

/**
 * Constructs a deterministic quarantined JevEvaluationResult when an article is rejected
 * by a pre-Jev `Drop_Keyword_Regex`, `Block_Source_Pattern`, or `Require_Keyword_Regex` filter rule.
 */
export function buildDroppedByFilterJevResult(
  article: JevArticleInput,
  matchedFilterNames: string[]
): JevEvaluationResult {
  const payload = buildJevRequestPayload(article);
  const fallback = evaluateDeterministicFallback(payload);
  fallback.answers.is_systemic_event.noul = 0.08;
  const rawWithFilterMeta = {
    ...fallback,
    dropped_by_filters: matchedFilterNames,
  };
  return {
    isSystemicProb: 0.08,
    jevConfidence: 0.95,
    primaryTool: "common_gavel",
    secondaryTool: "twenty_four_inch_gauge",
    sreFailureMode: "alert_fatigue",
    workingToolProbabilities: fallback.answers.working_tool.probabilities,
    sreFailureModeProbabilities: fallback.answers.sre_failure_mode.probabilities,
    status: "QUARANTINED",
    validationValid: true,
    quarantineReason: `Matched pre-ingestion triage filter(s): ${matchedFilterNames.join(", ")}`,
    rawJson: JSON.stringify(rawWithFilterMeta),
    rawResponse: fallback,
  };
}

/**
 * Calls TypeSafe Jev (`POST https://api.typesafe.ai/v1/systemone`, model `jev-1.14.0`)
 * to evaluate `is_systemic_event`, `working_tool`, and `sre_failure_mode` in parallel,
 * enforcing strict runtime boundary validation on all enum keys and [0.0, 1.0] confidence floats.
 */
export async function evaluateArticleWithJev(
  article: JevArticleInput,
  apiKey?: string,
  options?: JevEvaluationOptions
): Promise<JevEvaluationResult> {
  const payload = buildJevRequestPayload(article);
  const trimmedKey = apiKey?.trim() || "";
  const hasLiveKey =
    trimmedKey.length > 0 && trimmedKey !== "your_typesafe_jev_key_here";

  let rawData: any = null;

  if (options?.rawResponseOverride !== undefined) {
    rawData = options.rawResponseOverride;
  } else if (hasLiveKey) {
    const fetchFn = options?.fetchImpl ?? fetch;
    const timeoutMs = options?.timeoutMs ?? 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(
          `TypeSafe Jev API error (${response.status}): ${errBody || response.statusText}`
        );
      }

      rawData = await response.json();
    } finally {
      clearTimeout(timer);
    }
  } else {
    rawData = evaluateDeterministicFallback(payload);
  }

  const answers = rawData?.answers || rawData?.results || rawData || {};

  // 1. Extract raw is_systemic_event (noul boolean probability) without coercing invalid values
  const sysAnswer = answers.is_systemic_event;
  let rawSystemicProb: unknown = undefined;
  if (typeof sysAnswer === "number") {
    rawSystemicProb = sysAnswer;
  } else if (sysAnswer && typeof sysAnswer === "object") {
    if ("noul" in sysAnswer) rawSystemicProb = sysAnswer.noul;
    else if ("probability" in sysAnswer) rawSystemicProb = sysAnswer.probability;
    else if ("yes" in sysAnswer) rawSystemicProb = sysAnswer.yes;
    else if (sysAnswer.probabilities && "true" in sysAnswer.probabilities) {
      rawSystemicProb = sysAnswer.probabilities.true;
    } else if (sysAnswer.probabilities && "yes" in sysAnswer.probabilities) {
      rawSystemicProb = sysAnswer.probabilities.yes;
    }
  }

  let isSystemicProb: number =
    typeof rawSystemicProb === "number" ? rawSystemicProb : Number.NaN;

  if (
    isFiniteUnitProbability(isSystemicProb) &&
    typeof options?.systemicProbDelta === "number" &&
    Number.isFinite(options.systemicProbDelta) &&
    options.systemicProbDelta !== 0
  ) {
    isSystemicProb = Math.min(
      0.99,
      Math.max(
        0.01,
        Math.round((isSystemicProb + options.systemicProbDelta) * 1000) / 1000
      )
    );
  }

  // 2. Extract working_tool probabilities while preserving any invalid keys or non-finite values for boundary validation
  const rawToolProbsObj =
    answers.working_tool?.probabilities ??
    (typeof answers.working_tool === "object" && !("probabilities" in answers.working_tool)
      ? answers.working_tool
      : null);

  let workingToolProbabilities: Record<JevWorkingToolKey, number> = {
    twenty_four_inch_gauge: Number.NaN,
    common_gavel: Number.NaN,
    plumb: Number.NaN,
    square: Number.NaN,
    level: Number.NaN,
    trowel: Number.NaN,
  };

  let hasInvalidToolEnumOrScore = !rawToolProbsObj || typeof rawToolProbsObj !== "object";
  if (rawToolProbsObj && typeof rawToolProbsObj === "object") {
    for (const [k, v] of Object.entries(rawToolProbsObj)) {
      if (!JEV_TOOL_KEY_SET.has(k)) {
        hasInvalidToolEnumOrScore = true;
        (workingToolProbabilities as Record<string, number>)[k] =
          typeof v === "number" ? v : Number.NaN;
      } else {
        workingToolProbabilities[k as JevWorkingToolKey] =
          typeof v === "number" ? v : Number.NaN;
      }
    }
  }

  if (
    !hasInvalidToolEnumOrScore &&
    options?.forcedPrimaryTool &&
    JEV_TOOL_KEY_SET.has(options.forcedPrimaryTool) &&
    Object.values(workingToolProbabilities).every(isFiniteUnitProbability)
  ) {
    workingToolProbabilities[options.forcedPrimaryTool] = Math.max(
      workingToolProbabilities[options.forcedPrimaryTool] || 0,
      0.65
    );
    workingToolProbabilities = normalizeDistribution(workingToolProbabilities);
  }

  const sortedTools = (
    Object.entries(workingToolProbabilities) as [JevWorkingToolKey, number][]
  ).sort((a, b) => (Number.isFinite(b[1]) ? b[1] : -1) - (Number.isFinite(a[1]) ? a[1] : -1));

  const explicitPrimaryTool = answers.working_tool?.primary_tool ?? answers.primaryTool;
  const primaryTool: JevWorkingToolKey =
    (typeof explicitPrimaryTool === "string"
      ? (explicitPrimaryTool as JevWorkingToolKey)
      : undefined) ||
    options?.forcedPrimaryTool ||
    sortedTools[0]?.[0] ||
    ("invalid_tool" as JevWorkingToolKey);

  const secondaryTool: JevWorkingToolKey =
    sortedTools.find(([k]) => k !== primaryTool)?.[0] ||
    ("invalid_secondary_tool" as JevWorkingToolKey);

  // 3. Extract sre_failure_mode probabilities while preserving invalid keys or non-finite numbers
  const rawSreProbsObj =
    answers.sre_failure_mode?.probabilities ??
    (typeof answers.sre_failure_mode === "object" &&
    !("probabilities" in answers.sre_failure_mode)
      ? answers.sre_failure_mode
      : null);

  const sreFailureModeProbabilities: Record<JevSreFailureModeKey, number> = {
    configuration_drift: Number.NaN,
    cascading_failure: Number.NaN,
    untested_failover: Number.NaN,
    alert_fatigue: Number.NaN,
    blameless_postmortem_gap: Number.NaN,
    capacity_exhaustion: Number.NaN,
  };

  if (rawSreProbsObj && typeof rawSreProbsObj === "object") {
    for (const [k, v] of Object.entries(rawSreProbsObj)) {
      if (!JEV_SRE_KEY_SET.has(k)) {
        (sreFailureModeProbabilities as Record<string, number>)[k] =
          typeof v === "number" ? v : Number.NaN;
      } else {
        sreFailureModeProbabilities[k as JevSreFailureModeKey] =
          typeof v === "number" ? v : Number.NaN;
      }
    }
  }

  const sortedSreModes = (
    Object.entries(sreFailureModeProbabilities) as [
      JevSreFailureModeKey,
      number,
    ][]
  ).sort((a, b) => (Number.isFinite(b[1]) ? b[1] : -1) - (Number.isFinite(a[1]) ? a[1] : -1));

  const explicitFailureMode =
    answers.sre_failure_mode?.failure_mode ?? answers.sreFailureMode;
  const sreFailureMode: JevSreFailureModeKey =
    (typeof explicitFailureMode === "string"
      ? (explicitFailureMode as JevSreFailureModeKey)
      : undefined) ||
    sortedSreModes[0]?.[0] ||
    ("invalid_failure_mode" as JevSreFailureModeKey);

  const rawConfidence = answers.working_tool?.confidence;
  const jevConfidence: number =
    rawConfidence !== undefined
      ? typeof rawConfidence === "number"
        ? rawConfidence
        : Number.NaN
      : isFiniteUnitProbability(sortedTools[0]?.[1])
        ? sortedTools[0][1]
        : isSystemicProb;

  const minSystemicProb = options?.minSystemicProb ?? 0.7;
  const minConfidence = options?.minConfidence ?? 0.5;

  const candidateResult = {
    isSystemicProb,
    jevConfidence,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    workingToolProbabilities,
    sreFailureModeProbabilities,
  };

  const validation = validateJevEvaluationOutput(candidateResult, {
    minSystemicProb,
    minConfidence,
  });

  const safeSystemicProb = isFiniteUnitProbability(isSystemicProb)
    ? isSystemicProb
    : 0;
  const safeConfidence = isFiniteUnitProbability(jevConfidence)
    ? jevConfidence
    : 0;

  const enrichedRaw = {
    ...(rawData && typeof rawData === "object" ? rawData : { raw: rawData }),
    ...(options?.appliedFilterNames && options.appliedFilterNames.length > 0
      ? {
          applied_filters: options.appliedFilterNames,
          adjusted_is_systemic_prob: safeSystemicProb,
        }
      : {}),
    boundary_validation: {
      valid: validation.valid,
      quarantined: validation.quarantined,
      status: validation.status,
      reason: validation.reason ?? null,
    },
  };

  return {
    isSystemicProb: safeSystemicProb,
    jevConfidence: safeConfidence,
    primaryTool: JEV_TOOL_KEY_SET.has(primaryTool) ? primaryTool : "square",
    secondaryTool:
      JEV_TOOL_KEY_SET.has(secondaryTool) && secondaryTool !== primaryTool
        ? secondaryTool
        : "twenty_four_inch_gauge",
    sreFailureMode: JEV_SRE_KEY_SET.has(sreFailureMode)
      ? sreFailureMode
      : "configuration_drift",
    workingToolProbabilities,
    sreFailureModeProbabilities,
    status: validation.status,
    validationValid: validation.valid,
    quarantineReason: validation.reason,
    rawJson: JSON.stringify(enrichedRaw),
    rawResponse: rawData,
  };
}

