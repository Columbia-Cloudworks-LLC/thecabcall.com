import fs from "node:fs";
import path from "node:path";
import {
  isRenderablePublicEpisode,
  isRenderablePublicIncident,
  PublicEpisodeDto,
  PublicIncidentDto,
} from "./dto";
import {
  buildOrSanitizeArticleDiagnostics,
  sanitizeStringConcatenation,
  SummaryValidationResult,
  validateAndNormalizeIncidentSummary,
} from "./sanitize";
import {
  DomainSectorId,
  mapFailureModeToCraftLexicon,
  mapWorkingToolToCraftLexicon,
  SreFailureModeId,
  WorkingToolId,
} from "./taxonomy";
import {
  EpisodeIncidentMarker,
  EpisodeTranscriptSections,
  IncidentArticle,
  PipelineRunRecord,
  PodcastEpisode,
  ToolProbabilityDistribution,
} from "./types";
import {
  D1DatabaseLike,
  D1PreparedStatementLike,
  runD1IngestPipeline,
} from "@/pipeline/ingest";
import { JevSreFailureModeKey, JevWorkingToolKey } from "@/pipeline/jev";
import {
  EpisodePublishStatus,
  R2BucketLike,
  R2ObjectLike,
  R2ObjectMetaLike,
} from "@/pipeline/rollup";
import {
  runSynthesizePipeline,
  TelemetryArticleRow,
} from "@/pipeline/synthesize";

export const JEV_TO_FRONTEND_TOOL: Record<JevWorkingToolKey, WorkingToolId> = {
  twenty_four_inch_gauge: "24-Inch Gauge",
  common_gavel: "Common Gavel",
  plumb: "The Plumb",
  square: "The Square",
  level: "The Level",
  trowel: "The Trowel",
};

export const JEV_TO_FRONTEND_FAILURE_MODE: Record<
  JevSreFailureModeKey,
  SreFailureModeId
> = {
  configuration_drift: "Configuration Drift",
  cascading_failure: "Cascading Failure",
  untested_failover: "Single Point of Failure (SPOF) / Untested Failover",
  alert_fatigue: "Alert Fatigue & Signal Loss",
  blameless_postmortem_gap: "Blame Culture vs. Root-Cause Isolation",
  capacity_exhaustion: "Technical & Institutional Debt",
};

export function mapJevToolToWorkingToolId(rawTool?: string | null): WorkingToolId {
  return mapWorkingToolToCraftLexicon(rawTool);
}

export function mapJevFailureToSreFailureModeId(
  rawFailure?: string | null
): SreFailureModeId {
  return mapFailureModeToCraftLexicon(rawFailure);
}

export function inferDomainSector(
  sourceFeed: string,
  title: string,
  excerpt: string
): DomainSectorId {
  const feedLower = sourceFeed.toLowerCase();
  const text = `${title} ${excerpt}`.toLowerCase();

  if (feedLower.includes("wsj") || /(bank|loan|market|supplier|billion|million|insolvency|economy|tariff|fund)/.test(text)) {
    return "Economics & Markets";
  }
  if (feedLower.includes("ars technica") || /(cyber|software|cloud|ai|chip|protocol|network|encryption|security)/.test(text)) {
    return "Technology & Cyber";
  }
  if (/(mail|postal|grid|rail|aviation|faa|water|port|supply chain|shutdown|warehouse)/.test(text)) {
    return "Infrastructure & Supply Chain";
  }
  if (/(ceo|board|press secretary|ousted|dei|executive|leadership|resign)/.test(text)) {
    return "Institutional Leadership";
  }
  return "Public Policy & Governance";
}

export function makeIncidentSlug(title: string, id: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `${base || "incident"}-d1-${id}`;
}

export function extractStoredQuestionsPayload(questionsJson: string | null): {
  executiveSummary: string | null;
  noiseOverblown: string | null;
  structuralSignal: string | null;
  questions: string[];
  isLeadPostMortem: boolean;
  leadPostMortemAnalysis: string | null;
} {
  if (!questionsJson) {
    return {
      executiveSummary: null,
      noiseOverblown: null,
      structuralSignal: null,
      questions: [],
      isLeadPostMortem: false,
      leadPostMortemAnalysis: null,
    };
  }

  try {
    const parsedQ = JSON.parse(questionsJson);
    if (Array.isArray(parsedQ)) {
      return {
        executiveSummary: null,
        noiseOverblown: null,
        structuralSignal: null,
        questions: parsedQ.map((q) => String(q)),
        isLeadPostMortem: false,
        leadPostMortemAnalysis: null,
      };
    }
    if (parsedQ && typeof parsedQ === "object") {
      return {
        executiveSummary:
          typeof parsedQ.executive_summary === "string" &&
          parsedQ.executive_summary.trim()
            ? parsedQ.executive_summary.trim()
            : null,
        noiseOverblown:
          parsedQ.proportionality_check &&
          typeof parsedQ.proportionality_check.noise_overblown === "string"
            ? parsedQ.proportionality_check.noise_overblown.trim()
            : null,
        structuralSignal:
          parsedQ.proportionality_check &&
          typeof parsedQ.proportionality_check.structural_signal === "string"
            ? parsedQ.proportionality_check.structural_signal.trim()
            : null,
        questions: Array.isArray(parsedQ.questions)
          ? parsedQ.questions.map((q: unknown) => String(q))
          : [],
        isLeadPostMortem: Boolean(parsedQ.is_lead_post_mortem),
        leadPostMortemAnalysis:
          typeof parsedQ.lead_post_mortem_analysis === "string" &&
          parsedQ.lead_post_mortem_analysis.trim()
            ? parsedQ.lead_post_mortem_analysis.trim()
            : null,
      };
    }
  } catch {
    // Ignore malformed questions_json
  }

  return {
    executiveSummary: null,
    noiseOverblown: null,
    structuralSignal: null,
    questions: [],
    isLeadPostMortem: false,
    leadPostMortemAnalysis: null,
  };
}

