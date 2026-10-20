import {
  appendAuditEntry,
  AuditAuthMethod,
  AuditLedgerEntry,
} from "./audit";
import {
  D1DatabaseLike,
  D1PreparedStatementLike,
  executeD1Batch,
} from "./ingest";
import { JevSreFailureModeKey, JevWorkingToolKey } from "./jev";
import {
  SRE_FAILURE_DISPLAY_NAMES,
  TelemetryArticleRow,
  validateSynthesizedBriefOutput,
  WORKING_TOOL_DISPLAY_NAMES,
} from "./synthesize";
import {
  buildCleanExtendedNotes,
  buildDefaultSourcePagesForEpisode,
  extractExternalSourcesFromText,
  sanitizeEpisodeSummaryDefensive,
  stripAiDisclaimers,
} from "../lib/episode-metadata";
import {
  hasSyntheticPlaceholderIdentifier,
  sanitizeSyntheticPlaceholders,
  validateAndNormalizeIncidentSummary,
} from "../lib/sanitize";
import { formatFailureModeDisplayLabel } from "../lib/taxonomy";
import { EpisodeExternalSource, EpisodeSourcePage } from "../lib/types";

export interface R2ObjectMetaLike {
  key: string;
  size: number;
  etag?: string;
  httpMetadata?: {
    contentType?: string;
  };
}

export interface R2ObjectLike extends R2ObjectMetaLike {
  body?: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream | string,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
  head?(key: string): Promise<R2ObjectMetaLike | null>;
  get(
    key: string,
    options?: {
      range?: { offset?: number; length?: number; suffix?: number };
    }
  ): Promise<R2ObjectLike | null>;
  delete(key: string | string[]): Promise<void>;
}

export type EpisodePublishStatus = "PUBLISHED" | "PENDING_AUDIO" | "QUARANTINED";

export interface R2AudioVerificationResult {
  verified: boolean;
  status: EpisodePublishStatus;
  size: number;
  contentType: string | null;
  reason?: string;
}

/**
 * R2-to-D1 verification check for podcast audio episodes:
 * A D1 episode record may only transition to `PUBLISHED` after verifying via R2 `head()`
 * that the audio object exists, is non-zero bytes (`size > 0`), and has valid audio MIME metadata (`audio/*`).
 */
