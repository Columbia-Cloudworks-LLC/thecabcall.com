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

export interface JevEvaluationResult {
  isSystemicProb: number;
  jevConfidence: number;
  primaryTool: JevWorkingToolKey;
  secondaryTool: JevWorkingToolKey;
  sreFailureMode: JevSreFailureModeKey;
  workingToolProbabilities: Record<JevWorkingToolKey, number>;
  sreFailureModeProbabilities: Record<JevSreFailureModeKey, number>;
  status: "triaged" | "dropped";
  rawJson: string;
  rawResponse: JevSystemOneResponse;
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
 * Calls TypeSafe Jev (`POST https://api.typesafe.ai/v1/systemone`, model `jev-1.14.0`)
 * to evaluate `is_systemic_event`, `working_tool`, and `sre_failure_mode` in parallel.
 */
export async function evaluateArticleWithJev(
  article: JevArticleInput,
  apiKey?: string
): Promise<JevEvaluationResult> {
  const payload = buildJevRequestPayload(article);
  const trimmedKey = apiKey?.trim() || "";
  const hasLiveKey =
    trimmedKey.length > 0 && trimmedKey !== "your_typesafe_jev_key_here";

  let rawData: any = null;

  if (hasLiveKey) {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(
        `TypeSafe Jev API error (${response.status}): ${errBody || response.statusText}`
      );
    }

    rawData = await response.json();
  } else {
    rawData = evaluateDeterministicFallback(payload);
  }

  const answers = rawData?.answers || rawData?.results || rawData || {};

  // 1. Parse is_systemic_event (noul boolean probability)
  const sysAnswer = answers.is_systemic_event;
  let isSystemicProb = 0;
  if (typeof sysAnswer === "number") {
    isSystemicProb = sysAnswer;
  } else if (sysAnswer && typeof sysAnswer === "object") {
    isSystemicProb =
      typeof sysAnswer.noul === "number"
        ? sysAnswer.noul
        : typeof sysAnswer.probability === "number"
          ? sysAnswer.probability
          : typeof sysAnswer.yes === "number"
            ? sysAnswer.yes
            : typeof sysAnswer.probabilities?.true === "number"
              ? sysAnswer.probabilities.true
              : typeof sysAnswer.probabilities?.yes === "number"
                ? sysAnswer.probabilities.yes
                : 0;
  }

  // 2. Parse working_tool probabilities
  const defaultToolProbs: Record<JevWorkingToolKey, number> = {
    twenty_four_inch_gauge: 0,
    common_gavel: 0,
    plumb: 0,
    square: 0,
    level: 0,
    trowel: 0,
  };
  const rawToolProbs =
    answers.working_tool?.probabilities || answers.working_tool || {};
  const workingToolProbabilities: Record<JevWorkingToolKey, number> = {
    ...defaultToolProbs,
  };
  for (const key of Object.keys(defaultToolProbs) as JevWorkingToolKey[]) {
    if (typeof rawToolProbs[key] === "number") {
      workingToolProbabilities[key] = rawToolProbs[key];
    }
  }

  const sortedTools = (
    Object.entries(workingToolProbabilities) as [JevWorkingToolKey, number][]
  ).sort((a, b) => b[1] - a[1]);

  const primaryTool: JevWorkingToolKey = sortedTools[0]?.[0] || "square";
  const secondaryTool: JevWorkingToolKey =
    sortedTools[1]?.[0] || "twenty_four_inch_gauge";

  // 3. Parse sre_failure_mode probabilities
  const defaultSreProbs: Record<JevSreFailureModeKey, number> = {
    configuration_drift: 0,
    cascading_failure: 0,
    untested_failover: 0,
    alert_fatigue: 0,
    blameless_postmortem_gap: 0,
    capacity_exhaustion: 0,
  };
  const rawSreProbs =
    answers.sre_failure_mode?.probabilities || answers.sre_failure_mode || {};
  const sreFailureModeProbabilities: Record<JevSreFailureModeKey, number> = {
    ...defaultSreProbs,
  };
  for (const key of Object.keys(defaultSreProbs) as JevSreFailureModeKey[]) {
    if (typeof rawSreProbs[key] === "number") {
      sreFailureModeProbabilities[key] = rawSreProbs[key];
    }
  }

  const sortedSreModes = (
    Object.entries(sreFailureModeProbabilities) as [
      JevSreFailureModeKey,
      number,
    ][]
  ).sort((a, b) => b[1] - a[1]);

  const sreFailureMode: JevSreFailureModeKey =
    sortedSreModes[0]?.[0] || "configuration_drift";

  const jevConfidence =
    typeof answers.working_tool?.confidence === "number"
      ? answers.working_tool.confidence
      : sortedTools[0]?.[1] || isSystemicProb;

  const status: "triaged" | "dropped" =
    isSystemicProb >= 0.7 ? "triaged" : "dropped";

  return {
    isSystemicProb,
    jevConfidence,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    workingToolProbabilities,
    sreFailureModeProbabilities,
    status,
    rawJson: JSON.stringify(rawData),
    rawResponse: rawData,
  };
}