export function mapD1RowToIncidentArticle(
  row: TelemetryArticleRow,
  prevalidated?: SummaryValidationResult
): IncidentArticle | null {
  const primaryTool = mapJevToolToWorkingToolId(row.primary_tool);
  const secondaryTool = mapJevToolToWorkingToolId(
    row.secondary_tool || "twenty_four_inch_gauge"
  );
  const sreFailureMode = mapJevFailureToSreFailureModeId(row.sre_failure_mode);
  const domainSector = inferDomainSector(
    row.source_feed,
    row.title,
    row.raw_excerpt
  );

  // Extract 6-tool probability distribution from jev_raw_json
  const defaultProbs: ToolProbabilityDistribution = {
    "24-Inch Gauge": 0.12,
    "Common Gavel": 0.12,
    "The Plumb": 0.12,
    "The Square": 0.12,
    "The Level": 0.12,
    "The Trowel": 0.12,
  };
  defaultProbs[primaryTool] = 0.44;
  defaultProbs[secondaryTool] = 0.24;

  try {
    const parsedJev = JSON.parse(row.jev_raw_json || "{}");
    const rawProbs =
      parsedJev?.answers?.working_tool?.probabilities ||
      parsedJev?.working_tool?.probabilities;
    if (rawProbs && typeof rawProbs === "object") {
      (Object.keys(JEV_TO_FRONTEND_TOOL) as JevWorkingToolKey[]).forEach(
        (jevKey) => {
          const frontendKey = JEV_TO_FRONTEND_TOOL[jevKey];
          if (typeof rawProbs[jevKey] === "number" && Number.isFinite(rawProbs[jevKey])) {
            defaultProbs[frontendKey] =
              Math.round(rawProbs[jevKey] * 100) / 100;
          }
        }
      );
    }
  } catch {
    // Use default fallback probabilities
  }

  const storedPayload = extractStoredQuestionsPayload(row.questions_json);

  const validation =
    prevalidated ||
    validateAndNormalizeIncidentSummary({
      id: row.id,
      title: row.title,
      sourceFeed: row.source_feed,
      rawExcerpt: row.raw_excerpt,
      executiveSummary: storedPayload.executiveSummary,
      socraticBrief: row.socratic_brief,
      logWarnings: false,
    });

  if (!validation.valid) {
    return null;
  }

  const executiveSummary =
    validation.executiveSummary ||
    sanitizeStringConcatenation(validation.cleanedDescription);
  const socraticBrief =
    validation.factualBriefParagraph ||
    sanitizeStringConcatenation(validation.cleanedDescription);

  const diagnostics = buildOrSanitizeArticleDiagnostics({
    title: row.title,
    sourceFeed: row.source_feed,
    factualSummary: socraticBrief,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    existingNoise: storedPayload.noiseOverblown,
    existingSignal: storedPayload.structuralSignal,
    existingQuestions: storedPayload.questions,
  });

  if (!diagnostics.valid || diagnostics.questions.length < 2) {
    return null;
  }

  const incidentNumber = 2000 + row.id;

  const hasImageUrl =
    typeof row.image_url === "string" && row.image_url.trim().length > 0;
  const effectiveImageUrl = hasImageUrl
    ? row.image_url!.trim()
    : `/media/card-d1-${row.id}.svg`;
  const effectiveImageSourceType: IncidentArticle["imageSourceType"] =
    hasImageUrl
      ? (row.image_source_type as IncidentArticle["imageSourceType"]) || "rss"
      : "svg_card";
  const effectiveImageAlt =
    typeof row.image_alt === "string" && row.image_alt.trim().length > 0
      ? row.image_alt.trim()
      : `${primaryTool} · ${sreFailureMode} telemetry blueprint for ${row.title}`;
  const effectiveImageCaption =
    typeof row.image_caption === "string" && row.image_caption.trim().length > 0
      ? row.image_caption.trim()
      : `Blueprint Card · ${primaryTool} / ${sreFailureMode}`;

  const candidate: IncidentArticle = {
    id: `d1-inc-${row.id}`,
    incidentCode: `#CAB-2026-${incidentNumber}`,
    slug: makeIncidentSlug(row.title, row.id),
    urlHash: row.url_hash,
    sourceFeed: row.source_feed.toUpperCase(),
    title: row.title,
    originalTitle:
      typeof row.original_title === "string" && row.original_title.trim().length > 0
        ? row.original_title.trim()
        : row.title,
    titleRewritten: Number(row.title_rewritten ?? 0) === 1,
    titleRewriteReason:
      typeof row.title_rewrite_reason === "string" &&
      row.title_rewrite_reason.trim().length > 0
        ? row.title_rewrite_reason.trim()
        : undefined,
    sourceUrl: row.source_url,
    publishedAt: row.published_at,
    ingestedAt: row.ingested_at || row.published_at,
    domainSector,
    jevConfidence:
      Math.round(Math.max(row.jev_confidence, row.is_systemic_prob) * 100) /
      100,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    toolProbabilities: defaultProbs,
    executiveSummary,
    socraticBrief,
    diagnosticApplication: socraticBrief,
    proportionalityCheck: {
      noiseOverblown: diagnostics.noiseOverblown,
      structuralSignal: diagnostics.structuralSignal,
    },
    questions: [diagnostics.questions[0], diagnostics.questions[1]],
    classifierLatencyMs: 112 + (row.id % 37),
    isLeadPostMortem: storedPayload.isLeadPostMortem,
    leadPostMortemAnalysis: storedPayload.leadPostMortemAnalysis || undefined,
    imageUrl: effectiveImageUrl,
    imageAlt: effectiveImageAlt,
    imageCaption: effectiveImageCaption,
    imageSourceType: effectiveImageSourceType,
    editorialNotes:
      typeof row.editorial_notes === "string" && row.editorial_notes.trim().length > 0
        ? row.editorial_notes.trim()
        : undefined,
    isPinned: Number(row.is_pinned ?? 0) === 1,
    isHidden: Number(row.is_hidden ?? 0) === 1,
  };

  if (!isRenderablePublicIncident(candidate)) {
    return null;
  }

  return candidate;
}

export interface D1EpisodeRow {
  id: number;
  episode_number: number | null;
  slug: string;
  title: string;
  summary: string;
  transcript: string | null;
  audio_url: string;
  duration_seconds: number;
  file_size_bytes: number;
  published_at: string;
  status?: EpisodePublishStatus;
}

function sanitizeEpisodeProse(text: string): string {
  if (!text) return "";
  return sanitizeStringConcatenation(
    text
      .replace(
        /Across the past \d+ days of automated ingestion,\s*our System-1 TypeSafe Jev classifier evaluated \d+ dispatches across the active US feeds,\s*rejecting [\d.]+%\s*\(\d+ items\)\s*as non-systemic noise at the ingestion gate and promoting \d+ high-signal incidents for System-2 review\.\s*/gi,
        ""
      )
      .replace(
        /Across \d+ (?:high-signal )?items evaluated by our classifier over the past seven days,\s*[\d.]+% were dropped as low-signal noise at the ingestion gate\.\s*/gi,
        ""
      )
      .replace(/\s*\([\d.]+% noise rejection across \d+ items\)/gi, "")
      .replace(/Why [\d.]+% of wire traffic was discarded as noise,\s*how/gi, "How")
      .replace(/\bJev's telemetry\b/gi, "operational telemetry")
  );
}

function parseTranscriptSections(
  transcript: string
): EpisodeTranscriptSections | undefined {
  if (!transcript) return undefined;
  const part1Match = transcript.match(
    /\[00:00[^\]]*\]([\s\S]*?)(?=\[01:15|$)/i
  );
  const part2Match = transcript.match(
    /\[01:15[^\]]*\]([\s\S]*?)(?=\[03:30|$)/i
  );
  const part3Match = transcript.match(/\[03:30[^\]]*\]([\s\S]*?)$/i);

  if (!part1Match && !part2Match && !part3Match) {
    return undefined;
  }

  return {
    weeklyTelemetry: sanitizeEpisodeProse((part1Match?.[1] || "").trim()),
    separatingSignalFromPanic: sanitizeEpisodeProse(
      (part2Match?.[1] || "").trim()
    ),
    forwardPosture: sanitizeEpisodeProse((part3Match?.[1] || "").trim()),
  };
}