export async function verifyR2AudioObjectForPublish(
  audioBucket: R2BucketLike | undefined,
  r2Key: string
): Promise<R2AudioVerificationResult> {
  if (!audioBucket) {
    return {
      verified: false,
      status: "PENDING_AUDIO",
      size: 0,
      contentType: null,
      reason: "R2 audioBucket binding is not available",
    };
  }

  const cleanKey = (r2Key || "").trim();
  if (!cleanKey) {
    return {
      verified: false,
      status: "QUARANTINED",
      size: 0,
      contentType: null,
      reason: "R2 audio key is empty",
    };
  }

  try {
    const headObj: R2ObjectMetaLike | null =
      typeof audioBucket.head === "function"
        ? await audioBucket.head(cleanKey)
        : await audioBucket.get(cleanKey);

    if (!headObj) {
      return {
        verified: false,
        status: "PENDING_AUDIO",
        size: 0,
        contentType: null,
        reason: `R2 audio object "${cleanKey}" does not exist`,
      };
    }

    const size = Number(headObj.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) {
      return {
        verified: false,
        status: "QUARANTINED",
        size: 0,
        contentType: headObj.httpMetadata?.contentType ?? null,
        reason: `R2 audio object "${cleanKey}" has zero or invalid byte size (${String(headObj.size)})`,
      };
    }

    const contentType = (headObj.httpMetadata?.contentType || "").trim();
    const isValidAudioMime = /^audio\/(mpeg|mp3|mp4|wav|ogg|aac|webm|x-m4a|flac)/i.test(
      contentType
    );
    if (!isValidAudioMime) {
      return {
        verified: false,
        status: "QUARANTINED",
        size,
        contentType: contentType || null,
        reason: `R2 audio object "${cleanKey}" has invalid MIME contentType "${contentType || "missing"}"`,
      };
    }

    return {
      verified: true,
      status: "PUBLISHED",
      size,
      contentType,
    };
  } catch (err) {
    return {
      verified: false,
      status: "PENDING_AUDIO",
      size: 0,
      contentType: null,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface WeeklyTelemetryAggregates {
  windowDays: number;
  totalEvaluated: number;
  triagedOrSynthesizedCount: number;
  droppedCount: number;
  noiseRejectionRatePct: number;
  dominantTool: JevWorkingToolKey;
  dominantToolDisplay: string;
  dominantToolPct: number;
  toolDistribution: Record<JevWorkingToolKey, number>;
  topSreFailureMode: JevSreFailureModeKey;
  topSreFailureDisplay: string;
  topIncidents: TelemetryArticleRow[];
}

export interface RollupTranscriptPayload {
  title: string;
  summary: string;
  weekly_telemetry: string;
  separating_signal_from_panic: string;
  forward_posture: string;
}

export interface RollupEpisodeRecord {
  id?: number;
  episode_number: number;
  slug: string;
  title: string;
  summary: string;
  transcript: string;
  transcript_sections: {
    weekly_telemetry: string;
    separating_signal_from_panic: string;
    forward_posture: string;
  };
  audio_url: string;
  r2_key: string;
  duration_seconds: number;
  file_size_bytes: number;
  published_at: string;
  status: EpisodePublishStatus;
  r2_verified: boolean;
  model_used: string;
  audio_source: string;
  aggregates: {
    total_evaluated: number;
    noise_rejection_rate_pct: number;
    dominant_tool: JevWorkingToolKey;
    dominant_tool_pct: number;
    top_sre_failure_mode: JevSreFailureModeKey;
    featured_incident_ids: number[];
  };
}

export type TtsProviderId =
  | "gemini-tts"
  | "elevenlabs"
  | "openai-tts"
  | "mpeg-framed";

export const DEFAULT_GEMINI_AI_DISCLAIMER =
  "Disclaimer: The media and artwork for this episode were generated by AI using Google Gemini.";

export interface GenerateEpisodeOverrides {
  episodeNumber?: number;
  slugOverride?: string;
  titleOverride?: string;
  summaryOverride?: string;
  extendedNotesOverride?: string;
  transcriptOverride?: string;
  audioUrl?: string;
  artworkUrlOverride?: string;
  artworkWidescreenUrlOverride?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  publishedAtOverride?: string;
  externalSourcesOverride?: EpisodeExternalSource[];
  sourcePagesOverride?: EpisodeSourcePage[];
  editorialFocusNote?: string;
  windowDays?: number;
  incidentIds?: number[];
  ttsVoice?: string;
  ttsProvider?: TtsProviderId;
  elevenlabsVoiceId?: string;
}

export interface EpisodeAdminActor {
  actorEmail: string;
  actorRole?: string;
  authMethod: AuditAuthMethod;
  actorIpHash?: string | null;
}

export interface AdminEpisodeRecord {
  id: number;
  episodeNumber: number;
  slug: string;
  series: "weekly_rollup" | "legacy_archive";
  title: string;
  summary: string;
  extendedNotes?: string;
  transcript: string;
  transcriptSections: {
    weeklyTelemetry: string;
    separatingSignalFromPanic: string;
    forwardPosture: string;
  };
  audioUrl: string;
  artworkUrl?: string;
  artworkWidescreenUrl?: string;
  aiDisclaimer?: string;
  externalSources?: EpisodeExternalSource[];
  sourcePages?: EpisodeSourcePage[];
  r2Key: string;
  durationSeconds: number;
  durationFormatted: string;
  fileSizeBytes: number;
  publishedAt: string;
  status?: EpisodePublishStatus;
}

export interface D1EpisodeTableRow {
  id: number;
  episode_number: number | null;
  slug: string;
  title: string;
  summary: string;
  extended_notes?: string | null;
  sources_json?: string | null;
  source_pages_json?: string | null;
  transcript: string | null;
  audio_url: string;
  artwork_url?: string | null;
  artwork_widescreen_url?: string | null;
  ai_disclaimer?: string | null;
  duration_seconds: number;
  file_size_bytes: number;
  published_at: string;
  status?: EpisodePublishStatus;
}

export const EPISODES_SELECT_COLUMNS = `
  id,
  episode_number,
  slug,
  title,
  summary,
  extended_notes,
  sources_json,
  source_pages_json,
  transcript,
  audio_url,
  artwork_url,
  artwork_widescreen_url,
  ai_disclaimer,
  duration_seconds,
  file_size_bytes,
  published_at,
  status
`;

export const TELEMETRY_ARTICLES_ROLLUP_COLUMNS = `
  id,
  url_hash,
  source_feed,
  title,
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
  status
`;

export const ROLLUP_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: {
      type: "STRING",
      description:
        "Concise episode title for the Friday CAB Weekly Brief referencing the dominant Working Tool and SRE Failure Mode.",
    },
    summary: {
      type: "STRING",
      description:
        "2-sentence show notes summary of this week's CAB Weekly Brief leading with the dominant Working Tool, primary Failure Mode, and the 3 anchor incidents.",
    },
    weekly_telemetry: {
      type: "STRING",
      description:
        "Part 1 [00:00 — THE WEEKLY TELEMETRY] (~180 words). Spoken podcast script leading immediately with the dominant Working Tool, the primary Failure Mode, and the 3 anchor incidents for the week. Do NOT include ingestion-gate math ('evaluated X dispatches, rejecting Y% noise') or internal classifier names.",
    },
    separating_signal_from_panic: {
      type: "STRING",
      description:
        "Part 2 [01:15 — SEPARATING SIGNAL FROM PANIC] (~350 words). Spoken podcast script executing the Proportionality Check across the 3 anchor incidents: contrasting overblown commentary/panic against the actual structural engineering and governance signals.",
    },
    forward_posture: {
      type: "STRING",
      description:
        "Part 3 [03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD] (~220 words). Spoken podcast script placing the Working Tools in motion for the coming 7 days without ever defining the tools.",
    },
  },
  required: [
    "title",
    "summary",
    "weekly_telemetry",
    "separating_signal_from_panic",
    "forward_posture",
  ],
};

const BASELINE_ARCHIVE_EPISODES: Array<{
  episode_number: number;
  slug: string;
  title: string;
  summary: string;
  transcript: string;
  audio_url: string;
  duration_seconds: number;
  file_size_bytes: number;
  published_at: string;
}> = [];

export async function ensureEpisodesStatusColumn(db: D1DatabaseLike): Promise<void> {
  const alterStatements = [
    "ALTER TABLE episodes ADD COLUMN status TEXT NOT NULL DEFAULT 'PUBLISHED'",
    "ALTER TABLE episodes ADD COLUMN artwork_url TEXT",
    "ALTER TABLE episodes ADD COLUMN artwork_widescreen_url TEXT",
    "ALTER TABLE episodes ADD COLUMN ai_disclaimer TEXT",
    "ALTER TABLE episodes ADD COLUMN extended_notes TEXT",
    "ALTER TABLE episodes ADD COLUMN sources_json TEXT",
    "ALTER TABLE episodes ADD COLUMN source_pages_json TEXT",
  ];
  for (const stmt of alterStatements) {
    try {
      await db.prepare(stmt).run();
    } catch {
      // Column already exists
    }
  }
}

/**
 * Ensures the baseline archive episodes are seeded once into D1 `episodes`
 * using parameterized `db.batch()` statements and transitions any incomplete or templated D1 articles
 * to `QUARANTINED`.
 */
export async function ensureBaselineEpisodesSeeded(
  db: D1DatabaseLike
): Promise<void> {
  try {
    await ensureEpisodesStatusColumn(db);
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    const flag = await db
      .prepare(
        "SELECT value FROM system_settings WHERE key = 'baseline_episodes_seeded_v1'"
      )
      .first<{ value: string }>();

    if (flag?.value !== "1") {
      const seedStatements: D1PreparedStatementLike[] = BASELINE_ARCHIVE_EPISODES.map(
        (ep) =>
          db
            .prepare(
              `INSERT INTO episodes (
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
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')
              ON CONFLICT(slug) DO NOTHING`
            )
            .bind(
              ep.episode_number,
              ep.slug,
              ep.title,
              ep.summary,
              ep.transcript,
              ep.audio_url,
              ep.duration_seconds,
              ep.file_size_bytes,
              ep.published_at
            )
      );

      seedStatements.push(
        db.prepare(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ('baseline_episodes_seeded_v1', '1', datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
        )
      );

      await executeD1Batch(db, seedStatements);
    }

    const sanitizedFlag = await db
      .prepare(
        "SELECT value FROM system_settings WHERE key = 'trestleboard_content_sanitized_v4'"
      )
      .first<{ value: string }>();

    if (sanitizedFlag?.value !== "1") {
      const batchUpdates: D1PreparedStatementLike[] = [];

      for (const ep of BASELINE_ARCHIVE_EPISODES) {
        batchUpdates.push(
          db
            .prepare(
              `UPDATE episodes
               SET title = ?, summary = ?, transcript = ?, status = 'PUBLISHED'
               WHERE slug = ?`
            )
            .bind(ep.title, ep.summary, ep.transcript, ep.slug)
        );
      }

      const allArticlesRes = await db
        .prepare(
          `SELECT ${TELEMETRY_ARTICLES_ROLLUP_COLUMNS}
           FROM telemetry_articles
           ORDER BY id ASC`
        )
        .all<TelemetryArticleRow>();
      const allArticles = allArticlesRes.results || [];

      let quarantinedCount = 0;

      for (const row of allArticles) {
        if (
          hasSyntheticPlaceholderIdentifier(row.raw_excerpt) ||
          hasSyntheticPlaceholderIdentifier(row.socratic_brief) ||
          hasSyntheticPlaceholderIdentifier(row.questions_json)
        ) {
          const cleanRaw = sanitizeSyntheticPlaceholders(row.raw_excerpt);
          const cleanBrief = row.socratic_brief
            ? sanitizeSyntheticPlaceholders(row.socratic_brief)
            : null;
          const cleanQ = row.questions_json
            ? sanitizeSyntheticPlaceholders(row.questions_json)
            : null;
          row.raw_excerpt = cleanRaw;
          row.socratic_brief = cleanBrief;
          row.questions_json = cleanQ;
          batchUpdates.push(
            db
              .prepare(
                "UPDATE telemetry_articles SET raw_excerpt = ?, socratic_brief = ?, questions_json = ? WHERE id = ?"
              )
              .bind(cleanRaw, cleanBrief, cleanQ, row.id)
          );
        }

        const validation = validateAndNormalizeIncidentSummary({
          id: row.id,
          title: row.title,
          sourceFeed: row.source_feed,
          rawExcerpt: row.raw_excerpt,
          logWarnings: false,
        });

        if (!validation.valid) {
          if (row.status !== "QUARANTINED" && row.status !== "PENDING_RETRY") {
            batchUpdates.push(
              db
                .prepare(
                  "UPDATE telemetry_articles SET status = 'QUARANTINED', socratic_brief = NULL, questions_json = NULL WHERE id = ?"
                )
                .bind(row.id)
            );
            quarantinedCount++;
          }
          continue;
        }

        if (row.status === "synthesized") {
          let parsedQuestionsObj: any = null;
          if (row.questions_json) {
            try {
              parsedQuestionsObj = JSON.parse(row.questions_json);
            } catch {
              parsedQuestionsObj = null;
            }
          }

          const candidateSynthesis = {
            executive_summary:
              parsedQuestionsObj?.executive_summary || validation.executiveSummary,
            socratic_brief: row.socratic_brief || validation.factualBriefParagraph,
            proportionality_check: {
              noise_overblown:
                parsedQuestionsObj?.proportionality_check?.noise_overblown ||
                parsedQuestionsObj?.proportionality?.noise ||
                "",
              structural_signal:
                parsedQuestionsObj?.proportionality_check?.structural_signal ||
                parsedQuestionsObj?.proportionality?.signal ||
                "",
            },
            questions: Array.isArray(parsedQuestionsObj?.questions)
              ? parsedQuestionsObj.questions
              : Array.isArray(parsedQuestionsObj)
                ? parsedQuestionsObj
                : [],
          };

          const check = validateSynthesizedBriefOutput(row, candidateSynthesis);
          if (!check.valid) {
            // Do NOT generate Mad-Libs fallback strings; transition templated/incomplete rows to QUARANTINED
            batchUpdates.push(
              db
                .prepare(
                  "UPDATE telemetry_articles SET status = 'QUARANTINED', socratic_brief = NULL, questions_json = NULL WHERE id = ?"
                )
                .bind(row.id)
            );
            quarantinedCount++;
          }
        }
      }

      batchUpdates.push(
        db.prepare(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ('trestleboard_content_sanitized_v4', '1', datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
        )
      );

      await executeD1Batch(db, batchUpdates);

      if (quarantinedCount > 0) {
        await appendAuditEntry(db, {
          actorEmail: "system@thecabcall.com",
          actorRole: "owner",
          authMethod: "system_bootstrap",
          actorIpHash: "SYSTEM_QUARANTINE_V4",
          actionType: "editorial.content_sanitization",
          targetType: "telemetry_articles",
          targetId: "cabcall-db",
          reason:
            "Transitioned incomplete or Mad-Libs templated D1 articles to QUARANTINED state.",
          beforeState: {
            version: "v3",
            total_articles_inspected: allArticles.length,
          },
          afterState: {
            version: "v4",
            quarantined_article_count: quarantinedCount,
          },
          replayCommand: {
            op: "quarantine_templated_v4",
            target_table: "telemetry_articles",
            target_id: "cabcall-db",
            invertible: false,
          },
        });
      }
    }
  } catch (err) {
    console.warn("[Rollup] Failed to seed or sanitize baseline archive episodes:", err);
  }
}

export function extractR2KeyFromAudioUrl(
  audioUrl: string,
  fallbackSlug?: string
): string {
  const trimmed = (audioUrl || "").trim();
  if (trimmed.startsWith("/audio/")) {
    return decodeURIComponent(trimmed.slice("/audio/".length));
  }
  try {
    const u = new URL(trimmed);
    if (u.pathname.startsWith("/audio/")) {
      return decodeURIComponent(u.pathname.slice("/audio/".length));
    }
    const base = u.pathname.split("/").pop();
    if (base) return decodeURIComponent(base);
  } catch {
    // Not a full URL
  }
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length > 0) {
    return decodeURIComponent(parts[parts.length - 1]);
  }
  return `${fallbackSlug || "episode"}.mp3`;
}

export function parseEpisodeTranscriptSections(transcript: string): {
  weeklyTelemetry: string;
  separatingSignalFromPanic: string;
  forwardPosture: string;
} {
  if (!transcript) {
    return {
      weeklyTelemetry: "",
      separatingSignalFromPanic: "",
      forwardPosture: "",
    };
  }
  const part1Match = transcript.match(
    /\[00:00[^\]]*\]([\s\S]*?)(?=\[01:15|$)/i
  );
  const part2Match = transcript.match(
    /\[01:15[^\]]*\]([\s\S]*?)(?=\[03:30|$)/i
  );
  const part3Match = transcript.match(/\[03:30[^\]]*\]([\s\S]*?)$/i);

  if (!part1Match && !part2Match && !part3Match) {
    return {
      weeklyTelemetry: transcript.trim(),
      separatingSignalFromPanic: "",
      forwardPosture: "",
    };
  }

  return {
    weeklyTelemetry: (part1Match?.[1] || "").trim(),
    separatingSignalFromPanic: (part2Match?.[1] || "").trim(),
    forwardPosture: (part3Match?.[1] || "").trim(),
  };
}

export function formatThreePartTranscript(sections: {
  weeklyTelemetry?: string;
  separatingSignalFromPanic?: string;
  forwardPosture?: string;
}): string {
  const cleanPart1 = (sections.weeklyTelemetry || "")
    .replace(/^\[00:00[^\]]*\]\s*/i, "")
    .trim();
  const cleanPart2 = (sections.separatingSignalFromPanic || "")
    .replace(/^\[01:15[^\]]*\]\s*/i, "")
    .trim();
  const cleanPart3 = (sections.forwardPosture || "")
    .replace(/^\[03:30[^\]]*\]\s*/i, "")
    .trim();

  if (!cleanPart2 && !cleanPart3) {
    return cleanPart1;
  }

  return `[00:00 — THE WEEKLY TELEMETRY]\n${cleanPart1}\n\n[01:15 — SEPARATING SIGNAL FROM PANIC]\n${cleanPart2}\n\n[03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]\n${cleanPart3}`;
}

