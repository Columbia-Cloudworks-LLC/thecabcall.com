import {
  ensureD1Snapshot,
  getPipelineRuns as getD1PipelineRuns,
  readLocalD1Snapshot,
} from "./d1-bridge";

export { ensureD1Snapshot };
import {
  isRenderablePublicEpisode,
  isRenderablePublicIncident,
} from "./dto";
import {
  buildOrSanitizeArticleDiagnostics,
  validateAndNormalizeIncidentSummary,
} from "./sanitize";
import {
  INITIAL_EPISODES,
  INITIAL_INCIDENTS,
  INITIAL_PIPELINE_RUNS,
} from "./seed-data";
import {
  SreFailureModeId,
  WORKING_TOOLS,
  WorkingToolId,
} from "./taxonomy";
import {
  IncidentArticle,
  PipelineRunRecord,
  PodcastEpisode,
  SystemPostureSummary,
  WeeklyDocketItem,
  WeeklyTrestleboardState,
} from "./types";

// Runtime state seeded with initial telemetry and extensible by live Cron / Manual pipeline triggers
const state: {
  incidents: IncidentArticle[];
  episodes: PodcastEpisode[];
  pipelineRuns: PipelineRunRecord[];
} = {
  incidents: [...INITIAL_INCIDENTS],
  episodes: [...INITIAL_EPISODES],
  pipelineRuns: [...INITIAL_PIPELINE_RUNS],
};

function normalizeAndValidateIncidentRecord(
  inc: IncidentArticle
): IncidentArticle | null {
  const validation = validateAndNormalizeIncidentSummary({
    id: inc.id,
    title: inc.title,
    sourceFeed: inc.sourceFeed,
    rawExcerpt: inc.socraticBrief || inc.executiveSummary,
    executiveSummary: inc.executiveSummary,
    socraticBrief: inc.socraticBrief,
  });

  if (!validation.valid) {
    return null;
  }

  const diagnostics = buildOrSanitizeArticleDiagnostics({
    title: inc.title,
    sourceFeed: inc.sourceFeed,
    factualSummary: validation.factualBriefParagraph,
    primaryTool: inc.primaryTool,
    secondaryTool: inc.secondaryTool,
    sreFailureMode: inc.sreFailureMode,
    existingNoise: inc.proportionalityCheck?.noiseOverblown,
    existingSignal: inc.proportionalityCheck?.structuralSignal,
    existingQuestions: inc.questions,
  });

  if (!diagnostics.valid || diagnostics.questions.length < 2) {
    return null;
  }

  const candidate: IncidentArticle = {
    ...inc,
    executiveSummary: validation.executiveSummary,
    socraticBrief: validation.factualBriefParagraph,
    proportionalityCheck: {
      noiseOverblown: diagnostics.noiseOverblown,
      structuralSignal: diagnostics.structuralSignal,
    },
    questions: [diagnostics.questions[0], diagnostics.questions[1]],
  };

  if (!isRenderablePublicIncident(candidate)) {
    return null;
  }

  return candidate;
}