export function mapD1RowToPodcastEpisode(
  row: D1EpisodeRow,
  d1Incidents: IncidentArticle[]
): PodcastEpisode {
  const episodeNumber = row.episode_number || 43;
  const durationSeconds = row.duration_seconds || 300;
  const mins = Math.floor(durationSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(durationSeconds % 60)
    .toString()
    .padStart(2, "0");

  // Infer dominant tool & failure mode from title/summary or D1 incidents
  let dominantTool: WorkingToolId = d1Incidents[0]?.primaryTool || "The Square";
  const allTools: WorkingToolId[] = [
    "24-Inch Gauge",
    "Common Gavel",
    "The Plumb",
    "The Square",
    "The Level",
    "The Trowel",
  ];
  for (const t of allTools) {
    if (row.title.includes(t) || row.summary.includes(t)) {
      dominantTool = t;
      break;
    }
  }

  const pctMatch =
    row.title.match(/\((\d+)%\)/) || row.summary.match(/\((\d+)%\)/);
  const dominantToolPercentage = pctMatch ? parseInt(pctMatch[1], 10) : 38;

  let dominantFailureMode: SreFailureModeId =
    d1Incidents[0]?.sreFailureMode || "Configuration Drift";
  const allFailureModes: SreFailureModeId[] = [
    "Configuration Drift",
    "Cascading Failure",
    "Alert Fatigue & Signal Loss",
    "Single Point of Failure (SPOF) / Untested Failover",
    "Blame Culture vs. Root-Cause Isolation",
    "Technical & Institutional Debt",
  ];
  for (const fm of allFailureModes) {
    if (row.title.includes(fm) || row.summary.includes(fm)) {
      dominantFailureMode = fm;
      break;
    }
  }

  const top3 = d1Incidents.slice(0, 3);
  const incidentMarkers: EpisodeIncidentMarker[] = top3.map((inc, idx) => ({
    incidentId: inc.id,
    incidentCode: inc.incidentCode,
    incidentSlug: inc.slug,
    incidentTitle: inc.title,
    timestampSeconds: idx === 0 ? 35 : idx === 1 ? 115 : 210,
    timecodeLabel: idx === 0 ? "00:35" : idx === 1 ? "01:55" : "03:30",
    toolApplied: inc.primaryTool,
  }));

  const cleanSummary = sanitizeEpisodeProse(row.summary);
  const rawTranscript = row.transcript || row.summary;
  const cleanTranscript = sanitizeEpisodeProse(rawTranscript);
  const isLegacy =
    row.slug.startsWith("legacy-") ||
    row.title.toLowerCase().includes("legacy archive") ||
    episodeNumber <= 30;

  return {
    id: `d1-ep-${row.id}`,
    slug: row.slug,
    episodeNumber,
    series: isLegacy ? "legacy_archive" : "weekly_rollup",
    title: row.title,
    summary: cleanSummary,
    transcript: cleanTranscript,
    transcriptSections: parseTranscriptSections(rawTranscript),
    audioUrl: row.audio_url,
    durationSeconds,
    durationFormatted: `${mins}:${secs}`,
    fileSizeBytes: row.file_size_bytes || 256000,
    publishedAt: row.published_at,
    dominantTool,
    dominantToolPercentage,
    dominantFailureMode,
    incidentMarkers,
  };
}

/**
 * Locates the active Wrangler local D1 SQLite file inside `.wrangler/state/v3/d1/miniflare-D1DatabaseObject`.
 */
export function findLocalWranglerD1SqlitePath(): string | null {
  try {
    const d1Dir = path.join(
      process.cwd(),
      ".wrangler",
      "state",
      "v3",
      "d1",
      "miniflare-D1DatabaseObject"
    );
    if (!fs.existsSync(d1Dir)) {
      return null;
    }

    const files = fs
      .readdirSync(d1Dir)
      .filter(
        (f) =>
          f.endsWith(".sqlite") &&
          f !== "metadata.sqlite" &&
          !f.endsWith("-shm") &&
          !f.endsWith("-wal")
      )
      .map((f) => {
        const full = path.join(d1Dir, f);
        const stat = fs.statSync(full);
        return { full, size: stat.size, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs || b.size - a.size);

    return files[0]?.full || null;
  } catch {
    return null;
  }
}

export interface D1PipelineRunRow {
  id: number;
  run_type: string;
  started_at: string;
  completed_at: string;
  items_evaluated: number;
  items_accepted: number;
  items_rejected_noise: number;
  avg_latency_ms: number;
  status: string;
  notes: string;
}

export function mapD1RowToPipelineRun(row: D1PipelineRunRow): PipelineRunRecord {
  const validTypes: PipelineRunRecord["runType"][] = [
    "rss_ingest",
    "system2_synthesize",
    "weekly_rollup",
  ];
  const runType: PipelineRunRecord["runType"] = validTypes.includes(
    row.run_type as PipelineRunRecord["runType"]
  )
    ? (row.run_type as PipelineRunRecord["runType"])
    : "rss_ingest";

  const validStatuses: PipelineRunRecord["status"][] = [
    "nominal",
    "degraded",
    "critical",
  ];
  const status: PipelineRunRecord["status"] = validStatuses.includes(
    row.status as PipelineRunRecord["status"]
  )
    ? (row.status as PipelineRunRecord["status"])
    : "nominal";

  return {
    id: `d1-run-${row.id}`,
    runType,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    itemsEvaluated: Number(row.items_evaluated ?? 0),
    itemsAccepted: Number(row.items_accepted ?? 0),
    itemsRejectedNoise: Number(row.items_rejected_noise ?? 0),
    avgClassifierLatencyMs: Number(row.avg_latency_ms ?? 118),
    status,
    notes: row.notes || "",
  };
}

export interface LocalD1Snapshot {
  available: boolean;
  source?: "remote-worker" | "local-sqlite" | "none";
  sqlitePath: string | null;
  synthesizedCount: number;
  triagedCount: number;
  droppedCount: number;
  totalEvaluated: number;
  incidents: IncidentArticle[];
  episodes: PodcastEpisode[];
  pipelineRuns: PipelineRunRecord[];
}

export const DEFAULT_PRODUCTION_WORKER_URL =
  "https://thecabcall.thecabcall.workers.dev";

/**
 * Loads `.dev.vars` keys merged with `process.env` so Next.js API routes have access
 * to `TYPESAFE_API_KEY`, `GEMINI_API_KEY`, `ADMIN_SECRET`, and `WORKER_API_URL`.
 */
export function loadLocalEnvVars(): {
  TYPESAFE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ADMIN_SECRET: string;
  WORKER_API_URL?: string;
  NEXT_PUBLIC_WORKER_URL?: string;
  OWNER_ADMIN_EMAIL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
} {
  const vars: Record<string, string> = {};
  try {
    const devVarsPath = path.join(process.cwd(), ".dev.vars");
    if (fs.existsSync(devVarsPath)) {
      const content = fs.readFileSync(devVarsPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match) {
          vars[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
        }
      }
    }
  } catch {
    // ignore
  }

  const workerApiUrl = (
    process.env.WORKER_API_URL ||
    process.env.NEXT_PUBLIC_WORKER_URL ||
    vars.WORKER_API_URL ||
    vars.NEXT_PUBLIC_WORKER_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  return {
    TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY || vars.TYPESAFE_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || vars.GEMINI_API_KEY,
    ADMIN_SECRET:
      process.env.ADMIN_SECRET || vars.ADMIN_SECRET || "local-dev-secret",
    WORKER_API_URL: workerApiUrl || undefined,
    NEXT_PUBLIC_WORKER_URL:
      (
        process.env.NEXT_PUBLIC_WORKER_URL ||
        vars.NEXT_PUBLIC_WORKER_URL ||
        ""
      )
        .trim()
        .replace(/\/+$/, "") || undefined,
    OWNER_ADMIN_EMAIL: (
      process.env.OWNER_ADMIN_EMAIL ||
      vars.OWNER_ADMIN_EMAIL ||
      "nicholas.king@columbiacloudworks.com"
    )
      .trim()
      .toLowerCase(),
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || vars.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET:
      process.env.GOOGLE_CLIENT_SECRET || vars.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY || vars.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM || vars.EMAIL_FROM,
  };
}

/**
 * Returns explicitly configured `WORKER_API_URL` or `NEXT_PUBLIC_WORKER_URL` if set.
 */
export function getConfiguredWorkerUrl(): string | null {
  const envVars = loadLocalEnvVars();
  return envVars.WORKER_API_URL || envVars.NEXT_PUBLIC_WORKER_URL || null;
}

/**
 * Returns the effective Cloudflare Worker URL (explicitly configured URL or the deployed production Worker URL).
 */
export function getEffectiveWorkerUrl(): string {
  return getConfiguredWorkerUrl() || DEFAULT_PRODUCTION_WORKER_URL;
}

/**
 * Determines whether Next.js should use the remote Cloudflare Worker bridge:
 * - True whenever `WORKER_API_URL` or `NEXT_PUBLIC_WORKER_URL` is explicitly configured
 * - True whenever local `.wrangler` SQLite is absent (e.g., on Vercel in production)
 */
export function shouldUseRemoteWorker(): boolean {
  if (getConfiguredWorkerUrl()) {
    return true;
  }
  return findLocalWranglerD1SqlitePath() === null;
}

function emptyD1Snapshot(sqlitePath: string | null = null): LocalD1Snapshot {
  return {
    available: false,
    source: "none",
    sqlitePath,
    synthesizedCount: 0,
    triagedCount: 0,
    droppedCount: 0,
    totalEvaluated: 0,
    incidents: [],
    episodes: [],
    pipelineRuns: [],
  };
}

const loggedQuarantineHashes = new Set<string>();

const TELEMETRY_ARTICLES_SNAPSHOT_COLUMNS = `
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

const EPISODES_SNAPSHOT_COLUMNS = `
  id,
  episode_number,
  slug,
  title,
  summary,
  transcript,
  audio_url,
  duration_seconds,
  file_size_bytes,
  published_at,
  status
`;

const PIPELINE_RUNS_SNAPSHOT_COLUMNS = `
  id,
  run_type,
  started_at,
  completed_at,
  items_evaluated,
  items_accepted,
  items_rejected_noise,
  avg_latency_ms,
  status,
  notes
`;

function mapPublicIncidentDtoToIncidentArticle(
  dto: PublicIncidentDto
): IncidentArticle | null {
  if (!isRenderablePublicIncident(dto)) {
    return null;
  }
  const defaultProbs: ToolProbabilityDistribution = {
    "24-Inch Gauge": 0.12,
    "Common Gavel": 0.12,
    "The Plumb": 0.12,
    "The Square": 0.12,
    "The Level": 0.12,
    "The Trowel": 0.12,
  };
  defaultProbs[dto.primaryTool] = 0.44;
  defaultProbs[dto.secondaryTool] = 0.24;

  return {
    id: dto.id,
    incidentCode: dto.incidentCode,
    slug: dto.slug,
    urlHash: dto.slug,
    sourceFeed: dto.sourceFeed,
    title: dto.title,
    originalTitle: dto.originalTitle || dto.title,
    titleRewritten: Boolean(dto.titleRewritten),
    titleRewriteReason: dto.titleRewriteReason,
    sourceUrl: dto.sourceUrl,
    publishedAt: dto.publishedAt,
    ingestedAt: dto.publishedAt,
    domainSector: dto.domainSector,
    jevConfidence: 0.9,
    primaryTool: dto.primaryTool,
    secondaryTool: dto.secondaryTool,
    sreFailureMode: dto.sreFailureMode,
    toolProbabilities: defaultProbs,
    executiveSummary: dto.executiveSummary,
    socraticBrief: dto.socraticBrief,
    diagnosticApplication: dto.socraticBrief,
    proportionalityCheck: {
      noiseOverblown: dto.proportionalityCheck.noiseOverblown,
      structuralSignal: dto.proportionalityCheck.structuralSignal,
    },
    questions: [dto.questions[0], dto.questions[1]],
    classifierLatencyMs: 118,
    isLeadPostMortem: dto.isLeadPostMortem,
    leadPostMortemAnalysis: dto.leadPostMortemAnalysis,
    imageUrl: dto.imageUrl,
    imageAlt: dto.imageAlt,
    imageCaption: dto.imageCaption,
    imageSourceType: dto.imageSourceType,
    isPinned: Boolean(dto.isPinned),
  };
}

function mapPublicEpisodeDtoToPodcastEpisode(
  dto: PublicEpisodeDto
): PodcastEpisode | null {
  if (!isRenderablePublicEpisode(dto)) {
    return null;
  }
  return {
    id: dto.id,
    slug: dto.slug,
    episodeNumber: dto.episodeNumber,
    series: dto.series,
    title: dto.title,
    summary: dto.summary,
    transcript: dto.transcript,
    transcriptSections: dto.transcriptSections,
    audioUrl: dto.audioUrl,
    durationSeconds: dto.durationSeconds,
    durationFormatted: dto.durationFormatted,
    fileSizeBytes: dto.fileSizeBytes,
    publishedAt: dto.publishedAt,
    dominantTool: dto.dominantTool,
    dominantFailureMode: dto.dominantFailureMode,
    incidentMarkers: dto.incidentMarkers || [],
  };
}

function buildSnapshotFromRows(
  allArticleRows: TelemetryArticleRow[],
  episodeRows: D1EpisodeRow[],
  runRows: D1PipelineRunRow[],
  sqlitePath: string,
  source: "remote-worker" | "local-sqlite"
): LocalD1Snapshot {
  const synthesizedCount = allArticleRows.filter(
    (r) => r.status === "synthesized" && Number(r.is_hidden ?? 0) !== 1
  ).length;
  const triagedCount = allArticleRows.filter(
    (r) => r.status === "triaged"
  ).length;
  const droppedCount = allArticleRows.filter(
    (r) => r.status === "dropped"
  ).length;

  // Strictly filter out QUARANTINED, PENDING_RETRY, dropped, hidden, and un-synthesized rows
  const visibleRows = allArticleRows
    .filter((r) => r.status === "synthesized" && Number(r.is_hidden ?? 0) !== 1)
    .sort(
      (a, b) =>
        Number(b.is_pinned ?? 0) - Number(a.is_pinned ?? 0) ||
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  const incidents: IncidentArticle[] = [];

  for (const row of visibleRows) {
    const stored = extractStoredQuestionsPayload(row.questions_json);
    const shouldLog = !loggedQuarantineHashes.has(row.url_hash);
    const validation = validateAndNormalizeIncidentSummary({
      id: row.id,
      title: row.title,
      sourceFeed: row.source_feed,
      rawExcerpt: row.raw_excerpt,
      executiveSummary: stored.executiveSummary,
      socraticBrief: row.socratic_brief,
      logWarnings: shouldLog,
    });

    if (!validation.valid) {
      loggedQuarantineHashes.add(row.url_hash);
      continue;
    }

    const mapped = mapD1RowToIncidentArticle(row, validation);
    if (!mapped) {
      loggedQuarantineHashes.add(row.url_hash);
      continue;
    }

    incidents.push(mapped);
  }

  const publishedEpisodeRows = episodeRows.filter(
    (ep) => !ep.status || ep.status === "PUBLISHED"
  );
  const episodes = publishedEpisodeRows
    .map((ep) => mapD1RowToPodcastEpisode(ep, incidents))
    .filter((ep) => isRenderablePublicEpisode(ep));
  const pipelineRuns = runRows.map(mapD1RowToPipelineRun);

  return {
    available: true,
    source,
    sqlitePath,
    synthesizedCount,
    triagedCount,
    droppedCount,
    totalEvaluated: allArticleRows.length,
    incidents,
    episodes,
    pipelineRuns,
  };
}

let localSchemaHardened = false;

function ensureLocalSqliteHardenedSchema(db: {
  exec(sql: string): void;
}): void {
  if (localSchemaHardened) return;
  const alterStmts = [
    "ALTER TABLE episodes ADD COLUMN status TEXT NOT NULL DEFAULT 'PUBLISHED';",
    "ALTER TABLE telemetry_articles ADD COLUMN original_title TEXT;",
    "ALTER TABLE telemetry_articles ADD COLUMN title_rewritten INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE telemetry_articles ADD COLUMN title_rewrite_reason TEXT;",
    "ALTER TABLE telemetry_articles ADD COLUMN image_url TEXT;",
    "ALTER TABLE telemetry_articles ADD COLUMN image_alt TEXT;",
    "ALTER TABLE telemetry_articles ADD COLUMN image_caption TEXT;",
    "ALTER TABLE telemetry_articles ADD COLUMN image_source_type TEXT NOT NULL DEFAULT 'none';",
    "ALTER TABLE telemetry_articles ADD COLUMN editorial_notes TEXT;",
    "ALTER TABLE telemetry_articles ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE telemetry_articles ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;",
  ];
  for (const stmt of alterStmts) {
    try {
      db.exec(stmt);
    } catch {
      // Column already exists
    }
  }
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_articles_canonical_hash ON telemetry_articles(url_hash);
      CREATE INDEX IF NOT EXISTS idx_telemetry_articles_status_only ON telemetry_articles(status);
      CREATE INDEX IF NOT EXISTS idx_telemetry_articles_status_published ON telemetry_articles(status, published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_telemetry_articles_published_desc ON telemetry_articles(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_episodes_published_desc ON episodes(published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_episodes_status_published ON episodes(status, published_at DESC);
    `);
    localSchemaHardened = true;
  } catch {
    // Ignore on read-only or uninitialized DB
  }
}

/**
 * Synchronously reads live `telemetry_articles`, `episodes`, and `pipeline_runs` from the local Wrangler D1 SQLite database
 * using Node's built-in `node:sqlite` (`DatabaseSync`), mapping rows to frontend types using explicit column selection.
 */
export function readLocalSqliteSnapshot(): LocalD1Snapshot {
  const sqlitePath = findLocalWranglerD1SqlitePath();
  if (!sqlitePath) {
    return emptyD1Snapshot(null);
  }

  try {
    // Dynamic require of built-in node:sqlite so bundlers don't complain on client side
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(sqlitePath, { open: true });

    try {
      ensureLocalSqliteHardenedSchema(db);

      const allArticleRows = db
        .prepare(
          `SELECT ${TELEMETRY_ARTICLES_SNAPSHOT_COLUMNS}
           FROM telemetry_articles
           ORDER BY
             CASE WHEN status = 'synthesized' THEN 0 WHEN status = 'triaged' THEN 1 ELSE 2 END,
             published_at DESC,
             id DESC`
        )
        .all() as TelemetryArticleRow[];

      let episodeRows: D1EpisodeRow[] = [];
      try {
        episodeRows = db
          .prepare(
            `SELECT ${EPISODES_SNAPSHOT_COLUMNS}
             FROM episodes
             WHERE status = 'PUBLISHED'
             ORDER BY published_at DESC, id DESC`
          )
          .all() as D1EpisodeRow[];
      } catch {
        episodeRows = [];
      }

      let runRows: D1PipelineRunRow[] = [];
      try {
        runRows = db
          .prepare(
            `SELECT ${PIPELINE_RUNS_SNAPSHOT_COLUMNS}
             FROM pipeline_runs
             ORDER BY started_at DESC, id DESC
             LIMIT 50`
          )
          .all() as D1PipelineRunRow[];
      } catch {
        runRows = [];
      }

      return buildSnapshotFromRows(
        allArticleRows,
        episodeRows,
        runRows,
        sqlitePath,
        "local-sqlite"
      );
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn("[D1 Bridge] Failed to read local D1 SQLite:", err);
    return emptyD1Snapshot(sqlitePath);
  }
}

let cachedRemoteSnapshot: LocalD1Snapshot | null = null;
let cachedRemoteSnapshotAtMs = 0;
let inFlightRemoteSnapshotPromise: Promise<LocalD1Snapshot | null> | null =
  null;
const REMOTE_SNAPSHOT_TTL_MS = 1_500;

/**
 * Fetches `/api/snapshot` from the remote Cloudflare Worker and populates the in-memory snapshot cache.
 */
export async function fetchRemoteWorkerSnapshot(
  forceFresh = false
): Promise<LocalD1Snapshot | null> {
  const now = Date.now();
  if (
    !forceFresh &&
    cachedRemoteSnapshot &&
    now - cachedRemoteSnapshotAtMs < REMOTE_SNAPSHOT_TTL_MS
  ) {
    return cachedRemoteSnapshot;
  }

  if (!forceFresh && inFlightRemoteSnapshotPromise) {
    return inFlightRemoteSnapshotPromise;
  }

  const workerUrl = getEffectiveWorkerUrl();
  const snapshotUrl = `${workerUrl}/api/snapshot?fresh=1`;

  const fetchPromise = (async (): Promise<LocalD1Snapshot | null> => {
    try {
      const response = await fetch(snapshotUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.warn(
          `[D1 Bridge] Remote Worker /api/snapshot returned HTTP ${response.status}`
        );
        return cachedRemoteSnapshot;
      }

      const data = (await response.json()) as {
        ok?: boolean;
        incidents?: PublicIncidentDto[];
        articles?: TelemetryArticleRow[];
        episodes?: Array<PublicEpisodeDto & D1EpisodeRow>;
        pipelineRuns?: D1PipelineRunRow[];
      };

      if (!data) {
        return cachedRemoteSnapshot;
      }

      if (Array.isArray(data.incidents)) {
        const incidents = data.incidents
          .map(mapPublicIncidentDtoToIncidentArticle)
          .filter((inc): inc is IncidentArticle => inc !== null);
        const episodes = (Array.isArray(data.episodes) ? data.episodes : [])
          .map((ep) => mapPublicEpisodeDtoToPodcastEpisode(ep as PublicEpisodeDto))
          .filter((ep): ep is PodcastEpisode => ep !== null);

        const snap: LocalD1Snapshot = {
          available: true,
          source: "remote-worker",
          sqlitePath: null,
          synthesizedCount: incidents.length,
          triagedCount: 0,
          droppedCount: 0,
          totalEvaluated: incidents.length,
          incidents,
          episodes,
          pipelineRuns: [],
        };
        cachedRemoteSnapshot = snap;
        cachedRemoteSnapshotAtMs = Date.now();
        return snap;
      }

      if (!Array.isArray(data.articles)) {
        return cachedRemoteSnapshot;
      }

      const snap = buildSnapshotFromRows(
        data.articles,
        Array.isArray(data.episodes) ? (data.episodes as D1EpisodeRow[]) : [],
        Array.isArray(data.pipelineRuns) ? data.pipelineRuns : [],
        `${workerUrl}/api/snapshot`,
        "remote-worker"
      );

      cachedRemoteSnapshot = snap;
      cachedRemoteSnapshotAtMs = Date.now();
      return snap;
    } catch (err) {
      console.warn(
        `[D1 Bridge] Failed to fetch remote Worker snapshot (${snapshotUrl}):`,
        err
      );
      return cachedRemoteSnapshot;
    } finally {
      inFlightRemoteSnapshotPromise = null;
    }
  })();

  if (!forceFresh) {
    inFlightRemoteSnapshotPromise = fetchPromise;
  }

  return fetchPromise;
}

/**
 * Ensures the active D1 snapshot (remote Cloudflare Worker or local `.wrangler` SQLite) is loaded and warm
 * before Server Components or API Route Handlers read from `store.ts` or `readLocalD1Snapshot()`.
 */
export async function ensureD1Snapshot(
  forceFresh = false
): Promise<LocalD1Snapshot> {
  if (shouldUseRemoteWorker()) {
    const remoteSnap = await fetchRemoteWorkerSnapshot(forceFresh);
    if (remoteSnap && remoteSnap.available) {
      return remoteSnap;
    }
    const localFallback = readLocalSqliteSnapshot();
    if (localFallback.available) {
      return localFallback;
    }
    return emptyD1Snapshot(`${getEffectiveWorkerUrl()}/api/snapshot`);
  }

  const localSnap = readLocalSqliteSnapshot();
  if (localSnap.available) {
    return localSnap;
  }

  const remoteFallback = await fetchRemoteWorkerSnapshot(forceFresh);
  if (remoteFallback && remoteFallback.available) {
    return remoteFallback;
  }

  return localSnap;
}

/**
 * Synchronously returns the active D1 snapshot:
 * - When `WORKER_API_URL` / `NEXT_PUBLIC_WORKER_URL` is configured (or when local `.wrangler` SQLite is absent),
 *   returns the synced remote Cloudflare Worker snapshot (with local `.wrangler` fallback if offline).
 * - When developing locally offline with `.wrangler` present and `WORKER_API_URL` unset,
 *   reads local `.wrangler` SQLite directly.
 */
export function readLocalD1Snapshot(): LocalD1Snapshot {
  if (shouldUseRemoteWorker()) {
    if (cachedRemoteSnapshot && cachedRemoteSnapshot.available) {
      return cachedRemoteSnapshot;
    }
    // Kick off non-blocking background warm if called before ensureD1Snapshot
    void fetchRemoteWorkerSnapshot(false);
    const localFallback = readLocalSqliteSnapshot();
    if (localFallback.available) {
      return localFallback;
    }
    return emptyD1Snapshot(`${getEffectiveWorkerUrl()}/api/snapshot`);
  }

  const localSnap = readLocalSqliteSnapshot();
  if (localSnap.available) {
    return localSnap;
  }

  if (cachedRemoteSnapshot && cachedRemoteSnapshot.available) {
    return cachedRemoteSnapshot;
  }

  return localSnap;
}

/**
 * Reads `pipeline_runs` rows from the active D1 snapshot (remote Worker or local Wrangler D1).
 */
export function getPipelineRuns(): PipelineRunRecord[] {
  return readLocalD1Snapshot().pipelineRuns;
}

/**
 * Triggers `POST /api/run-ingest` on the production Cloudflare Worker and refreshes the snapshot cache.
 */
export async function triggerRemoteWorkerIngest(options?: {
  synthesize?: boolean;
  synthesizeLimit?: number;
  maxNetNew?: number;
  customArticle?: {
    title: string;
    description: string;
    sourceFeed: string;
    link?: string;
  };
  actor?: {
    email: string;
    role: string;
    authMethod: string;
  };
}): Promise<Record<string, unknown>> {
  const workerUrl = getEffectiveWorkerUrl();
  const envVars = loadLocalEnvVars();
  const query = options?.synthesize ? "?synthesize=true" : "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-admin-secret": envVars.ADMIN_SECRET,
  };
  if (options?.actor) {
    headers["x-actor-email"] = options.actor.email;
    headers["x-actor-role"] = options.actor.role;
    headers["x-actor-auth-method"] = options.actor.authMethod;
  }

  const response = await fetch(`${workerUrl}/api/run-ingest${query}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      synthesize: options?.synthesize,
      synthesizeLimit: options?.synthesizeLimit,
      maxNetNew: options?.maxNetNew,
      customArticle: options?.customArticle,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `Worker /api/run-ingest failed with HTTP ${response.status}`
    );
  }

  await ensureD1Snapshot(true);
  return data;
}

/**
 * Triggers `POST /api/run-synthesize` on the production Cloudflare Worker and refreshes the snapshot cache.
 */
export async function triggerRemoteWorkerSynthesize(options?: {
  limit?: number;
  actor?: {
    email: string;
    role: string;
    authMethod: string;
  };
}): Promise<Record<string, unknown>> {
  const workerUrl = getEffectiveWorkerUrl();
  const envVars = loadLocalEnvVars();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-admin-secret": envVars.ADMIN_SECRET,
  };
  if (options?.actor) {
    headers["x-actor-email"] = options.actor.email;
    headers["x-actor-role"] = options.actor.role;
    headers["x-actor-auth-method"] = options.actor.authMethod;
  }

  const response = await fetch(`${workerUrl}/api/run-synthesize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      limit: options?.limit ?? 5,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `Worker /api/run-synthesize failed with HTTP ${response.status}`
    );
  }

  await ensureD1Snapshot(true);
  return data;
}

