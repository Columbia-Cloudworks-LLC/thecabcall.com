import {
  DomainSectorId,
  SreFailureModeId,
  WorkingToolId,
} from "./taxonomy";

export type ToolProbabilityDistribution = Record<WorkingToolId, number>;

export interface ProportionalityCheck {
  noiseOverblown: string;
  structuralSignal: string;
}

export interface IncidentArticle {
  id: string;
  incidentCode: string; // e.g. #CAB-2026-1042
  slug: string;
  urlHash: string;
  sourceFeed: string; // e.g. "REUTERS", "ARS TECHNICA", "AP NEWS", "HACKER NEWS", "FEDERAL REGISTER"
  title: string;
  sourceUrl: string;
  publishedAt: string;
  ingestedAt: string;
  domainSector: DomainSectorId;
  jevConfidence: number; // e.g. 0.88
  primaryTool: WorkingToolId;
  secondaryTool: WorkingToolId;
  sreFailureMode: SreFailureModeId;
  toolProbabilities: ToolProbabilityDistribution;
  executiveSummary: string; // 2-sentence neutral executive summary for Triage-First cards
  socraticBrief: string; // Full multi-paragraph objective summary of the facts
  diagnosticApplication: string; // Breakdown of why the primary Working Tool and SRE lens triggered
  proportionalityCheck: ProportionalityCheck;
  questions: string[]; // 3 to 4 structured Socratic questions
  classifierLatencyMs: number;
}

export interface EpisodeIncidentMarker {
  incidentId: string;
  incidentCode: string;
  incidentSlug: string;
  incidentTitle: string;
  timestampSeconds: number;
  timecodeLabel: string; // e.g. "01:28"
  toolApplied: WorkingToolId;
}

export interface EpisodeTranscriptSections {
  weeklyTelemetry: string; // 0:00 - 1:15 (~180 words)
  separatingSignalFromPanic: string; // 1:15 - 3:30 (~350 words)
  forwardPosture: string; // 3:30 - 5:00 (~220 words)
}

export interface PodcastEpisode {
  id: string;
  slug: string;
  episodeNumber: number;
  series: "weekly_rollup" | "legacy_archive";
  title: string;
  summary: string;
  transcript: string;
  transcriptSections?: EpisodeTranscriptSections;
  audioUrl: string;
  durationSeconds: number;
  durationFormatted: string;
  fileSizeBytes: number;
  publishedAt: string;
  dominantTool: WorkingToolId;
  dominantToolPercentage?: number;
  dominantFailureMode: SreFailureModeId;
  incidentMarkers: EpisodeIncidentMarker[];
}

export interface PipelineRunRecord {
  id: string;
  runType: "rss_ingest" | "weekly_rollup";
  startedAt: string;
  completedAt: string;
  itemsEvaluated: number;
  itemsAccepted: number;
  itemsRejectedNoise: number;
  avgClassifierLatencyMs: number;
  status: "nominal" | "degraded" | "critical";
  notes: string;
}

export interface SystemPostureSummary {
  windowDays: number;
  totalIncidentsWindow: number;
  totalEvaluatedWindow: number;
  noiseRejectionRate: number;
  dominantTool: WorkingToolId;
  dominantToolPercentage: number;
  toolDistribution: { tool: WorkingToolId; count: number; percentage: number }[];
  topFailureMode: SreFailureModeId;
  topFailureModeCount: number;
  avgClassifierLatencyMs: number;
  avgSignalConfidence: number;
}
