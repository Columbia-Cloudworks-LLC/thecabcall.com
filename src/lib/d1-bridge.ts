import fs from "node:fs";
import path from "node:path";
import {
  DomainSectorId,
  getSreFailureModeSpec,
  getWorkingToolSpec,
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
import { R2BucketLike, R2ObjectLike } from "@/pipeline/rollup";
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
  if (!rawTool) return "The Square";
  const key = rawTool.trim().toLowerCase() as JevWorkingToolKey;
  return JEV_TO_FRONTEND_TOOL[key] || "The Square";
}

export function mapJevFailureToSreFailureModeId(
  rawFailure?: string | null
): SreFailureModeId {
  if (!rawFailure) return "Configuration Drift";
  const key = rawFailure.trim().toLowerCase() as JevSreFailureModeKey;
  return JEV_TO_FRONTEND_FAILURE_MODE[key] || "Configuration Drift";
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

export function mapD1RowToIncidentArticle(
  row: TelemetryArticleRow
): IncidentArticle {
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
          if (typeof rawProbs[jevKey] === "number") {
            defaultProbs[frontendKey] =
              Math.round(rawProbs[jevKey] * 100) / 100;
          }
        }
      );
    }
  } catch {
    // Use default fallback probabilities
  }

  const primarySpec = getWorkingToolSpec(primaryTool);
  const secondarySpec = getWorkingToolSpec(secondaryTool);
  const failureSpec = getSreFailureModeSpec(sreFailureMode);

  let executiveSummary = `${row.raw_excerpt.slice(0, 220)}${
    row.raw_excerpt.length > 220 ? "..." : ""
  } Evaluated via Jev (jev-1.14.0) under ${primaryTool} and ${sreFailureMode}.`;
  let socraticBrief =
    row.socratic_brief ||
    `Primary source dispatch from ${row.source_feed} ("${row.title}") triaged by the Change Advisory Board System-1 gate at ${Math.round(
      row.is_systemic_prob * 100
    )}% systemic probability.\n\n${row.raw_excerpt}\n\nClassified under ${primaryTool} and ${sreFailureMode}, this event remains in active post-incident review awaiting full operational telemetry.`;
  let proportionalityCheck = {
    noiseOverblown: `Reactive headline spin surrounding "${row.title}" that treats an active operational friction point as a morality play.`,
    structuralSignal: `${failureSpec.systemsDefinition} Specifically, the requirement for ${primarySpec.sreEquivalent.toLowerCase()}.`,
  };
  let questions: string[] = [
    primarySpec.diagnosticQuestionPattern,
    `Applying ${primaryTool} to "${row.title}", where did live execution diverge from the stated policy or architectural specification?`,
    `When ${secondaryTool} is weighed alongside ${primaryTool}, how does ${secondarySpec.sreEquivalent.toLowerCase()} reshape the downstream blast radius?`,
    `What unverified post-mortem telemetry is still needed to determine whether this incident reflects an isolated fault or systemic ${sreFailureMode.toLowerCase()}?`,
  ];

  if (row.questions_json) {
    try {
      const parsedQ = JSON.parse(row.questions_json);
      if (Array.isArray(parsedQ)) {
        questions = parsedQ.map((q) => String(q));
      } else if (parsedQ && typeof parsedQ === "object") {
        if (typeof parsedQ.executive_summary === "string" && parsedQ.executive_summary.trim()) {
          executiveSummary = parsedQ.executive_summary.trim();
        }
        if (
          parsedQ.proportionality_check &&
          typeof parsedQ.proportionality_check === "object"
        ) {
          proportionalityCheck = {
            noiseOverblown:
              parsedQ.proportionality_check.noise_overblown ||
              proportionalityCheck.noiseOverblown,
            structuralSignal:
              parsedQ.proportionality_check.structural_signal ||
              proportionalityCheck.structuralSignal,
          };
        }
        if (Array.isArray(parsedQ.questions) && parsedQ.questions.length > 0) {
          questions = parsedQ.questions.map((q: unknown) => String(q));
        }
      }
    } catch {
      // Ignore malformed questions_json
    }
  }

  const primaryProb = defaultProbs[primaryTool] || row.jev_confidence || 0.45;
  const secondaryProb = defaultProbs[secondaryTool] || 0.22;

  const diagnosticApplication = `System-1 TypeSafe Jev (jev-1.14.0) assigned a ${primaryProb.toFixed(
    2
  )} primary weight to ${primaryTool} paired with ${sreFailureMode} (systemic probability ${(
    row.is_systemic_prob * 100
  ).toFixed(0)}%), with secondary weighting on ${secondaryTool} (${secondaryProb.toFixed(
    2
  )}). ${primarySpec.sreDefinition} Concurrently, ${
    failureSpec.summary
  } Applying ${primaryTool} alongside ${secondaryTool} anchors the review in verifiable operational state rather than speculative commentary.`;

  const incidentNumber = 2000 + row.id;

  return {
    id: `d1-inc-${row.id}`,
    incidentCode: `#CAB-2026-${incidentNumber}`,
    slug: makeIncidentSlug(row.title, row.id),
    urlHash: row.url_hash,
    sourceFeed: row.source_feed.toUpperCase(),
    title: row.title,
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
    diagnosticApplication,
    proportionalityCheck,
    questions,
    classifierLatencyMs: 112 + (row.id % 37),
  };
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
    weeklyTelemetry: (part1Match?.[1] || "").trim(),
    separatingSignalFromPanic: (part2Match?.[1] || "").trim(),
    forwardPosture: (part3Match?.[1] || "").trim(),
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

  const transcript = row.transcript || row.summary;

  return {
    id: `d1-ep-${row.id}`,
    slug: row.slug,
    episodeNumber,
    series: "weekly_rollup",
    title: row.title,
    summary: row.summary,
    transcript,
    transcriptSections: parseTranscriptSections(transcript),
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

function buildSnapshotFromRows(
  allArticleRows: TelemetryArticleRow[],
  episodeRows: D1EpisodeRow[],
  runRows: D1PipelineRunRow[],
  sqlitePath: string,
  source: "remote-worker" | "local-sqlite"
): LocalD1Snapshot {
  const synthesizedCount = allArticleRows.filter(
    (r) => r.status === "synthesized"
  ).length;
  const triagedCount = allArticleRows.filter(
    (r) => r.status === "triaged"
  ).length;
  const droppedCount = allArticleRows.filter(
    (r) => r.status === "dropped"
  ).length;

  const visibleRows = allArticleRows.filter(
    (r) => r.status === "synthesized" || r.status === "triaged"
  );
  const incidents = visibleRows.map(mapD1RowToIncidentArticle);

  const episodes = episodeRows.map((ep) =>
    mapD1RowToPodcastEpisode(ep, incidents)
  );
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

/**
 * Synchronously reads live `telemetry_articles`, `episodes`, and `pipeline_runs` from the local Wrangler D1 SQLite database
 * using Node's built-in `node:sqlite` (`DatabaseSync`), mapping rows to frontend types.
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
      const allArticleRows = db
        .prepare(
          `SELECT * FROM telemetry_articles
           ORDER BY
             CASE WHEN status = 'synthesized' THEN 0 WHEN status = 'triaged' THEN 1 ELSE 2 END,
             published_at DESC,
             id DESC`
        )
        .all() as TelemetryArticleRow[];

      let episodeRows: D1EpisodeRow[] = [];
      try {
        episodeRows = db
          .prepare("SELECT * FROM episodes ORDER BY published_at DESC, id DESC")
          .all() as D1EpisodeRow[];
      } catch {
        episodeRows = [];
      }

      let runRows: D1PipelineRunRow[] = [];
      try {
        runRows = db
          .prepare(
            "SELECT * FROM pipeline_runs ORDER BY started_at DESC, id DESC LIMIT 50"
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
const REMOTE_SNAPSHOT_TTL_MS = 15_000;

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
  const snapshotUrl = `${workerUrl}/api/snapshot${
    forceFresh ? "?fresh=1" : ""
  }`;

  const fetchPromise = (async (): Promise<LocalD1Snapshot | null> => {
    try {
      const response = await fetch(snapshotUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: forceFresh ? "no-store" : "default",
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
        articles?: TelemetryArticleRow[];
        episodes?: D1EpisodeRow[];
        pipelineRuns?: D1PipelineRunRow[];
      };

      if (!data || !Array.isArray(data.articles)) {
        return cachedRemoteSnapshot;
      }

      const snap = buildSnapshotFromRows(
        data.articles,
        Array.isArray(data.episodes) ? data.episodes : [],
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
 * so Next.js routes can persist and stream episode MP3 binaries identically to the Worker.
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

  return {
    async put(key, value) {
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
      } catch (err) {
        console.warn("[R2 Bridge] Failed to write local audio file:", err);
      }
      return {};
    },
    async get(key): Promise<R2ObjectLike | null> {
      try {
        const safeKey = path.basename(key);
        const filePath = path.join(audioDir, safeKey);
        if (!fs.existsSync(filePath)) return null;
        const buf = fs.readFileSync(filePath);
        const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        return {
          key: safeKey,
          size: u8.byteLength,
          httpMetadata: { contentType: "audio/mpeg" },
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
  };
}

/**
 * Provides a `D1DatabaseLike` wrapper backed by the local `.wrangler` SQLite database
 * so Next.js server routes can also execute D1 pipeline queries directly when running locally.
 */
export function createLocalSqliteD1Adapter(): D1DatabaseLike | null {
  const sqlitePath = findLocalWranglerD1SqlitePath();
  if (!sqlitePath) return null;

  return {
    prepare(query: string): D1PreparedStatementLike {
      let boundValues: unknown[] = [];

      const statement: D1PreparedStatementLike = {
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