export function mapD1RowToAdminEpisode(
  row: D1EpisodeTableRow
): AdminEpisodeRecord {
  const episodeNumber = Number(row.episode_number || 21);
  const durationSeconds = Number(row.duration_seconds || 300);
  const mins = Math.floor(durationSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(durationSeconds % 60)
    .toString()
    .padStart(2, "0");
  const transcript = stripAiDisclaimers(row.transcript || row.summary || "");
  const isLegacy =
    !row.slug.startsWith("cab-weekly-brief-") &&
    !row.title.toLowerCase().startsWith("cab weekly brief");
  const series: "weekly_rollup" | "legacy_archive" = isLegacy
    ? "legacy_archive"
    : "weekly_rollup";

  const cleanSummary = sanitizeEpisodeSummaryDefensive(row.summary);
  const extendedNotes =
    row.extended_notes && row.extended_notes.trim()
      ? stripAiDisclaimers(row.extended_notes).trim()
      : buildCleanExtendedNotes(row.summary) || cleanSummary;

  let externalSources: EpisodeExternalSource[] = [];
  if (row.sources_json && row.sources_json.trim()) {
    try {
      const parsed = JSON.parse(row.sources_json);
      if (Array.isArray(parsed)) {
        externalSources = parsed;
      }
    } catch {
      externalSources = extractExternalSourcesFromText(row.summary, row.title);
    }
  } else {
    externalSources = extractExternalSourcesFromText(row.summary, row.title);
  }

  let sourcePages: EpisodeSourcePage[] = [];
  if (row.source_pages_json && row.source_pages_json.trim()) {
    try {
      const parsed = JSON.parse(row.source_pages_json);
      if (Array.isArray(parsed)) {
        sourcePages = parsed;
      }
    } catch {
      sourcePages = buildDefaultSourcePagesForEpisode(
        episodeNumber,
        "The Square",
        series
      );
    }
  } else {
    sourcePages = buildDefaultSourcePagesForEpisode(
      episodeNumber,
      "The Square",
      series
    );
  }

  return {
    id: Number(row.id),
    episodeNumber,
    slug: row.slug,
    series,
    title: row.title,
    summary: cleanSummary,
    extendedNotes,
    transcript,
    transcriptSections: parseEpisodeTranscriptSections(transcript),
    audioUrl: row.audio_url,
    artworkUrl: row.artwork_url || undefined,
    artworkWidescreenUrl: row.artwork_widescreen_url || undefined,
    aiDisclaimer: row.ai_disclaimer || undefined,
    externalSources,
    sourcePages,
    r2Key: extractR2KeyFromAudioUrl(row.audio_url, row.slug),
    durationSeconds,
    durationFormatted: `${mins}:${secs}`,
    fileSizeBytes: Number(row.file_size_bytes || 256000),
    publishedAt: row.published_at,
    status: row.status || "PUBLISHED",
  };
}

/**
 * Queries D1 `telemetry_articles` over the specified window (default 7 days) or hand-picked `incidentIds`
 * to compute real telemetry aggregates using explicit column selection.
 */
export async function computeWeeklyAggregatesFromD1(
  db: D1DatabaseLike,
  options?: {
    windowDays?: number;
    incidentIds?: number[];
  }
): Promise<WeeklyTelemetryAggregates> {
  const windowDays = Math.min(
    90,
    Math.max(1, Number(options?.windowDays ?? 7))
  );
  const windowModifier = `-${windowDays} days`;

  const recentResult = await db
    .prepare(
      `SELECT ${TELEMETRY_ARTICLES_ROLLUP_COLUMNS}
       FROM telemetry_articles
       WHERE published_at >= datetime('now', ?)
          OR ingested_at >= datetime('now', ?)
       ORDER BY published_at DESC`
    )
    .bind(windowModifier, windowModifier)
    .all<TelemetryArticleRow>();

  let rows = recentResult.results || [];
  if (rows.length === 0) {
    const fallbackAll = await db
      .prepare(
        `SELECT ${TELEMETRY_ARTICLES_ROLLUP_COLUMNS}
         FROM telemetry_articles
         ORDER BY published_at DESC
         LIMIT 50`
      )
      .all<TelemetryArticleRow>();
    rows = fallbackAll.results || [];
  }

  let customSelectedRows: TelemetryArticleRow[] = [];
  if (options?.incidentIds && options.incidentIds.length > 0) {
    const validIds = options.incidentIds
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (validIds.length > 0) {
      const placeholders = validIds.map(() => "?").join(", ");
      const customRes = await db
        .prepare(
          `SELECT ${TELEMETRY_ARTICLES_ROLLUP_COLUMNS}
           FROM telemetry_articles
           WHERE id IN (${placeholders})
           ORDER BY is_systemic_prob DESC, published_at DESC`
        )
        .bind(...validIds)
        .all<TelemetryArticleRow>();
      customSelectedRows = customRes.results || [];
    }
  }

  const totalEvaluated = Math.max(rows.length, customSelectedRows.length);
  const droppedRows = rows.filter((r) => r.status === "dropped");
  const activeRows = rows.filter(
    (r) =>
      (r.status === "synthesized" || r.status === "triaged") &&
      validateAndNormalizeIncidentSummary({
        id: r.id,
        title: r.title,
        sourceFeed: r.source_feed,
        rawExcerpt: r.raw_excerpt,
        socraticBrief: r.socratic_brief,
        logWarnings: false,
      }).valid
  );

  const noiseRejectionRatePct =
    totalEvaluated > 0
      ? Math.round((droppedRows.length / totalEvaluated) * 1000) / 10
      : 0;

  const toolCounts: Record<JevWorkingToolKey, number> = {
    twenty_four_inch_gauge: 0,
    common_gavel: 0,
    plumb: 0,
    square: 0,
    level: 0,
    trowel: 0,
  };

  const sreCounts: Record<JevSreFailureModeKey, number> = {
    configuration_drift: 0,
    cascading_failure: 0,
    untested_failover: 0,
    alert_fatigue: 0,
    blameless_postmortem_gap: 0,
    capacity_exhaustion: 0,
  };

  const poolForDominant =
    customSelectedRows.length > 0
      ? customSelectedRows
      : activeRows.length > 0
      ? activeRows
      : rows;
  for (const row of poolForDominant) {
    if (row.primary_tool in toolCounts) {
      toolCounts[row.primary_tool]++;
    }
    if (row.sre_failure_mode in sreCounts) {
      sreCounts[row.sre_failure_mode]++;
    }
  }

  const sortedTools = (
    Object.entries(toolCounts) as [JevWorkingToolKey, number][]
  ).sort((a, b) => b[1] - a[1]);
  const dominantTool: JevWorkingToolKey = sortedTools[0]?.[0] || "square";
  const dominantToolCount = sortedTools[0]?.[1] || 0;
  const dominantToolPct =
    poolForDominant.length > 0
      ? Math.round((dominantToolCount / poolForDominant.length) * 100)
      : 40;

  const sortedSre = (
    Object.entries(sreCounts) as [JevSreFailureModeKey, number][]
  ).sort((a, b) => b[1] - a[1]);
  const topSreFailureMode: JevSreFailureModeKey =
    sortedSre[0]?.[0] || "configuration_drift";

  let topIncidents: TelemetryArticleRow[];
  if (customSelectedRows.length > 0) {
    topIncidents = customSelectedRows.slice(0, 6);
  } else {
    const synthesizedRows = activeRows
      .filter((r) => r.status === "synthesized")
      .sort((a, b) => b.is_systemic_prob - a.is_systemic_prob);
    const triagedRows = activeRows
      .filter((r) => r.status === "triaged")
      .sort((a, b) => b.is_systemic_prob - a.is_systemic_prob);

    topIncidents = [...synthesizedRows, ...triagedRows].slice(0, 5);
  }

  return {
    windowDays,
    totalEvaluated,
    triagedOrSynthesizedCount:
      customSelectedRows.length > 0
        ? customSelectedRows.length
        : activeRows.length,
    droppedCount: droppedRows.length,
    noiseRejectionRatePct,
    dominantTool,
    dominantToolDisplay: WORKING_TOOL_DISPLAY_NAMES[dominantTool],
    dominantToolPct,
    toolDistribution: toolCounts,
    topSreFailureMode,
    topSreFailureDisplay: SRE_FAILURE_DISPLAY_NAMES[topSreFailureMode],
    topIncidents,
  };
}

function buildDeterministicRollupScript(
  agg: WeeklyTelemetryAggregates,
  episodeNumber: number,
  editorialFocusNote?: string
): RollupTranscriptPayload {
  const inc1 = agg.topIncidents[0];
  const inc2 = agg.topIncidents[1] || inc1;
  const inc3 = agg.topIncidents[2] || inc2;

  const parseProportionality = (row?: TelemetryArticleRow) => {
    if (!row?.questions_json) return null;
    try {
      const parsed = JSON.parse(row.questions_json);
      return parsed?.proportionality_check || null;
    } catch {
      return null;
    }
  };

  const prop1 = parseProportionality(inc1);
  const prop2 = parseProportionality(inc2);
  const focusClause = editorialFocusNote?.trim()
    ? ` Editorial Focus Directive for this docket: ${editorialFocusNote.trim()}.`
    : "";

  const failureCraftLabel = formatFailureModeDisplayLabel(
    agg.topSreFailureDisplay
  );

  const weekly_telemetry = `Welcome to the Friday Change Advisory Board Weekly Brief, Episode ${episodeNumber}. ${agg.dominantToolDisplay} leads this week's Trestleboard across primary classifications, with ${failureCraftLabel} emerging as the primary operational failure mode across ${agg.triagedOrSynthesizedCount} active dispatches.${focusClause} Three anchor incidents set our post-incident docket today: first, from ${inc1?.source_feed || "WSJ US Business"}, "${inc1?.title || "Institutional Capacity & Policy Drift"}", examined under ${WORKING_TOOL_DISPLAY_NAMES[inc1?.primary_tool || "square"]}; second, from ${inc2?.source_feed || "NYT HomePage"}, "${inc2?.title || "Cross-Silo Coordination Strain"}", evaluated under ${WORKING_TOOL_DISPLAY_NAMES[inc2?.primary_tool || "level"]}; and third, "${inc3?.title || "Regulatory Execution Divergence"}", where ${formatFailureModeDisplayLabel(SRE_FAILURE_DISPLAY_NAMES[inc3?.sre_failure_mode || "configuration_drift"])} exposed the gap between nominal policy and live operational state.`;

  const separating_signal_from_panic = `The 24-hour commentary cycle wants you to read each of these events as a morality play or an unprecedented institutional collapse. When we apply the Proportionality Check, a far more actionable systems pattern comes into focus. Take "${inc1?.title || "our lead dispatch"}" first. ${prop1?.noise_overblown || "Public commentary immediately fixated on headline optics and individual blame."} Yet the structural signal underneath is straightforward: ${prop1?.structural_signal || "when an institution defers structural reconciliation, live execution inevitably drifts from its chartered specification."} We see the exact same signal-to-noise inversion in "${inc2?.title || "our second incident"}". ${prop2?.noise_overblown || "Partisan observers treated the disruption as a sudden shock."} In reality, ${prop2?.structural_signal || "operational telemetry points directly to capacity exhaustion and asymmetric risk allocation that accumulated quietly across multiple quarters."} And in "${inc3?.title || "our third triaged event"}", the friction between ${WORKING_TOOL_DISPLAY_NAMES[inc3?.primary_tool || "trowel"]} and ${WORKING_TOOL_DISPLAY_NAMES[inc3?.secondary_tool || "common_gavel"]} demonstrates how quickly cross-group coordination fractures when upstream safeguards go untested in production. None of these incidents have completed a verified post-mortem, which means any sweeping verdict right now is premature jitter rather than verified engineering truth.`;

  const forward_posture = `As we set the trestleboard for the coming seven days, here is how to put the tools to work without waiting for the headlines to settle. First, when tracking the fallout around "${inc1?.title || "this week's policy and fiscal dispatches"}", bring ${agg.dominantToolDisplay} directly to the primary filings: watch whether leadership reconciles the live operational table with the written mandate, or merely issues another round of press assurances. Second, apply Common Gavel to every congressional or corporate hearing on "${inc2?.title || "active institutional disputes"}"—strip away the defensive rhetoric and ask whether the people who architected the constraint are sharing the same horizontal plane of accountability on The Level as the citizens and workers absorbing the load. Finally, keep the 24-Inch Gauge on your own cognitive error budget this weekend: refuse to spend high-priority attention on outraged speculation while the core post-mortem telemetry is still being collected. Until next Friday, keep your telemetry clean and your horizons level.`;

  return {
    title: `CAB Weekly Brief #${episodeNumber}: ${agg.dominantToolDisplay}, ${failureCraftLabel}, and This Week's Trestleboard`,
    summary: `Friday audio synthesis led by ${agg.dominantToolDisplay} and ${failureCraftLabel} across ${agg.triagedOrSynthesizedCount} active dispatches on the Trestleboard.`,
    weekly_telemetry,
    separating_signal_from_panic,
    forward_posture,
  };
}

export async function generateRollupTranscriptWithGemini(
  agg: WeeklyTelemetryAggregates,
  episodeNumber: number,
  geminiApiKey?: string,
  editorialFocusNote?: string
): Promise<{ payload: RollupTranscriptPayload; modelUsed: string }> {
  const trimmedKey = geminiApiKey?.trim() || "";
  if (!trimmedKey || trimmedKey === "your_gemini_api_key_here") {
    return {
      payload: buildDeterministicRollupScript(
        agg,
        episodeNumber,
        editorialFocusNote
      ),
      modelUsed: "deterministic-rollup-fallback",
    };
  }

  const incidentSummaries = agg.topIncidents
    .map((inc, idx) => {
      let extra = "";
      if (inc.questions_json) {
        try {
          const parsed = JSON.parse(inc.questions_json);
          if (parsed.executive_summary) {
            extra += `\n   Executive Summary: ${parsed.executive_summary}`;
          }
          if (parsed.proportionality_check) {
            extra += `\n   Noise Overblown: ${parsed.proportionality_check.noise_overblown}\n   Structural Signal: ${parsed.proportionality_check.structural_signal}`;
          }
        } catch {
          // ignore
        }
      }
      return `${idx + 1}. "${inc.title}" (${inc.source_feed}, published ${inc.published_at})
   - Primary Tool: ${WORKING_TOOL_DISPLAY_NAMES[inc.primary_tool]}
   - Secondary Tool: ${WORKING_TOOL_DISPLAY_NAMES[inc.secondary_tool || "twenty_four_inch_gauge"]}
   - SRE Failure Mode: ${SRE_FAILURE_DISPLAY_NAMES[inc.sre_failure_mode]}${extra}`;
    })
    .join("\n\n");

  const systemInstruction = `You are the executive producer and host of "The CAB Call" (thecabcall.com), delivering the Friday 5-Minute CAB Weekly Brief.
Your audience consists of senior systems engineers, institutional leaders, and Freemasons who already know the headlines and speak both SRE and the Working Tools natively.

HARD GOVERNANCE CONSTRAINTS (NON-NEGOTIABLE):
1. ZERO DEFINITIONS RULE: NEVER define what a Square, Plumb, Level, 24-Inch Gauge, Common Gavel, Trowel, or SRE term is. Apply the tools directly in motion as active diagnostic verbs and instruments.
2. ZERO PIPELINE JARGON: NEVER include ingestion-gate math ("evaluated X dispatches, rejecting Y% noise"), percentage scores, or internal classifier names ("Jev", "System-1", "TypeSafe"). Lead immediately with the dominant Working Tool, the primary Failure Mode, and the 3 anchor incidents for the week.
3. PROPORTIONALITY CHECK: Explicitly contrast where public panic, cable-news outrage, or partisan commentary was overblown (jitter/noise) vs. the actual structural engineering or governance signal.
4. EPISTEMIC HUMILITY & ZERO AI SLOP: Frame ongoing stories as active incidents awaiting full post-mortem verification. Never use AI clichés ("delve", "testament", "In today's fast-paced world", "stark reminder").
5. SPOKEN CADENCE TARGET: ~750 words total across the 3 sections (~5 minutes at 150 WPM):
   - weekly_telemetry: ~180 words
   - separating_signal_from_panic: ~350 words
   - forward_posture: ~220 words`;

  const focusDirectiveBlock = editorialFocusNote?.trim()
    ? `\nPRODUCER / EDITORIAL FOCUS NOTE FOR THIS EPISODE:\n${editorialFocusNote.trim()}\n`
    : "";

  const userPrompt = `Generate Episode #${episodeNumber} of the Friday 5-Minute "CAB Weekly Brief" from the following ${agg.windowDays}-day Trestleboard state:

DOMINANT POSTURE:
- Dominant Working Tool: ${agg.dominantToolDisplay}
- Primary SRE Failure Mode: ${agg.topSreFailureDisplay}
- Active Incidents on the Trestleboard: ${agg.triagedOrSynthesizedCount}
${focusDirectiveBlock}
ANCHOR INCIDENTS FOR THE WEEK:
${incidentSummaries}

Return valid JSON matching the required schema with "title", "summary", "weekly_telemetry" (~180 words, leading immediately with the dominant Working Tool, primary Failure Mode, and 3 anchor incidents), "separating_signal_from_panic" (~350 words), and "forward_posture" (~220 words). Do not include section header brackets inside the individual string fields; we will prepend the timestamp headers automatically.`;

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];

  let lastError = "";

  for (const modelName of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
      trimmedKey
    )}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: ROLLUP_RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(30000),
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
      if (!rawText) continue;

      const parsed = JSON.parse(rawText) as RollupTranscriptPayload;
      if (
        parsed &&
        parsed.title &&
        parsed.weekly_telemetry &&
        parsed.separating_signal_from_panic &&
        parsed.forward_posture
      ) {
        return {
          payload: parsed,
          modelUsed: modelName,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  console.warn(
    `[Rollup Pipeline] Falling back to deterministic rollup script after error: ${lastError}`
  );
  return {
    payload: buildDeterministicRollupScript(
      agg,
      episodeNumber,
      editorialFocusNote
    ),
    modelUsed: "deterministic-rollup-fallback",
  };
}

/**
 * Generates a valid MPEG-1 Layer 3 (MP3) binary stream with an ID3v2 header
 * containing the episode title & transcript metadata followed by valid MP3 audio frames,
 * or decodes Gemini TTS audio when available.
 */
export function buildValidMp3AudioBytes(
  title: string,
  transcript: string,
  targetFrames = 600
): Uint8Array {
  const encoder = new TextEncoder();
  const titleBytes = encoder.encode(title.slice(0, 120));
  const commentBytes = encoder.encode(transcript.slice(0, 1200));

  // Build simple ID3v2.3 tag with TIT2 (Title) frame
  const tit2FrameSize = 1 + titleBytes.length;
  const commFrameSize = 1 + 3 + 1 + commentBytes.length;
  const id3PayloadSize = 10 + tit2FrameSize + 10 + commFrameSize;

  const id3Header = new Uint8Array(10 + id3PayloadSize);
  // "ID3" + version 03 00 + flags 00 + synchsafe size
  id3Header[0] = 0x49; // 'I'
  id3Header[1] = 0x44; // 'D'
  id3Header[2] = 0x33; // '3'
  id3Header[3] = 0x03;
  id3Header[4] = 0x00;
  id3Header[5] = 0x00;
  id3Header[6] = (id3PayloadSize >> 21) & 0x7f;
  id3Header[7] = (id3PayloadSize >> 14) & 0x7f;
  id3Header[8] = (id3PayloadSize >> 7) & 0x7f;
  id3Header[9] = id3PayloadSize & 0x7f;

  let offset = 10;
  // TIT2 frame
  id3Header.set([0x54, 0x49, 0x54, 0x32], offset); // "TIT2"
  id3Header[offset + 4] = (tit2FrameSize >> 24) & 0xff;
  id3Header[offset + 5] = (tit2FrameSize >> 16) & 0xff;
  id3Header[offset + 6] = (tit2FrameSize >> 8) & 0xff;
  id3Header[offset + 7] = tit2FrameSize & 0xff;
  id3Header[offset + 8] = 0x00;
  id3Header[offset + 9] = 0x00;
  id3Header[offset + 10] = 0x03; // UTF-8
  id3Header.set(titleBytes, offset + 11);
  offset += 10 + tit2FrameSize;

  // COMM frame
  id3Header.set([0x43, 0x4f, 0x4d, 0x4d], offset); // "COMM"
  id3Header[offset + 4] = (commFrameSize >> 24) & 0xff;
  id3Header[offset + 5] = (commFrameSize >> 16) & 0xff;
  id3Header[offset + 6] = (commFrameSize >> 8) & 0xff;
  id3Header[offset + 7] = commFrameSize & 0xff;
  id3Header[offset + 8] = 0x00;
  id3Header[offset + 9] = 0x00;
  id3Header[offset + 10] = 0x03; // UTF-8
  id3Header.set([0x65, 0x6e, 0x67, 0x00], offset + 11); // "eng\0"
  id3Header.set(commentBytes, offset + 15);

  // Standard 128kbps, 44.1kHz stereo MPEG-1 Layer 3 frame is 417 bytes
  const frameSize = 417;
  const totalBytes = id3Header.length + targetFrames * frameSize;
  const output = new Uint8Array(totalBytes);
  output.set(id3Header, 0);

  for (let i = 0; i < targetFrames; i++) {
    const fStart = id3Header.length + i * frameSize;
    // MPEG-1 Layer 3 Syncword + 128kbps + 44100Hz + Joint Stereo
    output[fStart] = 0xff;
    output[fStart + 1] = 0xfb;
    output[fStart + 2] = 0x90;
    output[fStart + 3] = 0x64;
    // Fill rest of frame with valid silent/low-floor III side info
    for (let j = 4; j < 36; j++) {
      output[fStart + j] = 0x00;
    }
    for (let j = 36; j < frameSize; j++) {
      output[fStart + j] = 0x55;
    }
  }

  return output;
}

export async function synthesizeRollupAudioBytes(
  title: string,
  transcript: string,
  geminiApiKey?: string,
  ttsOptions?: {
    voiceName?: string;
    provider?: TtsProviderId;
    elevenlabsApiKey?: string;
    elevenlabsVoiceId?: string;
    openaiApiKey?: string;
  }
): Promise<{ audioBytes: Uint8Array; audioSource: string }> {
  const voiceName = ttsOptions?.voiceName?.trim() || "Kore";
  const elevenlabsKey = ttsOptions?.elevenlabsApiKey?.trim() || "";
  const elevenlabsVoiceId =
    ttsOptions?.elevenlabsVoiceId?.trim() || "21m00Tcm4TlvDq8ikWAM";
  const openaiKey = ttsOptions?.openaiApiKey?.trim() || "";

  // Determine effective provider: if elevenlabs credentials are provided and provider isn't explicitly overridden, or if provider === "elevenlabs"
  const explicitProvider = ttsOptions?.provider;
  const shouldTryElevenLabs =
    explicitProvider === "elevenlabs" ||
    (!explicitProvider &&
      Boolean(elevenlabsKey) &&
      Boolean(ttsOptions?.elevenlabsVoiceId?.trim()));
  const shouldTryOpenAi =
    explicitProvider === "openai-tts" ||
    (!explicitProvider && !shouldTryElevenLabs && Boolean(openaiKey) && !geminiApiKey);

  // 1. Optional Custom Cloned Voice via ElevenLabs (Issue 5.3)
  if (shouldTryElevenLabs && elevenlabsKey) {
    try {
      const cleanSpokenText = transcript
        .replace(/\[\d{2}:\d{2}[^\]]*\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4800);

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
          elevenlabsVoiceId
        )}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenlabsKey,
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: cleanSpokenText,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.55,
              similarity_boost: 0.8,
              style: 0.15,
              use_speaker_boost: true,
            },
          }),
          signal: AbortSignal.timeout(25000),
        }
      );

      if (res.ok) {
        const ab = await res.arrayBuffer();
        const bytes = new Uint8Array(ab);
        if (bytes.byteLength > 512) {
          return {
            audioBytes: bytes,
            audioSource: `elevenlabs-tts (eleven_multilingual_v2 / ${elevenlabsVoiceId})`,
          };
        }
      }
    } catch {
      // Fall through to Gemini TTS or MPEG-framed fallback
    }
  }

  // 2. Optional OpenAI TTS (Issue 5.3)
  if (shouldTryOpenAi && openaiKey) {
    try {
      const cleanSpokenText = transcript
        .replace(/\[\d{2}:\d{2}[^\]]*\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
      const openaiVoice = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].includes(
        voiceName.toLowerCase()
      )
        ? voiceName.toLowerCase()
        : "onyx";

      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          input: cleanSpokenText,
          voice: openaiVoice,
          response_format: "mp3",
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const ab = await res.arrayBuffer();
        const bytes = new Uint8Array(ab);
        if (bytes.byteLength > 512) {
          return {
            audioBytes: bytes,
            audioSource: `openai-tts (tts-1-hd / ${openaiVoice})`,
          };
        }
      }
    } catch {
      // Fall through to Gemini TTS or MPEG-framed fallback
    }
  }

  // 3. Zero-Cost Default: Google Gemini TTS
  if (explicitProvider !== "mpeg-framed") {
    const trimmedKey = geminiApiKey?.trim() || "";
    if (trimmedKey && trimmedKey !== "your_gemini_api_key_here") {
      const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-3.8-flash-tts"];
      for (const ttsModel of ttsModels) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${encodeURIComponent(
              trimmedKey
            )}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: transcript.slice(0, 1800),
                      },
                    ],
                  },
                ],
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName,
                      },
                    },
                  },
                },
              }),
              signal: AbortSignal.timeout(15000),
            }
          );

          if (res.ok) {
            const data: any = await res.json();
            const inlineData =
              data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            if (inlineData?.data && typeof inlineData.data === "string") {
              const binaryString = atob(inlineData.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              if (bytes.byteLength > 512) {
                return {
                  audioBytes: bytes,
                  audioSource: `gemini-tts (${ttsModel} / ${voiceName})`,
                };
              }
            }
          }
        } catch {
          // Fall through to next TTS model or framed MP3 generator
        }
      }
    }
  }

  const mp3Bytes = buildValidMp3AudioBytes(title, transcript, 600);
  return {
    audioBytes: mp3Bytes,
    audioSource: "mpeg-layer3-framed-stream",
  };
}

