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

export type IncidentImageSourceType =
  | "rss"
  | "og"
  | "og_scraped"
  | "wikimedia_commons"
  | "upload"
  | "svg_card"
  | "none"
  | "rss_extracted"
  | "r2_upload"
  | "external_url"
  | "generated_card"
  | null;

export interface IncidentArticle {
  id: string;
  incidentCode: string; // e.g. #CAB-2026-1042
  slug: string;
  urlHash: string;
  sourceFeed: string; // e.g. "REUTERS", "ARS TECHNICA", "AP NEWS", "HACKER NEWS", "FEDERAL REGISTER"
  title: string;
  originalTitle?: string;
  titleRewritten?: boolean;
  titleRewriteReason?: string;
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
  questions: string[]; // 2 high-impact structured Socratic questions in sentence case
  classifierLatencyMs: number;
  isLeadPostMortem?: boolean; // Only render full-width Lead Post-Mortem card when explicitly flagged
  leadPostMortemAnalysis?: string; // Bespoke multi-paragraph analysis required for Lead Post-Mortem slot
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  imageSourceType?: IncidentImageSourceType;
  editorialNotes?: string;
  isPinned?: boolean;
  isHidden?: boolean;
}

export interface WeeklyDocketItem {
  readonly id: string;
  readonly incidentCode: string;
  readonly slug: string;
  readonly title: string;
  readonly sourceFeed: string;
  readonly primaryTool: WorkingToolId;
  readonly sreFailureMode: SreFailureModeId;
}

export interface WeeklyTrestleboardState {
  readonly episodeNumber: number;
  readonly episodeSlug: string;
  readonly publishedAt: string;
  readonly durationFormatted: string;
  readonly audioUrl: string;
  readonly dominantTool: WorkingToolId;
  readonly dominantToolPercentage: number;
  readonly primaryFailureMode: SreFailureModeId;
  readonly activeIncidentCount: number;
  readonly anchorIncidents: readonly WeeklyDocketItem[];
  readonly heroTitle: string;
  readonly heroOpeningProse: string;
  readonly podcastDescription: string;
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

export interface EpisodeExternalSource {
  title: string;
  url?: string;
  author?: string;
  publicationDate?: string;
  sourceType?: string;
}

export interface EpisodeSourcePage {
  title: string;
  href: string;
  code?: string;
  tool?: WorkingToolId;
  sectionLabel?: string;
}

export interface PodcastEpisode {
  id: string;
  slug: string;
  episodeNumber: number;
  series: "weekly_rollup" | "legacy_archive";
  title: string;
  summary: string;
  extendedNotes?: string;
  transcript: string;
  transcriptSections?: EpisodeTranscriptSections;
  audioUrl: string;
  artworkUrl?: string;
  artworkWidescreenUrl?: string;
  aiDisclaimer?: string;
  durationSeconds: number;
  durationFormatted: string;
  fileSizeBytes: number;
  publishedAt: string;
  dominantTool: WorkingToolId;
  dominantToolPercentage?: number;
  dominantFailureMode: SreFailureModeId;
  incidentMarkers: EpisodeIncidentMarker[];
  externalSources?: EpisodeExternalSource[];
  sourcePages?: EpisodeSourcePage[];
}

export interface PipelineRunRecord {
  id: string;
  runType: "rss_ingest" | "system2_synthesize" | "weekly_rollup";
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