export function getAllIncidents(): IncidentArticle[] {
  const d1 = readLocalD1Snapshot();
  const seenHashes = new Set<string>();
  const merged: IncidentArticle[] = [];

  for (const inc of d1.incidents) {
    if (!seenHashes.has(inc.urlHash)) {
      const normalized = normalizeAndValidateIncidentRecord(inc);
      if (normalized) {
        seenHashes.add(inc.urlHash);
        merged.push(normalized);
      }
    }
  }

  for (const inc of state.incidents) {
    if (!seenHashes.has(inc.urlHash)) {
      const normalized = normalizeAndValidateIncidentRecord(inc);
      if (normalized) {
        seenHashes.add(inc.urlHash);
        merged.push(normalized);
      }
    }
  }

  // Keep live D1 synthesized incidents prioritized ahead of static seed archive,
  // or sorted by publishedAt within each tier
  if (d1.incidents.length > 0) {
    return merged;
  }

  return merged.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getIncidentBySlug(slug: string): IncidentArticle | undefined {
  return getAllIncidents().find((inc) => inc.slug === slug);
}

export function getIncidentById(id: string): IncidentArticle | undefined {
  return getAllIncidents().find((inc) => inc.id === id);
}

export function hasUrlHash(urlHash: string): boolean {
  return getAllIncidents().some((inc) => inc.urlHash === urlHash);
}

export function insertIncident(incident: IncidentArticle): void {
  const normalized = normalizeAndValidateIncidentRecord(incident);
  if (!normalized) {
    return;
  }
  if (!state.incidents.some((inc) => inc.urlHash === normalized.urlHash)) {
    state.incidents.unshift(normalized);
  }
}

export function getAllEpisodes(): PodcastEpisode[] {
  const d1 = readLocalD1Snapshot();
  if (d1.available) {
    return [...d1.episodes]
      .filter((ep) => isRenderablePublicEpisode(ep))
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
  }

  const seenSlugs = new Set<string>();
  const merged: PodcastEpisode[] = [];

  for (const ep of d1.episodes) {
    if (!seenSlugs.has(ep.slug) && isRenderablePublicEpisode(ep)) {
      seenSlugs.add(ep.slug);
      merged.push(ep);
    }
  }

  for (const ep of state.episodes) {
    if (!seenSlugs.has(ep.slug) && isRenderablePublicEpisode(ep)) {
      seenSlugs.add(ep.slug);
      merged.push(ep);
    }
  }

  return merged.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getLatestWeeklyRollup(): PodcastEpisode {
  const d1 = readLocalD1Snapshot();
  if (d1.episodes.length > 0) {
    return d1.episodes[0];
  }
  const rollups = getAllEpisodes().filter((e) => e.series === "weekly_rollup");
  return rollups[0] || state.episodes[0];
}

export function insertEpisode(episode: PodcastEpisode): void {
  const existingIdx = state.episodes.findIndex((e) => e.slug === episode.slug);
  if (existingIdx >= 0) {
    state.episodes[existingIdx] = episode;
  } else {
    state.episodes.unshift(episode);
  }
}

export function getPipelineRuns(): PipelineRunRecord[] {
  const d1Runs = getD1PipelineRuns();
  const seenIds = new Set<string>();
  const merged: PipelineRunRecord[] = [];

  for (const r of d1Runs) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      merged.push(r);
    }
  }

  for (const r of state.pipelineRuns) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      merged.push(r);
    }
  }

  return merged.sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export function recordPipelineRun(run: PipelineRunRecord): void {
  state.pipelineRuns.unshift(run);
}

export function getSystemPostureSummary(): SystemPostureSummary {
  const d1 = readLocalD1Snapshot();
  const activeIncidents = getAllIncidents();
  const runs = getPipelineRuns().filter((r) => r.runType === "rss_ingest");

  const totalEvaluatedWindow =
    d1.totalEvaluated > 0
      ? d1.totalEvaluated
      : runs.reduce((acc, r) => acc + r.itemsEvaluated, 0);
  const totalRejectedWindow =
    d1.totalEvaluated > 0
      ? d1.droppedCount
      : runs.reduce((acc, r) => acc + r.itemsRejectedNoise, 0);

  const noiseRejectionRate =
    totalEvaluatedWindow > 0
      ? Math.round((totalRejectedWindow / totalEvaluatedWindow) * 1000) / 10
      : 90.8;

  const toolCounts: Record<WorkingToolId, number> = {
    "24-Inch Gauge": 0,
    "Common Gavel": 0,
    "The Plumb": 0,
    "The Square": 0,
    "The Level": 0,
    "The Trowel": 0,
  };

  const failureCounts: Record<string, number> = {};
  let totalLatency = 0;
  let totalConfidence = 0;

  for (const inc of activeIncidents) {
    toolCounts[inc.primaryTool] = (toolCounts[inc.primaryTool] || 0) + 1;
    failureCounts[inc.sreFailureMode] =
      (failureCounts[inc.sreFailureMode] || 0) + 1;
    totalLatency += inc.classifierLatencyMs;
    totalConfidence += inc.jevConfidence;
  }

  const totalIncidents = activeIncidents.length || 1;
  const toolDistribution = WORKING_TOOLS.map((t) => ({
    tool: t.id,
    count: toolCounts[t.id] || 0,
    percentage: Math.round(((toolCounts[t.id] || 0) / totalIncidents) * 100),
  })).sort((a, b) => b.count - a.count);

  const dominantTool = toolDistribution[0]?.tool || "The Square";
  const dominantToolPercentage = toolDistribution[0]?.percentage || 44;

  const sortedFailures = Object.entries(failureCounts).sort(
    (a, b) => b[1] - a[1]
  );
  const topFailureMode =
    (sortedFailures[0]?.[0] as SreFailureModeId) || "Configuration Drift";
  const topFailureModeCount = sortedFailures[0]?.[1] || 1;

  return {
    windowDays: 7,
    totalIncidentsWindow: activeIncidents.length,
    totalEvaluatedWindow: Math.max(totalEvaluatedWindow, activeIncidents.length),
    noiseRejectionRate,
    dominantTool,
    dominantToolPercentage,
    toolDistribution,
    topFailureMode,
    topFailureModeCount,
    avgClassifierLatencyMs: Math.round(totalLatency / totalIncidents),
    avgSignalConfidence:
      Math.round((totalConfidence / totalIncidents) * 100) / 100,
  };
}