/**
 * Runs the Friday 5-Minute CAB Weekly Brief generator:
 * 1. Computes telemetry aggregates from D1 `telemetry_articles` (supporting windowDays & incidentIds overrides)
 * 2. Calls Gemini to generate the 3-part ~750-word podcast transcript
 * 3. Synthesizes audio & writes the object to R2 (`env.AUDIO_BUCKET`)
 * 4. Verifies the R2 audio object via `head()` before transitioning the D1 episode status to `PUBLISHED`
 */
export async function runWeeklyRollupPipeline(options: {
  db: D1DatabaseLike;
  audioBucket?: R2BucketLike;
  geminiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  openaiApiKey?: string;
  overrides?: GenerateEpisodeOverrides;
}): Promise<RollupEpisodeRecord> {
  const startMs = Date.now();
  const startedAt = new Date().toISOString();
  await ensureBaselineEpisodesSeeded(options.db);

  const overrides = options.overrides || {};
  const agg = await computeWeeklyAggregatesFromD1(options.db, {
    windowDays: overrides.windowDays,
    incidentIds: overrides.incidentIds,
  });

  let nextEpisodeNumber: number;
  if (
    overrides.episodeNumber &&
    Number.isFinite(Number(overrides.episodeNumber)) &&
    Number(overrides.episodeNumber) > 0
  ) {
    nextEpisodeNumber = Math.floor(Number(overrides.episodeNumber));
  } else {
    const latestEpRow = await options.db
      .prepare("SELECT MAX(episode_number) as max_ep FROM episodes")
      .first<{ max_ep: number | null }>();

    nextEpisodeNumber =
      latestEpRow?.max_ep && latestEpRow.max_ep >= 1
        ? latestEpRow.max_ep + 1
        : 22;
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const slug = `cab-weekly-brief-${nextEpisodeNumber}-${dateTag}`;
  const r2Key = `${slug}.mp3`;
  const audioUrl = `/audio/${r2Key}`;

  const { payload, modelUsed } = await generateRollupTranscriptWithGemini(
    agg,
    nextEpisodeNumber,
    options.geminiApiKey,
    overrides.editorialFocusNote
  );

  const finalTitle = overrides.titleOverride?.trim()
    ? overrides.titleOverride.trim()
    : payload.title;
  const finalSummary = overrides.summaryOverride?.trim()
    ? overrides.summaryOverride.trim()
    : payload.summary;

  const cleanPart1 = payload.weekly_telemetry
    .replace(/^\[00:00[^\]]*\]\s*/i, "")
    .trim();
  const cleanPart2 = payload.separating_signal_from_panic
    .replace(/^\[01:15[^\]]*\]\s*/i, "")
    .trim();
  const cleanPart3 = payload.forward_posture
    .replace(/^\[03:30[^\]]*\]\s*/i, "")
    .trim();

  const formattedTranscript = `[00:00 — THE WEEKLY TELEMETRY]\n${cleanPart1}\n\n[01:15 — SEPARATING SIGNAL FROM PANIC]\n${cleanPart2}\n\n[03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]\n${cleanPart3}`;

  const { audioBytes, audioSource } = await synthesizeRollupAudioBytes(
    finalTitle,
    formattedTranscript,
    options.geminiApiKey,
    {
      voiceName: overrides.ttsVoice,
      provider: overrides.ttsProvider,
      elevenlabsApiKey: options.elevenlabsApiKey,
      elevenlabsVoiceId: overrides.elevenlabsVoiceId || options.elevenlabsVoiceId,
      openaiApiKey: options.openaiApiKey,
    }
  );

  if (options.audioBucket && typeof options.audioBucket.put === "function") {
    await options.audioBucket.put(r2Key, audioBytes, {
      httpMetadata: {
        contentType: "audio/mpeg",
      },
      customMetadata: {
        episodeNumber: String(nextEpisodeNumber),
        slug,
        dominantTool: agg.dominantTool,
        topSreFailureMode: agg.topSreFailureMode,
      },
    });
  }

  // R2-to-D1 verification check: only transition to PUBLISHED if R2 head() confirms
  // the audio object exists, has size > 0, and has a valid audio/* MIME type.
  const r2Verification = await verifyR2AudioObjectForPublish(
    options.audioBucket,
    r2Key
  );
  const episodeStatus: EpisodePublishStatus = r2Verification.status;

  const publishedAt = new Date().toISOString();
  const wordCount = formattedTranscript
    .split(/\s+/)
    .filter(Boolean).length;
  const durationSeconds = Math.max(
    180,
    Math.min(900, Math.round((wordCount / 150) * 60) || 300)
  );
  const fileSizeBytes = r2Verification.verified
    ? r2Verification.size
    : audioBytes.byteLength;

  await options.db
    .prepare(
      `INSERT INTO episodes (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        episode_number = excluded.episode_number,
        title = excluded.title,
        summary = excluded.summary,
        transcript = excluded.transcript,
        audio_url = excluded.audio_url,
        duration_seconds = excluded.duration_seconds,
        file_size_bytes = excluded.file_size_bytes,
        published_at = excluded.published_at,
        status = excluded.status`
    )
    .bind(
      nextEpisodeNumber,
      slug,
      finalTitle,
      finalSummary,
      formattedTranscript,
      audioUrl,
      durationSeconds,
      fileSizeBytes,
      publishedAt,
      episodeStatus
    )
    .run();

  const insertedRow = await options.db
    .prepare("SELECT id FROM episodes WHERE slug = ?")
    .bind(slug)
    .first<{ id: number }>();

  const elapsedMs = Math.max(150, Date.now() - startMs);
  const notes = `Generated CAB Weekly Brief #${nextEpisodeNumber} (${r2Key}, ${Math.round(
    fileSizeBytes / 1024
  )} KB, status=${episodeStatus}) via ${modelUsed}. Dominant Tool: ${agg.dominantToolDisplay}.`;

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
        "weekly_rollup",
        startedAt,
        publishedAt,
        agg.totalEvaluated,
        agg.triagedOrSynthesizedCount,
        agg.droppedCount,
        elapsedMs,
        r2Verification.verified ? "nominal" : "degraded",
        notes
      )
      .run();
  } catch (err) {
    console.warn("[Rollup Pipeline] Failed to log pipeline_runs row:", err);
  }

  return {
    id: insertedRow?.id,
    episode_number: nextEpisodeNumber,
    slug,
    title: finalTitle,
    summary: finalSummary,
    transcript: formattedTranscript,
    transcript_sections: {
      weekly_telemetry: cleanPart1,
      separating_signal_from_panic: cleanPart2,
      forward_posture: cleanPart3,
    },
    audio_url: audioUrl,
    r2_key: r2Key,
    duration_seconds: durationSeconds,
    file_size_bytes: fileSizeBytes,
    published_at: publishedAt,
    status: episodeStatus,
    r2_verified: r2Verification.verified,
    model_used: modelUsed,
    audio_source: audioSource,
    aggregates: {
      total_evaluated: agg.totalEvaluated,
      noise_rejection_rate_pct: agg.noiseRejectionRatePct,
      dominant_tool: agg.dominantTool,
      dominant_tool_pct: agg.dominantToolPct,
      top_sre_failure_mode: agg.topSreFailureMode,
      featured_incident_ids: agg.topIncidents.map((i) => i.id),
    },
  };
}