/**
 * Triggers `POST /api/run-rollup` on the production Cloudflare Worker and refreshes the snapshot cache.
 */
export async function triggerRemoteWorkerRollup(options?: {
  actor?: {
    email: string;
    role: string;
    authMethod: string;
  };
}): Promise<Record<string, unknown>> {
  const workerUrl = getEffectiveWorkerUrl();
  const envVars = loadLocalEnvVars();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-admin-secret": envVars.ADMIN_SECRET,
  };
  if (options?.actor) {
    headers["x-actor-email"] = options.actor.email;
    headers["x-actor-role"] = options.actor.role;
    headers["x-actor-auth-method"] = options.actor.authMethod;
  }

  const response = await fetch(`${workerUrl}/api/run-rollup`, {
    method: "POST",
    headers,
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `Worker /api/run-rollup failed with HTTP ${response.status}`
    );
  }

  await ensureD1Snapshot(true);
  return data;
}

/**
 * Fetches MP3 audio bytes from the remote Cloudflare Worker `/audio/:filename` R2 endpoint.
 */
export async function fetchRemoteWorkerAudioBytes(
  filename: string
): Promise<Uint8Array | null> {
  try {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(
      `${workerUrl}/audio/${encodeURIComponent(filename)}`,
      {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!response.ok) {
      return null;
    }
    const ab = await response.arrayBuffer();
    if (ab.byteLength === 0) {
      return null;
    }
    return new Uint8Array(ab);
  } catch (err) {
    console.warn(
      `[R2 Bridge] Failed to fetch remote audio (${filename}):`,
      err
    );
    return null;
  }
}

/**
 * Provides a local filesystem R2 adapter under `.wrangler/state/v3/r2/cabcall-audio-blobs`
 * so Next.js routes can persist, verify via `head()`, and stream episode MP3 binaries identically to the Worker.
 */
export function createLocalR2AudioAdapter(): R2BucketLike {
  const audioDir = path.join(
    process.cwd(),
    ".wrangler",
    "state",
    "v3",
    "r2",
    "cabcall-audio-blobs"
  );
  const publicAudioDir = path.join(process.cwd(), "public", "audio");

  function resolveMetaAndPath(key: string): {
    safeKey: string;
    filePath: string | null;
    contentType: string;
  } {
    const safeKey = path.basename(key);
    const r2Path = path.join(audioDir, safeKey);
    const metaPath = `${r2Path}.meta.json`;
    let contentType = "audio/mpeg";
    if (fs.existsSync(metaPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        if (typeof parsed?.contentType === "string") {
          contentType = parsed.contentType;
        }
      } catch {
        // ignore
      }
    }
    if (fs.existsSync(r2Path)) {
      return { safeKey, filePath: r2Path, contentType };
    }
    const pubPath = path.join(publicAudioDir, safeKey);
    if (fs.existsSync(pubPath)) {
      return { safeKey, filePath: pubPath, contentType: "audio/mpeg" };
    }
    return { safeKey, filePath: null, contentType };
  }

  return {
    async put(key, value, options) {
      try {
        fs.mkdirSync(audioDir, { recursive: true });
        const safeKey = path.basename(key);
        const filePath = path.join(audioDir, safeKey);
        if (value instanceof Uint8Array) {
          fs.writeFileSync(filePath, value);
        } else if (value instanceof ArrayBuffer) {
          fs.writeFileSync(filePath, new Uint8Array(value));
        } else if (typeof value === "string") {
          fs.writeFileSync(filePath, value, "utf8");
        }
        const metaPath = `${filePath}.meta.json`;
        fs.writeFileSync(
          metaPath,
          JSON.stringify({
            contentType: options?.httpMetadata?.contentType ?? "audio/mpeg",
            customMetadata: options?.customMetadata ?? {},
          }),
          "utf8"
        );
      } catch (err) {
        console.warn("[R2 Bridge] Failed to write local audio file:", err);
      }
      return {};
    },
    async head(key): Promise<R2ObjectMetaLike | null> {
      try {
        const { safeKey, filePath, contentType } = resolveMetaAndPath(key);
        if (!filePath) return null;
        const stat = fs.statSync(filePath);
        return {
          key: safeKey,
          size: stat.size,
          httpMetadata: { contentType },
        };
      } catch {
        return null;
      }
    },
    async get(key): Promise<R2ObjectLike | null> {
      try {
        const { safeKey, filePath, contentType } = resolveMetaAndPath(key);
        if (!filePath) return null;
        const buf = fs.readFileSync(filePath);
        const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        return {
          key: safeKey,
          size: u8.byteLength,
          httpMetadata: { contentType },
          async arrayBuffer() {
            return u8.buffer.slice(
              u8.byteOffset,
              u8.byteOffset + u8.byteLength
            );
          },
        };
      } catch {
        return null;
      }
    },
    async delete(key) {
      try {
        const keys = Array.isArray(key) ? key : [key];
        for (const k of keys) {
          const safeKey = path.basename(k);
          const filePath = path.join(audioDir, safeKey);
          const metaPath = `${filePath}.meta.json`;
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          if (fs.existsSync(metaPath)) {
            fs.unlinkSync(metaPath);
          }
        }
      } catch (err) {
        console.warn("[R2 Bridge] Failed to delete local audio file:", err);
      }
    },
  };
}

interface InternalSqlitePreparedStatement extends D1PreparedStatementLike {
  __query: string;
  __getBoundValues(): unknown[];
}

/**
 * Provides a `D1DatabaseLike` wrapper backed by the local `.wrangler` SQLite database
 * so Next.js server routes can also execute D1 pipeline queries (including `db.batch()`) directly when running locally.
 */
export function createLocalSqliteD1Adapter(): D1DatabaseLike | null {
  const sqlitePath = findLocalWranglerD1SqlitePath();
  if (!sqlitePath) return null;

  return {
    prepare(query: string): D1PreparedStatementLike {
      let boundValues: unknown[] = [];

      const statement: InternalSqlitePreparedStatement = {
        __query: query,
        __getBoundValues() {
          return boundValues;
        },
        bind(...values: unknown[]) {
          boundValues = values;
          return statement;
        },
        async first<T = Record<string, unknown>>(
          colName?: string
        ): Promise<T | null> {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { DatabaseSync } = require("node:sqlite");
          const db = new DatabaseSync(sqlitePath, { open: true });
          try {
            ensureLocalSqliteHardenedSchema(db);
            const stmt = db.prepare(query);
            const row = stmt.get(...boundValues) as
              | Record<string, unknown>
              | undefined;
            if (!row) return null;
            if (colName) return (row[colName] as T) ?? null;
            return row as T;
          } finally {
            db.close();
          }
        },
        async run<T = unknown>(): Promise<T> {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { DatabaseSync } = require("node:sqlite");
          const db = new DatabaseSync(sqlitePath, { open: true });
          try {
            ensureLocalSqliteHardenedSchema(db);
            const stmt = db.prepare(query);
            return stmt.run(...boundValues) as T;
          } finally {
            db.close();
          }
        },
        async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { DatabaseSync } = require("node:sqlite");
          const db = new DatabaseSync(sqlitePath, { open: true });
          try {
            ensureLocalSqliteHardenedSchema(db);
            const stmt = db.prepare(query);
            const results = (stmt.all(...boundValues) || []) as T[];
            return { results };
          } finally {
            db.close();
          }
        },
      };

      return statement;
    },
    async batch<T = unknown>(
      statements: D1PreparedStatementLike[]
    ): Promise<T[]> {
      if (!statements || statements.length === 0) return [];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(sqlitePath, { open: true });
      const results: T[] = [];
      try {
        ensureLocalSqliteHardenedSchema(db);
        db.exec("BEGIN IMMEDIATE");
        try {
          for (const stmt of statements) {
            const internal = stmt as Partial<InternalSqlitePreparedStatement>;
            if (
              internal.__query &&
              typeof internal.__getBoundValues === "function"
            ) {
              const prepared = db.prepare(internal.__query);
              results.push(
                prepared.run(...internal.__getBoundValues()) as T
              );
            } else {
              results.push(await stmt.run<T>());
            }
          }
          db.exec("COMMIT");
        } catch (err) {
          try {
            db.exec("ROLLBACK");
          } catch {
            // ignore rollback error
          }
          throw err;
        }
        return results;
      } finally {
        db.close();
      }
    },
  };
}

