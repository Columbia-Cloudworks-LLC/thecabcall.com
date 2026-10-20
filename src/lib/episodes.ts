import { revalidatePath } from "next/cache";
import {
  createLocalR2AudioAdapter,
  createLocalSqliteD1Adapter,
  ensureD1Snapshot,
  getEffectiveWorkerUrl,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
} from "./d1-bridge";
import { AuditLedgerEntry } from "@/pipeline/audit";
import {
  AdminEpisodeRecord,
  D1EpisodeTableRow,
  deleteAdminEpisode,
  EpisodeAdminActor,
  generateAdminEpisode,
  GenerateEpisodeOverrides,
  getAdminEpisodeByIdOrSlug,
  listAdminEpisodes,
  RollupEpisodeRecord,
  updateAdminEpisode,
  uploadEpisodeAudioToR2,
} from "@/pipeline/rollup";
import {
  TELEMETRY_ARTICLES_SYNTHESIS_COLUMNS,
  TelemetryArticleRow,
} from "@/pipeline/synthesize";

export * from "@/pipeline/rollup";

function buildAdminHeaders(actor?: EpisodeAdminActor): Record<string, string> {
  const envVars = loadLocalEnvVars();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-admin-secret": envVars.ADMIN_SECRET,
  };
  if (actor?.actorEmail) {
    headers["x-actor-email"] = actor.actorEmail;
  }
  if (actor?.actorRole) {
    headers["x-actor-role"] = actor.actorRole;
  }
  if (actor?.authMethod) {
    headers["x-actor-auth-method"] = actor.authMethod;
  }
  return headers;
}

export function invalidateEpisodePublicCaches(): void {
  try {
    revalidatePath("/archive");
    revalidatePath("/podcast");
    revalidatePath("/feed.xml");
    revalidatePath("/");
    revalidatePath("/admin/episodes");
    revalidatePath("/admin");
  } catch {
    // revalidatePath may throw outside Next.js request context
  }
}

/**
 * Fetches all live D1 episodes and candidate synthesized/triaged incidents via remote Worker or local D1.
 */
export async function getAdminEpisodesAndCandidatesBridge(): Promise<{
  episodes: AdminEpisodeRecord[];
  candidateIncidents: TelemetryArticleRow[];
}> {
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(`${workerUrl}/api/admin/episodes`, {
        method: "GET",
        headers: buildAdminHeaders(),
        cache: "no-store",
      });

      if (response.ok) {
        const data = (await response.json()) as {
          ok?: boolean;
          episodes?: AdminEpisodeRecord[];
          candidateIncidents?: TelemetryArticleRow[];
        };
        if (Array.isArray(data.episodes)) {
          return {
            episodes: data.episodes,
            candidateIncidents: Array.isArray(data.candidateIncidents)
              ? data.candidateIncidents
              : [],
          };
        }
      }
    } catch {
      // Fallback to local SQLite
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return {
      episodes: [],
      candidateIncidents: [],
    };
  }

  const [episodes, candidateRes] = await Promise.all([
    listAdminEpisodes(db),
    db
      .prepare(
        `SELECT ${TELEMETRY_ARTICLES_SYNTHESIS_COLUMNS}
         FROM telemetry_articles
         WHERE status IN ('synthesized', 'triaged')
         ORDER BY
           CASE WHEN status = 'synthesized' THEN 0 ELSE 1 END,
           is_systemic_prob DESC,
           published_at DESC
         LIMIT 40`
      )
      .all<TelemetryArticleRow>(),
  ]);

  return {
    episodes,
    candidateIncidents: candidateRes.results || [],
  };
}

/**
 * Fetches a single episode by ID or slug via remote Worker or local D1.
 */
export async function getAdminEpisodeByIdBridge(
  idOrSlug: number | string
): Promise<AdminEpisodeRecord | null> {
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(
        `${workerUrl}/api/admin/episodes/${encodeURIComponent(
          String(idOrSlug)
        )}`,
        {
          method: "GET",
          headers: buildAdminHeaders(),
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          ok?: boolean;
          episode?: AdminEpisodeRecord;
        };
        if (data.episode) {
          return data.episode;
        }
      }
    } catch {
      // Fallback to local SQLite
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) return null;
  const found = await getAdminEpisodeByIdOrSlug(db, idOrSlug);
  return found?.record || null;
}

/**
 * Generates a new podcast episode on-demand with optional overrides, logs `episode.generate`
 * in `audit_ledger`, and immediately invalidates `/archive` and `/feed.xml` caches.
 */