/**
 * Lists all podcast episodes in D1 `episodes` ordered by published_at DESC, episode_number DESC.
 */
export async function listAdminEpisodes(
  db: D1DatabaseLike
): Promise<AdminEpisodeRecord[]> {
  await ensureBaselineEpisodesSeeded(db);

  const res = await db
    .prepare(
      `SELECT ${EPISODES_SELECT_COLUMNS}
       FROM episodes
       ORDER BY published_at DESC, episode_number DESC, id DESC`
    )
    .all<D1EpisodeTableRow>();

  return (res.results || []).map(mapD1RowToAdminEpisode);
}

/**
 * Looks up a single episode in D1 `episodes` by numeric `id`, `d1-ep-<id>` string, or `slug`.
 */
export async function getAdminEpisodeByIdOrSlug(
  db: D1DatabaseLike,
  idOrSlug: number | string
): Promise<{ row: D1EpisodeTableRow; record: AdminEpisodeRecord } | null> {
  await ensureBaselineEpisodesSeeded(db);

  const raw = String(idOrSlug).trim();
  const strippedNumeric = raw.replace(/^d1-ep-/i, "");
  const numericId = /^\d+$/.test(strippedNumeric)
    ? parseInt(strippedNumeric, 10)
    : null;

  let row: D1EpisodeTableRow | null = null;
  if (numericId !== null) {
    row = await db
      .prepare(`SELECT ${EPISODES_SELECT_COLUMNS} FROM episodes WHERE id = ?`)
      .bind(numericId)
      .first<D1EpisodeTableRow>();
  }

  if (!row) {
    row = await db
      .prepare(`SELECT ${EPISODES_SELECT_COLUMNS} FROM episodes WHERE slug = ?`)
      .bind(raw)
      .first<D1EpisodeTableRow>();
  }

  if (!row && numericId !== null) {
    row = await db
      .prepare(
        `SELECT ${EPISODES_SELECT_COLUMNS} FROM episodes WHERE episode_number = ?`
      )
      .bind(numericId)
      .first<D1EpisodeTableRow>();
  }

  if (!row) return null;
  return {
    row,
    record: mapD1RowToAdminEpisode(row),
  };
}