let autoRefreshInFlight = false;
let lastAutoRefreshCheckMs = 0;

/**
 * Self-updating stale-while-revalidate guard:
 * If the latest `rss_ingest` run in D1 is older than `maxAgeHours` (default 6h)
 * or if there are pending `triaged` rows awaiting System-2 synthesis, automatically
 * triggers a non-blocking background ingest + synthesis pass so the site stays fresh
 * even without an external cron daemon.
 */
export function triggerAutoRefreshIfStale(maxAgeHours = 6): void {
  const now = Date.now();
  // Throttle checks to at most once every 60 seconds per process
  if (autoRefreshInFlight || now - lastAutoRefreshCheckMs < 60_000) {
    return;
  }
  lastAutoRefreshCheckMs = now;

  const snap = readLocalD1Snapshot();
  if (!snap.available) return;

  const latestIngestRun = snap.pipelineRuns.find(
    (r) => r.runType === "rss_ingest"
  );
  const lastIngestTimeMs = latestIngestRun
    ? new Date(latestIngestRun.startedAt).getTime()
    : snap.incidents[0]?.ingestedAt
    ? new Date(snap.incidents[0].ingestedAt).getTime()
    : 0;

  const ageHours =
    lastIngestTimeMs > 0 ? (now - lastIngestTimeMs) / (1000 * 60 * 60) : 999;
  const hasPendingTriaged = snap.triagedCount > 0;

  if (ageHours < maxAgeHours && !hasPendingTriaged) {
    return;
  }

  if (shouldUseRemoteWorker()) {
    autoRefreshInFlight = true;
    void (async () => {
      try {
        if (ageHours >= maxAgeHours) {
          await triggerRemoteWorkerIngest({
            synthesize: true,
            synthesizeLimit: 6,
            maxNetNew: 6,
          });
        } else if (hasPendingTriaged) {
          await triggerRemoteWorkerSynthesize({ limit: 6 });
        }
      } catch (err) {
        console.warn("[D1 Auto-Refresh] Remote Worker sweep error:", err);
      } finally {
        autoRefreshInFlight = false;
      }
    })();
    return;
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) return;

  autoRefreshInFlight = true;
  const envVars = loadLocalEnvVars();

  void (async () => {
    try {
      if (ageHours >= maxAgeHours) {
        await runD1IngestPipeline({
          db,
          typesafeApiKey: envVars.TYPESAFE_API_KEY,
          maxNetNew: 6,
          itemsPerFeed: 5,
        });
      }
      await runSynthesizePipeline({
        db,
        geminiApiKey: envVars.GEMINI_API_KEY,
        limit: 6,
      });
    } catch (err) {
      console.warn("[D1 Auto-Refresh] Background sweep error:", err);
    } finally {
      autoRefreshInFlight = false;
    }
  })();
}
