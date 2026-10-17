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

export function getAllIncidents(): IncidentArticle[] {
  return [...state.incidents].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getIncidentBySlug(slug: string): IncidentArticle | undefined {
  return state.incidents.find((inc) => inc.slug === slug);
}

export function getIncidentById(id: string): IncidentArticle | undefined {
  return state.incidents.find((inc) => inc.id === id);
}

export function hasUrlHash(urlHash: string): boolean {
  return state.incidents.some((inc) => inc.urlHash === urlHash);
}

export function insertIncident(incident: IncidentArticle): void {
  if (!hasUrlHash(incident.urlHash)) {
    state.incidents.unshift(incident);
  }
}

export function getAllEpisodes(): PodcastEpisode[] {
  return [...state.episodes].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getLatestWeeklyRollup(): PodcastEpisode {
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
  return [...state.pipelineRuns].sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export function recordPipelineRun(run: PipelineRunRecord): void {
  state.pipelineRuns.unshift(run);
}

export function getSystemPostureSummary(): SystemPostureSummary {
  const incidents = getAllIncidents();
  const runs = getPipelineRuns().filter((r) => r.runType === "rss_ingest");

  const totalEvaluatedWindow = runs.reduce((acc, r) => acc + r.itemsEvaluated, 0);
  const totalRejectedWindow = runs.reduce(
    (acc, r) => acc + r.itemsRejectedNoise,
    0
  );
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

  for (const inc of incidents) {
    toolCounts[inc.primaryTool] = (toolCounts[inc.primaryTool] || 0) + 1;
    failureCounts[inc.sreFailureMode] =
      (failureCounts[inc.sreFailureMode] || 0) + 1;
    totalLatency += inc.classifierLatencyMs;
    totalConfidence += inc.jevConfidence;
  }

  const totalIncidents = incidents.length || 1;
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
    totalIncidentsWindow: incidents.length,
    totalEvaluatedWindow: Math.max(totalEvaluatedWindow, incidents.length * 6),
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