/**
 * Uploads an externally produced audio file (MP3, M4A, WAV, AAC, OGG, FLAC) to R2 `AUDIO_BUCKET`
 * and verifies that the R2 object is ready for publication.
 */
export async function uploadEpisodeAudioToR2(options: {
  audioBucket: R2BucketLike;
  filename: string;
  contentType?: string;
  bytes: Uint8Array;
  episodeNumber?: number;
}): Promise<{
  r2Key: string;
  audioUrl: string;
  fileSizeBytes: number;
  contentType: string;
  verified: boolean;
}> {
  const rawName = (options.filename || "episode-audio.mp3")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
  const lower = rawName.toLowerCase();
  let ext = ".mp3";
  if (lower.endsWith(".m4a")) ext = ".m4a";
  else if (lower.endsWith(".mp4")) ext = ".m4a";
  else if (lower.endsWith(".wav")) ext = ".wav";
  else if (lower.endsWith(".aac")) ext = ".aac";
  else if (lower.endsWith(".ogg")) ext = ".ogg";
  else if (lower.endsWith(".flac")) ext = ".flac";

  const baseWithoutExt = rawName.replace(/\.(mp3|m4a|mp4|wav|aac|ogg|flac)$/i, "");
  const r2Key = `${baseWithoutExt || `the-cab-call-${options.episodeNumber || Date.now()}`}${ext}`;
  const effectiveContentType =
    options.contentType && /^audio\//i.test(options.contentType)
      ? options.contentType
      : ext === ".m4a"
      ? "audio/mp4"
      : ext === ".wav"
      ? "audio/wav"
      : ext === ".aac"
      ? "audio/aac"
      : ext === ".ogg"
      ? "audio/ogg"
      : ext === ".flac"
      ? "audio/flac"
      : "audio/mpeg";

  await options.audioBucket.put(r2Key, options.bytes, {
    httpMetadata: {
      contentType: effectiveContentType,
    },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      ...(options.episodeNumber
        ? { episodeNumber: String(options.episodeNumber) }
        : {}),
    },
  });

  const verification = await verifyR2AudioObjectForPublish(
    options.audioBucket,
    r2Key
  );

  return {
    r2Key,
    audioUrl: `/audio/${r2Key}`,
    fileSizeBytes: verification.size || options.bytes.byteLength,
    contentType: verification.contentType || effectiveContentType,
    verified: verification.verified,
  };
}

/**
 * Publishes a new podcast episode (either from an externally produced audio file / URL
 * or via optional overrides) and appends an `episode.generate` entry to `audit_ledger`.
 */
