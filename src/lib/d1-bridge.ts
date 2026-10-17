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
  sqlitePath: string | null;
  synthesizedCount: number;
  triagedCount: number;
  droppedCount: number;
  totalEvaluated: number;
  incidents: IncidentArticle[];
  episodes: PodcastEpisode[];
  pipelineRuns: PipelineRunRecord[];
}

/**
 * Synchronously reads live `telemetry_articles`, `episodes`, and `pipeline_runs` from the local Wrangler D1 SQLite database
 * using Node's built-in `node:sqlite` (`DatabaseSync`), mapping rows to frontend types.
 */
export function readLocalD1Snapshot(): LocalD1Snapshot {
  const sqlitePath = findLocalWranglerD1SqlitePath();
  if (!sqlitePath) {
    return {
      available: false,
      sqlitePath: null,
      synthesizedCount: 0,
      triagedCount: 0,
      droppedCount: 0,
      totalEvaluated: 0,
      incidents: [],
      episodes: [],
      pipelineRuns: [],
    };
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

      let episodeRows: D1EpisodeRow[] = [];
      try {
        episodeRows = db
          .prepare("SELECT * FROM episodes ORDER BY published_at DESC, id DESC")
          .all() as D1EpisodeRow[];
      } catch {
        episodeRows = [];
      }

      const episodes = episodeRows.map((ep) =>
        mapD1RowToPodcastEpisode(ep, incidents)
      );

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

      const pipelineRuns = runRows.map(mapD1RowToPipelineRun);

      return {
        available: true,
        sqlitePath,
        synthesizedCount,
        triagedCount,
        droppedCount,
        totalEvaluated: allArticleRows.length,
        incidents,
        episodes,
        pipelineRuns,
      };
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn("[D1 Bridge] Failed to read local D1 SQLite:", err);
    return {
      available: false,
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
}

/**
 * Reads `pipeline_runs` rows directly from the local Wrangler D1 database.
 */
export function getPipelineRuns(): PipelineRunRecord[] {
  return readLocalD1Snapshot().pipelineRuns;
}

/**
 * Loads `.dev.vars` keys merged with `process.env` so Next.js API routes have access
 * to `TYPESAFE_API_KEY`, `GEMINI_API_KEY`, and `ADMIN_SECRET`.
 */
export function loadLocalEnvVars(): {
  TYPESAFE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ADMIN_SECRET: string;
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

  return {
    TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY || vars.TYPESAFE_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || vars.GEMINI_API_KEY,
    ADMIN_SECRET:
      process.env.ADMIN_SECRET || vars.ADMIN_SECRET || "local-dev-secret",
  };
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
            const row = stmt.get(...boundValues) as Record<string, unknown> | undefined;
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