export async function generateAdminEpisodeBridge(
  overrides: GenerateEpisodeOverrides,
  reason: string | undefined,
  actor: EpisodeAdminActor
): Promise<{
  episode: AdminEpisodeRecord;
  rollup: RollupEpisodeRecord;
  auditEntry: AuditLedgerEntry;
  episodes: AdminEpisodeRecord[];
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/episodes/generate`, {
      method: "POST",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        ...overrides,
        reason,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      episode?: AdminEpisodeRecord;
      rollup?: RollupEpisodeRecord;
      auditEntry?: AuditLedgerEntry;
      episodes?: AdminEpisodeRecord[];
    };

    if (
      !response.ok ||
      !data.ok ||
      !data.episode ||
      !data.rollup ||
      !data.auditEntry
    ) {
      throw new Error(
        data.error ||
          `Worker /api/admin/episodes/generate failed (${response.status})`
      );
    }

    await ensureD1Snapshot(true);
    invalidateEpisodePublicCaches();

    return {
      episode: data.episode,
      rollup: data.rollup,
      auditEntry: data.auditEntry,
      episodes: data.episodes || [data.episode],
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const envVars = loadLocalEnvVars();
  const audioBucket = createLocalR2AudioAdapter();

  const res = await generateAdminEpisode({
    db,
    audioBucket,
    geminiApiKey: envVars.GEMINI_API_KEY,
    overrides,
    reason,
    actor,
  });
  const episodes = await listAdminEpisodes(db);
  await ensureD1Snapshot(true);
  invalidateEpisodePublicCaches();

  return { ...res, episodes };
}

/**
 * Updates an existing episode (title, summary, extended_notes, sources_json, 3-part transcript, episode_number, published_at,
 * and optional R2 audio re-synthesis), logs `episode.update` in `audit_ledger`, and invalidates caches.
 */
export async function updateAdminEpisodeBridge(
  idOrSlug: number | string,
  input: {
    title?: string;
    summary?: string;
    extendedNotes?: string;
    externalSources?: import("./types").EpisodeExternalSource[];
    sourcePages?: import("./types").EpisodeSourcePage[];
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
    ttsProvider?: "gemini-tts" | "elevenlabs" | "openai-tts" | "mpeg-framed";
    reason?: string;
  },
  actor: EpisodeAdminActor
): Promise<{
  episode: AdminEpisodeRecord;
  audioRegenerated: boolean;
  audioSource?: string;
  auditEntry: AuditLedgerEntry;
  episodes: AdminEpisodeRecord[];
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(
      `${workerUrl}/api/admin/episodes/${encodeURIComponent(String(idOrSlug))}`,
      {
        method: "PUT",
        headers: buildAdminHeaders(actor),
        body: JSON.stringify({
          id: idOrSlug,
          ...input,
          actorEmail: actor.actorEmail,
          actorRole: actor.actorRole,
          authMethod: actor.authMethod,
        }),
        cache: "no-store",
      }
    );

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      episode?: AdminEpisodeRecord;
      audioRegenerated?: boolean;
      audioSource?: string;
      auditEntry?: AuditLedgerEntry;
      episodes?: AdminEpisodeRecord[];
    };

    if (!response.ok || !data.ok || !data.episode || !data.auditEntry) {
      throw new Error(
        data.error ||
          `Worker /api/admin/episodes PUT failed (${response.status})`
      );
    }

    await ensureD1Snapshot(true);
    invalidateEpisodePublicCaches();

    return {
      episode: data.episode,
      audioRegenerated: Boolean(data.audioRegenerated),
      audioSource: data.audioSource,
      auditEntry: data.auditEntry,
      episodes: data.episodes || [data.episode],
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const envVars = loadLocalEnvVars();
  const audioBucket = createLocalR2AudioAdapter();

  const res = await updateAdminEpisode({
    db,
    audioBucket,
    geminiApiKey: envVars.GEMINI_API_KEY,
    idOrSlug,
    input,
    actor,
  });
  const episodes = await listAdminEpisodes(db);
  await ensureD1Snapshot(true);
  invalidateEpisodePublicCaches();

  return { ...res, episodes };
}

/**
 * Uploads an externally produced audio file (MP3, M4A, WAV, AAC, OGG, FLAC) to R2 `cabcall-audio`
 * via remote Worker or local R2 adapter.
 */
export async function uploadEpisodeAudioBridge(
  options: {
    filename: string;
    contentType?: string;
    bytes: Uint8Array;
    episodeNumber?: number;
  },
  actor?: EpisodeAdminActor
): Promise<{
  r2Key: string;
  audioUrl: string;
  fileSizeBytes: number;
  contentType: string;
  verified: boolean;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const qs = new URLSearchParams({
      filename: options.filename,
      ...(options.contentType ? { contentType: options.contentType } : {}),
      ...(options.episodeNumber
        ? { episodeNumber: String(options.episodeNumber) }
        : {}),
    });
    const headers = buildAdminHeaders(actor);
    headers["Content-Type"] = options.contentType || "audio/mpeg";
    const response = await fetch(
      `${workerUrl}/api/admin/episodes/upload-audio?${qs.toString()}`,
      {
        method: "POST",
        headers,
        body: Buffer.from(options.bytes),
        cache: "no-store",
      }
    );

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      r2Key?: string;
      audioUrl?: string;
      fileSizeBytes?: number;
      contentType?: string;
      verified?: boolean;
    };

    if (!response.ok || !data.ok || !data.audioUrl || !data.r2Key) {
      throw new Error(
        data.error ||
          `Worker /api/admin/episodes/upload-audio failed (${response.status})`
      );
    }

    return {
      r2Key: data.r2Key,
      audioUrl: data.audioUrl,
      fileSizeBytes: data.fileSizeBytes || options.bytes.byteLength,
      contentType: data.contentType || options.contentType || "audio/mpeg",
      verified: Boolean(data.verified),
    };
  }

  const audioBucket = createLocalR2AudioAdapter();
  return uploadEpisodeAudioToR2({
    audioBucket,
    ...options,
  });
}

/**
 * Deletes an episode from D1 `episodes`, optionally purges its `.mp3` object from R2 `cabcall-audio`,
 * logs `episode.delete` in `audit_ledger` (storing the full `before_state_json` for 1-click restoration),
 * and immediately invalidates `/archive` and `/feed.xml`.
 */
export async function deleteAdminEpisodeBridge(
  idOrSlug: number | string,
  options: {
    purgeAudio?: boolean;
    reason: string;
  },
  actor: EpisodeAdminActor
): Promise<{
  deletedId: number;
  deletedSlug: string;
  deletedEpisodeNumber: number;
  r2Key: string;
  audioPurged: boolean;
  beforeState: D1EpisodeTableRow & { r2_key: string };
  auditEntry: AuditLedgerEntry;
  episodes: AdminEpisodeRecord[];
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(
      `${workerUrl}/api/admin/episodes/${encodeURIComponent(String(idOrSlug))}`,
      {
        method: "DELETE",
        headers: buildAdminHeaders(actor),
        body: JSON.stringify({
          id: idOrSlug,
          purgeAudio: options.purgeAudio !== false,
          reason: options.reason,
          actorEmail: actor.actorEmail,
          actorRole: actor.actorRole,
          authMethod: actor.authMethod,
        }),
        cache: "no-store",
      }
    );

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      deletedId?: number;
      deletedSlug?: string;
      deletedEpisodeNumber?: number;
      r2Key?: string;
      audioPurged?: boolean;
      beforeState?: D1EpisodeTableRow & { r2_key: string };
      auditEntry?: AuditLedgerEntry;
      episodes?: AdminEpisodeRecord[];
    };

    if (!response.ok || !data.ok || !data.auditEntry || !data.beforeState) {
      throw new Error(
        data.error ||
          `Worker /api/admin/episodes DELETE failed (${response.status})`
      );
    }

    await ensureD1Snapshot(true);
    invalidateEpisodePublicCaches();

    return {
      deletedId: data.deletedId ?? Number(idOrSlug),
      deletedSlug: data.deletedSlug || String(idOrSlug),
      deletedEpisodeNumber: data.deletedEpisodeNumber ?? 0,
      r2Key: data.r2Key || "",
      audioPurged: Boolean(data.audioPurged),
      beforeState: data.beforeState,
      auditEntry: data.auditEntry,
      episodes: data.episodes || [],
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const audioBucket = createLocalR2AudioAdapter();

  const res = await deleteAdminEpisode({
    db,
    audioBucket,
    idOrSlug,
    purgeAudio: options.purgeAudio !== false,
    reason: options.reason,
    actor,
  });
  const episodes = await listAdminEpisodes(db);
  await ensureD1Snapshot(true);
  invalidateEpisodePublicCaches();

  return { ...res, episodes };
}