/**
 * Constructs a single deeply-frozen immutable state object synchronizing the Weekly Brief Hero's
 * top status badge, opening editorial prose, podcast card metadata, and 3-item Weekly Docket.
 */
export function buildWeeklyTrestleboardState(
  incidents: IncidentArticle[],
  posture: SystemPostureSummary,
  pinnedEpisode: PodcastEpisode
): WeeklyTrestleboardState {
  const dominantTool = posture.dominantTool;
  const dominantToolPercentage = posture.dominantToolPercentage;
  const primaryFailureMode = posture.topFailureMode;
  const activeIncidentCount = incidents.length;

  const anchorIncidents: readonly WeeklyDocketItem[] = Object.freeze(
    incidents.slice(0, 3).map((inc) =>
      Object.freeze({
        id: inc.id,
        incidentCode: inc.incidentCode,
        slug: inc.slug,
        title: inc.title,
        sourceFeed: inc.sourceFeed,
        primaryTool: inc.primaryTool,
        sreFailureMode: inc.sreFailureMode,
      })
    )
  );

  const [inc1, inc2, inc3] = anchorIncidents;
  const anchor1Clause = inc1
    ? `"${inc1.title}" (${inc1.sourceFeed})`
    : "infrastructure compliance drift";
  const anchor2Clause = inc2
    ? `"${inc2.title}" (${inc2.sourceFeed})`
    : "cross-boundary coordination strain";
  const anchor3Clause = inc3
    ? `"${inc3.title}" (${inc3.sourceFeed})`
    : "deferred institutional capacity";

  const episodeNumber = pinnedEpisode.episodeNumber || 43;

  const heroTitle = `CAB Weekly Brief #${episodeNumber}: ${dominantTool} (${dominantToolPercentage}%), ${primaryFailureMode}, and This Week's Trestleboard`;

  const heroOpeningProse = `${dominantTool} leads this week's Trestleboard at ${dominantToolPercentage}% of active classifications, with ${primaryFailureMode} emerging as the primary operational failure mode across ${activeIncidentCount} verified incidents. Three anchor dispatches set the post-incident docket: ${anchor1Clause}; ${anchor2Clause}; and ${anchor3Clause}. Across all three events, the structural signal separates reactive commentary from the underlying gap between formal institutional rules and live operational state.`;

  const podcastDescription = `Five-minute Friday synthesis anchored by ${dominantTool} (${dominantToolPercentage}%) and ${primaryFailureMode} across ${activeIncidentCount} active dispatches on the Trestleboard.`;

  return Object.freeze({
    episodeNumber,
    episodeSlug: pinnedEpisode.slug,
    publishedAt: pinnedEpisode.publishedAt,
    durationFormatted: pinnedEpisode.durationFormatted,
    audioUrl: pinnedEpisode.audioUrl,
    dominantTool,
    dominantToolPercentage,
    primaryFailureMode,
    activeIncidentCount,
    anchorIncidents,
    heroTitle,
    heroOpeningProse,
    podcastDescription,
  });
}

export function getWeeklyTrestleboardState(): WeeklyTrestleboardState {
  const incidents = getAllIncidents();
  const posture = getSystemPostureSummary();
  const pinnedEpisode = getLatestWeeklyRollup();
  return buildWeeklyTrestleboardState(incidents, posture, pinnedEpisode);
}