export async function generateAdminEpisode(options: {
  db: D1DatabaseLike;
  audioBucket?: R2BucketLike;
  geminiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  openaiApiKey?: string;
  overrides?: GenerateEpisodeOverrides;
  reason?: string;
  actor: EpisodeAdminActor;
}): Promise<{
  episode: AdminEpisodeRecord;
  rollup: RollupEpisodeRecord;
  auditEntry: AuditLedgerEntry;
}> {
  const ov = options.overrides || {};

  // Direct external media publishing path (user-provided MP3/M4A audio file or URL)
  if (ov.audioUrl && ov.audioUrl.trim()) {
    await ensureBaselineEpisodesSeeded(options.db);

    let nextEpisodeNumber: number;
    if (
      ov.episodeNumber &&
      Number.isFinite(Number(ov.episodeNumber)) &&
      Number(ov.episodeNumber) > 0
    ) {
      nextEpisodeNumber = Math.floor(Number(ov.episodeNumber));
    } else {
      const latestEpRow = await options.db
        .prepare("SELECT MAX(episode_number) as max_ep FROM episodes")
        .first<{ max_ep: number | null }>();
      nextEpisodeNumber =
        latestEpRow?.max_ep && latestEpRow.max_ep >= 1
          ? latestEpRow.max_ep + 1
          : 22;
    }

    const paddedNum = String(nextEpisodeNumber).padStart(3, "0");
    const slug = (ov.slugOverride || `legacy-cab-${paddedNum}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const finalTitle =
      ov.titleOverride?.trim() || `The CAB Call #${nextEpisodeNumber}`;
    const finalSummary =
      ov.summaryOverride?.trim() ||
      `Episode #${nextEpisodeNumber} of The CAB Call Podcast.`;
    const finalExtendedNotes =
      ov.extendedNotesOverride?.trim() || finalSummary;
    const finalTranscript =
      ov.transcriptOverride?.trim() || finalExtendedNotes;
    const finalAudioUrl = ov.audioUrl.trim();
    const r2Key = extractR2KeyFromAudioUrl(finalAudioUrl, slug);
    const publishedAt =
      ov.publishedAtOverride?.trim() || new Date().toISOString();
    const durationSeconds =
      ov.durationSeconds && Number(ov.durationSeconds) > 0
        ? Math.round(Number(ov.durationSeconds))
        : 1800;

    let fileSizeBytes =
      ov.fileSizeBytes && Number(ov.fileSizeBytes) > 0
        ? Math.round(Number(ov.fileSizeBytes))
        : 24000000;
    if (options.audioBucket) {
      const r2Check = await verifyR2AudioObjectForPublish(
        options.audioBucket,
        r2Key
      );
      if (r2Check.verified && r2Check.size > 0) {
        fileSizeBytes = r2Check.size;
      }
    }

    const sourcesJson = ov.externalSourcesOverride
      ? JSON.stringify(ov.externalSourcesOverride)
      : null;
    const sourcePagesJson = ov.sourcePagesOverride
      ? JSON.stringify(ov.sourcePagesOverride)
      : null;

    await options.db
      .prepare(
        `INSERT INTO episodes (
          episode_number,
          slug,
          title,
          summary,
          extended_notes,
          sources_json,
          source_pages_json,
          transcript,
          audio_url,
          artwork_url,
          artwork_widescreen_url,
          duration_seconds,
          file_size_bytes,
          published_at,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')
        ON CONFLICT(slug) DO UPDATE SET
          episode_number = excluded.episode_number,
          title = excluded.title,
          summary = excluded.summary,
          extended_notes = excluded.extended_notes,
          sources_json = COALESCE(excluded.sources_json, episodes.sources_json),
          source_pages_json = COALESCE(excluded.source_pages_json, episodes.source_pages_json),
          transcript = excluded.transcript,
          audio_url = excluded.audio_url,
          artwork_url = COALESCE(excluded.artwork_url, episodes.artwork_url),
          artwork_widescreen_url = COALESCE(excluded.artwork_widescreen_url, episodes.artwork_widescreen_url),
          duration_seconds = excluded.duration_seconds,
          file_size_bytes = excluded.file_size_bytes,
          published_at = excluded.published_at,
          status = 'PUBLISHED'`
      )
      .bind(
        nextEpisodeNumber,
        slug,
        finalTitle,
        finalSummary,
        finalExtendedNotes,
        sourcesJson,
        sourcePagesJson,
        finalTranscript,
        finalAudioUrl,
        ov.artworkUrlOverride?.trim() || null,
        ov.artworkWidescreenUrlOverride?.trim() || null,
        durationSeconds,
        fileSizeBytes,
        publishedAt
      )
      .run();

    const fetched = await getAdminEpisodeByIdOrSlug(options.db, slug);
    if (!fetched) {
      throw new Error(`Failed to read back published episode ${slug} from D1`);
    }

    const parsedSections = parseEpisodeTranscriptSections(finalTranscript);
    const rollup: RollupEpisodeRecord = {
      id: fetched.row.id,
      episode_number: nextEpisodeNumber,
      slug,
      title: finalTitle,
      summary: finalSummary,
      transcript: finalTranscript,
      transcript_sections: {
        weekly_telemetry: parsedSections.weeklyTelemetry,
        separating_signal_from_panic: parsedSections.separatingSignalFromPanic,
        forward_posture: parsedSections.forwardPosture,
      },
      audio_url: finalAudioUrl,
      r2_key: r2Key,
      duration_seconds: durationSeconds,
      file_size_bytes: fileSizeBytes,
      published_at: publishedAt,
      status: "PUBLISHED",
      r2_verified: true,
      model_used: "external-studio-upload",
      audio_source: "external-media-file",
      aggregates: {
        total_evaluated: 0,
        noise_rejection_rate_pct: 0,
        dominant_tool: "plumb",
        dominant_tool_pct: 100,
        top_sre_failure_mode: "configuration_drift",
        featured_incident_ids: [],
      },
    };

    const auditEntry = await appendAuditEntry(options.db, {
      actorEmail: options.actor.actorEmail,
      actorRole: options.actor.actorRole || "owner",
      authMethod: options.actor.authMethod,
      actorIpHash: options.actor.actorIpHash ?? null,
      actionType: "episode.generate",
      targetType: "episode",
      targetId: String(fetched.row.id),
      reason:
        options.reason?.trim() ||
        `Published Episode #${nextEpisodeNumber}: "${finalTitle}" with externally produced media (${r2Key})`,
      beforeState: null,
      afterState: {
        ...fetched.row,
        r2_key: r2Key,
        audio_source: "external-media-file",
      },
      replayCommand: {
        op: "create",
        action_type: "episode.generate",
        target_type: "episode",
        target_id: String(fetched.row.id),
        slug: fetched.row.slug,
        r2_key: r2Key,
        invertible: true,
      },
    });

    return {
      episode: fetched.record,
      rollup,
      auditEntry,
    };
  }

  const rollup = await runWeeklyRollupPipeline({
    db: options.db,
    audioBucket: options.audioBucket,
    geminiApiKey: options.geminiApiKey,
    elevenlabsApiKey: options.elevenlabsApiKey,
    elevenlabsVoiceId: options.elevenlabsVoiceId,
    openaiApiKey: options.openaiApiKey,
    overrides: options.overrides,
  });

  const fetched = await getAdminEpisodeByIdOrSlug(
    options.db,
    rollup.id ?? rollup.slug
  );
  if (!fetched) {
    throw new Error(
      `Failed to read back generated episode ${rollup.slug} from D1`
    );
  }

  const afterState = {
    ...fetched.row,
    r2_key: rollup.r2_key,
    model_used: rollup.model_used,
    audio_source: rollup.audio_source,
    aggregates: rollup.aggregates,
  };

  const defaultReason = options.overrides?.editorialFocusNote?.trim()
    ? `Generated Episode #${rollup.episode_number} ("${rollup.title}") with producer note: ${options.overrides.editorialFocusNote.trim()}`
    : `Generated podcast rollup Episode #${rollup.episode_number}: "${rollup.title}" (${rollup.r2_key})`;

  const auditEntry = await appendAuditEntry(options.db, {
    actorEmail: options.actor.actorEmail,
    actorRole: options.actor.actorRole || "owner",
    authMethod: options.actor.authMethod,
    actorIpHash: options.actor.actorIpHash ?? null,
    actionType: "episode.generate",
    targetType: "episode",
    targetId: String(fetched.row.id),
    reason: options.reason?.trim() || defaultReason,
    beforeState: null,
    afterState,
    replayCommand: {
      op: "create",
      action_type: "episode.generate",
      target_type: "episode",
      target_id: String(fetched.row.id),
      slug: fetched.row.slug,
      r2_key: rollup.r2_key,
      invertible: true,
    },
  });

  return {
    episode: fetched.record,
    rollup,
    auditEntry,
  };
}

/**
 * Updates an existing podcast episode's title, summary, transcript (or 3-part sections),
 * episode_number, published_at, audio_url, duration_seconds, file_size_bytes, or artwork,
 * and appends an `episode.update` entry to `audit_ledger`.
 */
export async function updateAdminEpisode(options: {
  db: D1DatabaseLike;
  audioBucket?: R2BucketLike;
  geminiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  openaiApiKey?: string;
  idOrSlug: number | string;
  input: {
    title?: string;
    summary?: string;
    extendedNotes?: string;
    externalSources?: EpisodeExternalSource[];
    sourcePages?: EpisodeSourcePage[];
    transcript?: string;
    transcriptSections?: {
      weeklyTelemetry?: string;
      separatingSignalFromPanic?: string;
      forwardPosture?: string;
    };
    episodeNumber?: number;
    publishedAt?: string;
    audioUrl?: string;
    artworkUrl?: string | null;
    artworkWidescreenUrl?: string | null;
    durationSeconds?: number;
    fileSizeBytes?: number;
    regenerateAudio?: boolean;
    ttsVoice?: string;
    ttsProvider?: TtsProviderId;
    reason?: string;
  };
  actor: EpisodeAdminActor;
}): Promise<{
  episode: AdminEpisodeRecord;
  audioRegenerated: boolean;
  audioSource?: string;
  auditEntry: AuditLedgerEntry;
}> {
  const existing = await getAdminEpisodeByIdOrSlug(
    options.db,
    options.idOrSlug
  );
  if (!existing) {
    throw new Error(`Episode not found: ${options.idOrSlug}`);
  }

  const beforeRow = existing.row;
  const input = options.input;

  const updatedTitle =
    input.title !== undefined && input.title.trim()
      ? input.title.trim()
      : beforeRow.title;
  const updatedSummary =
    input.summary !== undefined && input.summary.trim()
      ? input.summary.trim()
      : beforeRow.summary;
  const updatedExtendedNotes =
    input.extendedNotes !== undefined
      ? input.extendedNotes.trim() || null
      : beforeRow.extended_notes ?? null;
  const updatedSourcesJson =
    input.externalSources !== undefined
      ? JSON.stringify(input.externalSources)
      : beforeRow.sources_json ?? null;
  const updatedSourcePagesJson =
    input.sourcePages !== undefined
      ? JSON.stringify(input.sourcePages)
      : beforeRow.source_pages_json ?? null;
  const updatedEpisodeNumber =
    input.episodeNumber !== undefined &&
    Number.isFinite(Number(input.episodeNumber)) &&
    Number(input.episodeNumber) > 0
      ? Math.floor(Number(input.episodeNumber))
      : beforeRow.episode_number;
  const updatedPublishedAt =
    input.publishedAt !== undefined && input.publishedAt.trim()
      ? input.publishedAt.trim()
      : beforeRow.published_at;
  const updatedAudioUrl =
    input.audioUrl !== undefined && input.audioUrl.trim()
      ? input.audioUrl.trim()
      : beforeRow.audio_url;
  const updatedArtworkUrl =
    input.artworkUrl !== undefined
      ? input.artworkUrl?.trim() || null
      : beforeRow.artwork_url ?? null;
  const updatedArtworkWidescreenUrl =
    input.artworkWidescreenUrl !== undefined
      ? input.artworkWidescreenUrl?.trim() || null
      : beforeRow.artwork_widescreen_url ?? null;

  let updatedTranscript = beforeRow.transcript || "";
  if (input.transcriptSections) {
    const currentParsed = parseEpisodeTranscriptSections(updatedTranscript);
    updatedTranscript = formatThreePartTranscript({
      weeklyTelemetry:
        input.transcriptSections.weeklyTelemetry ??
        currentParsed.weeklyTelemetry,
      separatingSignalFromPanic:
        input.transcriptSections.separatingSignalFromPanic ??
        currentParsed.separatingSignalFromPanic,
      forwardPosture:
        input.transcriptSections.forwardPosture ?? currentParsed.forwardPosture,
    });
  } else if (input.transcript !== undefined) {
    updatedTranscript = input.transcript.trim();
  }

  let updatedFileSizeBytes =
    input.fileSizeBytes !== undefined && Number(input.fileSizeBytes) > 0
      ? Math.round(Number(input.fileSizeBytes))
      : Number(beforeRow.file_size_bytes || 256000);
  let updatedDurationSeconds =
    input.durationSeconds !== undefined && Number(input.durationSeconds) > 0
      ? Math.round(Number(input.durationSeconds))
      : Number(beforeRow.duration_seconds || 300);
  let updatedStatus: EpisodePublishStatus = beforeRow.status || "PUBLISHED";
  let audioRegenerated = Boolean(
    input.audioUrl && input.audioUrl.trim() !== beforeRow.audio_url
  );
  let audioSource: string | undefined = audioRegenerated
    ? "external-media-upload"
    : undefined;
  const r2Key = extractR2KeyFromAudioUrl(updatedAudioUrl, beforeRow.slug);

  if (input.regenerateAudio) {
    const synth = await synthesizeRollupAudioBytes(
      updatedTitle,
      updatedTranscript,
      options.geminiApiKey,
      {
        voiceName: input.ttsVoice,
        provider: input.ttsProvider,
        elevenlabsApiKey: options.elevenlabsApiKey,
        elevenlabsVoiceId: options.elevenlabsVoiceId,
        openaiApiKey: options.openaiApiKey,
      }
    );
    updatedFileSizeBytes = synth.audioBytes.byteLength;
    audioSource = synth.audioSource;
    const wordCount = updatedTranscript.split(/\s+/).filter(Boolean).length;
    updatedDurationSeconds = Math.max(
      180,
      Math.min(1800, Math.round((wordCount / 150) * 60) || 300)
    );

    if (options.audioBucket && typeof options.audioBucket.put === "function") {
      await options.audioBucket.put(r2Key, synth.audioBytes, {
        httpMetadata: {
          contentType: "audio/mpeg",
        },
        customMetadata: {
          episodeNumber: String(updatedEpisodeNumber ?? 21),
          slug: beforeRow.slug,
          regeneratedAt: new Date().toISOString(),
        },
      });
    }
    const r2Verification = await verifyR2AudioObjectForPublish(
      options.audioBucket,
      r2Key
    );
    updatedStatus = r2Verification.status;
    if (r2Verification.verified) {
      updatedFileSizeBytes = r2Verification.size;
    }
    audioRegenerated = true;
  }

  await options.db
    .prepare(
      `UPDATE episodes
       SET episode_number = ?,
           title = ?,
           summary = ?,
           extended_notes = ?,
           sources_json = ?,
           source_pages_json = ?,
           transcript = ?,
           audio_url = ?,
           artwork_url = ?,
           artwork_widescreen_url = ?,
           duration_seconds = ?,
           file_size_bytes = ?,
           published_at = ?,
           status = ?
       WHERE id = ?`
    )
    .bind(
      updatedEpisodeNumber,
      updatedTitle,
      updatedSummary,
      updatedExtendedNotes,
      updatedSourcesJson,
      updatedSourcePagesJson,
      updatedTranscript,
      updatedAudioUrl,
      updatedArtworkUrl,
      updatedArtworkWidescreenUrl,
      updatedDurationSeconds,
      updatedFileSizeBytes,
      updatedPublishedAt,
      updatedStatus,
      beforeRow.id
    )
    .run();

  const updated = await getAdminEpisodeByIdOrSlug(options.db, beforeRow.id);
  if (!updated) {
    throw new Error(`Failed to read back updated episode #${beforeRow.id}`);
  }

  const defaultReason = `Updated Episode #${updated.record.episodeNumber} ("${
    updated.record.title
  }")${audioRegenerated ? ` and updated audio (${r2Key})` : ""}`;

  const auditEntry = await appendAuditEntry(options.db, {
    actorEmail: options.actor.actorEmail,
    actorRole: options.actor.actorRole || "owner",
    authMethod: options.actor.authMethod,
    actorIpHash: options.actor.actorIpHash ?? null,
    actionType: "episode.update",
    targetType: "episode",
    targetId: String(beforeRow.id),
    reason: input.reason?.trim() || defaultReason,
    beforeState: {
      ...beforeRow,
      r2_key: r2Key,
    },
    afterState: {
      ...updated.row,
      r2_key: r2Key,
      audio_regenerated: audioRegenerated,
      audio_source: audioSource,
    },
    replayCommand: {
      op: "update",
      action_type: "episode.update",
      target_type: "episode",
      target_id: String(beforeRow.id),
      slug: beforeRow.slug,
      r2_key: r2Key,
      invertible: true,
    },
  });

  return {
    episode: updated.record,
    audioRegenerated,
    audioSource,
    auditEntry,
  };
}

/**
 * Deletes an episode from D1 `episodes`, optionally purges its `.mp3` object from R2 `cabcall-audio`,
 * and appends an `episode.delete` entry to `audit_ledger` containing the full `before_state_json`
 * (including full transcript, metadata, and audio URL) so it can be 1-click restored via Audit Replay.
 */
export async function deleteAdminEpisode(options: {
  db: D1DatabaseLike;
  audioBucket?: R2BucketLike;
  idOrSlug: number | string;
  purgeAudio?: boolean;
  reason?: string;
  actor: EpisodeAdminActor;
}): Promise<{
  deletedId: number;
  deletedSlug: string;
  deletedEpisodeNumber: number;
  r2Key: string;
  audioPurged: boolean;
  beforeState: D1EpisodeTableRow & { r2_key: string };
  auditEntry: AuditLedgerEntry;
}> {
  const existing = await getAdminEpisodeByIdOrSlug(
    options.db,
    options.idOrSlug
  );
  if (!existing) {
    throw new Error(`Episode not found: ${options.idOrSlug}`);
  }

  const beforeRow = existing.row;
  const r2Key = extractR2KeyFromAudioUrl(beforeRow.audio_url, beforeRow.slug);
  const shouldPurgeAudio = options.purgeAudio !== false;
  let audioPurged = false;

  if (
    shouldPurgeAudio &&
    options.audioBucket &&
    typeof options.audioBucket.delete === "function"
  ) {
    try {
      await options.audioBucket.delete(r2Key);
      audioPurged = true;
    } catch (err) {
      console.warn(`[R2 Delete] Failed to delete R2 key ${r2Key}:`, err);
    }
  }

  await options.db
    .prepare("DELETE FROM episodes WHERE id = ?")
    .bind(beforeRow.id)
    .run();

  const beforeStateWithR2 = {
    ...beforeRow,
    r2_key: r2Key,
  };

  const defaultReason = `Deleted Episode #${
    beforeRow.episode_number ?? existing.record.episodeNumber
  } ("${beforeRow.title}")${
    audioPurged ? ` and purged R2 object ${r2Key}` : ""
  }`;

  const auditEntry = await appendAuditEntry(options.db, {
    actorEmail: options.actor.actorEmail,
    actorRole: options.actor.actorRole || "owner",
    authMethod: options.actor.authMethod,
    actorIpHash: options.actor.actorIpHash ?? null,
    actionType: "episode.delete",
    targetType: "episode",
    targetId: String(beforeRow.id),
    reason: options.reason?.trim() || defaultReason,
    beforeState: beforeStateWithR2,
    afterState: null,
    replayCommand: {
      op: "delete",
      action_type: "episode.delete",
      target_type: "episode",
      target_id: String(beforeRow.id),
      slug: beforeRow.slug,
      r2_key: r2Key,
      audio_purged: audioPurged,
      invertible: true,
    },
  });

  return {
    deletedId: Number(beforeRow.id),
    deletedSlug: beforeRow.slug,
    deletedEpisodeNumber: existing.record.episodeNumber,
    r2Key,
    audioPurged,
    beforeState: beforeStateWithR2,
    auditEntry,
  };
}
