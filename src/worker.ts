import {
  AppendAuditEntryInput,
  appendAuditEntry,
  AuditAuthMethod,
  exportAuditDisclosureBundle,
  hashActorIp,
  listAuditEntries,
  replayAuditEntry,
  verifyAuditChainIntegrity,
} from "./pipeline/audit";
import {
  ADMIN_SESSION_COOKIE_NAME,
  AdminAuthProviderPref,
  AdminUserRole,
  AuthenticatedAdminActor,
  authenticateGoogleOAuthUser,
  DEFAULT_OWNER_EMAIL,
  inviteAdminUser,
  listAdminUsers,
  requestAdminMagicLink,
  revokeAdminSessionByToken,
  revokeAdminUser,
  updateAdminUserRole,
  verifyAdminMagicLinkToken,
  verifyAdminSession,
} from "./pipeline/auth";
import {
  attachIncidentImage,
  ensureEditorialPipelineSchema,
  generateIncidentTelemetrySvgCard,
  getAdminIncidentById,
  ImageSourceType,
  listAdminIncidentsAndTransforms,
  listPipelineTransforms,
  overrideIncidentBriefAndClassification,
  rewriteIncidentTitle,
  updatePipelineTransform,
  uploadAdminMediaToR2,
} from "./pipeline/editorial";
import {
  createIngestFeed,
  createIngestFilter,
  D1DatabaseLike,
  deleteIngestFeed,
  deleteIngestFilter,
  getSystemThresholds,
  IngestFilterMatchTarget,
  IngestFilterType,
  listIngestFeeds,
  listIngestFilters,
  runD1IngestPipeline,
  testCandidateRssFeed,
  testIngestFiltersDryRun,
  updateIngestFeed,
  updateIngestFilter,
  updateSystemThresholds,
  US_HIGH_IMPACT_FEEDS,
} from "./pipeline/ingest";
import { evaluateArticleWithJev, JevSreFailureModeKey, JevWorkingToolKey } from "./pipeline/jev";
import {
  buildValidMp3AudioBytes,
  D1EpisodeTableRow,
  deleteAdminEpisode,
  ensureBaselineEpisodesSeeded,
  EPISODES_SELECT_COLUMNS,
  extractR2KeyFromAudioUrl,
  generateAdminEpisode,
  GenerateEpisodeOverrides,
  getAdminEpisodeByIdOrSlug,
  listAdminEpisodes,
  parseEpisodeTranscriptSections,
  R2BucketLike,
  runWeeklyRollupPipeline,
  updateAdminEpisode,
} from "./pipeline/rollup";
import {
  runSynthesizePipeline,
  TELEMETRY_ARTICLES_SYNTHESIS_COLUMNS,
  TelemetryArticleRow,
} from "./pipeline/synthesize";
import {
  projectPublicEpisodeDto,
  projectPublicIncidentDto,
  PublicEpisodeDto,
  PublicIncidentDto,
} from "./lib/dto";
import {
  buildOrSanitizeArticleDiagnostics,
  normalizeStoredQuestionsPayload,
  validateAndNormalizeIncidentSummary,
} from "./lib/sanitize";
import { DomainSectorId, SreFailureModeId, WorkingToolId } from "./lib/taxonomy";

export interface WorkerEnv {
  DB: D1DatabaseLike;
  AUDIO_BUCKET: R2BucketLike;
  TYPESAFE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ADMIN_SECRET?: string;
  OWNER_ADMIN_EMAIL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export interface ScheduledControllerLike {
  scheduledTime: number;
  cron: string;
  noRetry(): void;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const DEFAULT_SAMPLE_ARTICLE = {
  title: "FAA Audit Finds Maintenance Logs Skipped Before Regional Outage",
  source: "NPR Top News",
  excerpt:
    "Federal investigators reported Tuesday that routine inspection alerts were repeatedly dismissed over six months due to staffing shortages before the dispatch system failed.",
};

const WORKER_TOOL_DISPLAY: Record<JevWorkingToolKey, WorkingToolId> = {
  twenty_four_inch_gauge: "24-Inch Gauge",
  common_gavel: "Common Gavel",
  plumb: "The Plumb",
  square: "The Square",
  level: "The Level",
  trowel: "The Trowel",
};

const WORKER_FAILURE_DISPLAY: Record<JevSreFailureModeKey, SreFailureModeId> = {
  configuration_drift: "Configuration Drift",
  cascading_failure: "Cascading Failure",
  untested_failover: "Single Point of Failure (SPOF) / Untested Failover",
  alert_fatigue: "Alert Fatigue & Signal Loss",
  blameless_postmortem_gap: "Blame Culture vs. Root-Cause Isolation",
  capacity_exhaustion: "Technical & Institutional Debt",
};

function inferWorkerDomainSector(
  sourceFeed: string,
  title: string,
  excerpt: string
): DomainSectorId {
  const feedLower = (sourceFeed || "").toLowerCase();
  const text = `${title} ${excerpt}`.toLowerCase();
  if (
    feedLower.includes("wsj") ||
    /(bank|loan|market|supplier|billion|million|insolvency|economy|tariff|fund)/.test(text)
  ) {
    return "Economics & Markets";
  }
  if (
    feedLower.includes("ars technica") ||
    /(cyber|software|cloud|ai|chip|protocol|network|encryption|security)/.test(text)
  ) {
    return "Technology & Cyber";
  }
  if (
    /(mail|postal|grid|rail|aviation|faa|water|port|supply chain|shutdown|warehouse)/.test(text)
  ) {
    return "Infrastructure & Supply Chain";
  }
  if (/(ceo|board|press secretary|ousted|dei|executive|leadership|resign)/.test(text)) {
    return "Institutional Leadership";
  }
  return "Public Policy & Governance";
}

function mapWorkerRowToPublicIncidentDto(
  row: TelemetryArticleRow
): PublicIncidentDto | null {
  if (row.status !== "synthesized" || Number(row.is_hidden ?? 0) === 1) {
    return null;
  }

  const primaryTool =
    WORKER_TOOL_DISPLAY[row.primary_tool] || "The Square";
  const secondaryTool =
    WORKER_TOOL_DISPLAY[row.secondary_tool || "twenty_four_inch_gauge"] ||
    "24-Inch Gauge";
  const sreFailureMode =
    WORKER_FAILURE_DISPLAY[row.sre_failure_mode] || "Configuration Drift";

  const storedPayload = normalizeStoredQuestionsPayload(row.questions_json, {
    title: row.title,
    sourceFeed: row.source_feed,
    factualSummary: row.socratic_brief || row.raw_excerpt,
    primaryTool,
    secondaryTool,
    sreFailureMode,
  });

  const validation = validateAndNormalizeIncidentSummary({
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

  const diagnostics = buildOrSanitizeArticleDiagnostics({
    title: row.title,
    sourceFeed: row.source_feed,
    factualSummary: `${validation.factualBriefParagraph}\n\n${validation.executiveSummary}`,
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

  const slugBase = row.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  const hasImageUrl =
    typeof row.image_url === "string" && row.image_url.trim().length > 0;
  const effectiveImageUrl = hasImageUrl
    ? row.image_url!.trim()
    : `/media/card-d1-${row.id}.svg`;
  const effectiveImageSourceType: PublicIncidentDto["imageSourceType"] =
    hasImageUrl
      ? (row.image_source_type as PublicIncidentDto["imageSourceType"]) || "rss"
      : "svg_card";
  const effectiveImageAlt =
    typeof row.image_alt === "string" && row.image_alt.trim().length > 0
      ? row.image_alt.trim()
      : `${primaryTool} · ${sreFailureMode} telemetry blueprint for ${row.title}`;
  const effectiveImageCaption =
    typeof row.image_caption === "string" && row.image_caption.trim().length > 0
      ? row.image_caption.trim()
      : `Blueprint Card · ${primaryTool} / ${sreFailureMode}`;

  return projectPublicIncidentDto({
    id: `d1-inc-${row.id}`,
    incidentCode: `#CAB-2026-${2000 + row.id}`,
    slug: `${slugBase || "incident"}-d1-${row.id}`,
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
    domainSector: inferWorkerDomainSector(
      row.source_feed,
      row.title,
      row.raw_excerpt
    ),
    primaryTool,
    secondaryTool,
    sreFailureMode,
    executiveSummary: validation.executiveSummary,
    socraticBrief: validation.factualBriefParagraph,
    proportionalityCheck: {
      noiseOverblown: diagnostics.noiseOverblown,
      structuralSignal: diagnostics.structuralSignal,
    },
    questions: [diagnostics.questions[0], diagnostics.questions[1]],
    isLeadPostMortem: storedPayload.isLeadPostMortem,
    leadPostMortemAnalysis: storedPayload.leadPostMortemAnalysis || undefined,
    imageUrl: effectiveImageUrl,
    imageAlt: effectiveImageAlt,
    imageCaption: effectiveImageCaption,
    imageSourceType: effectiveImageSourceType,
    isPinned: Number(row.is_pinned ?? 0) === 1,
  });
}

function mapWorkerRowToPublicEpisodeDto(
  row: D1EpisodeTableRow,
  incidents: PublicIncidentDto[]
): PublicEpisodeDto | null {
  if (row.status && row.status !== "PUBLISHED") {
    return null;
  }
  const episodeNumber = Number(row.episode_number || 42);
  const durationSeconds = Number(row.duration_seconds || 300);
  const mins = Math.floor(durationSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(durationSeconds % 60)
    .toString()
    .padStart(2, "0");

  let dominantTool: WorkingToolId = incidents[0]?.primaryTool || "The Square";
  for (const t of Object.values(WORKER_TOOL_DISPLAY)) {
    if (row.title.includes(t) || row.summary.includes(t)) {
      dominantTool = t;
      break;
    }
  }

  let dominantFailureMode: SreFailureModeId =
    incidents[0]?.sreFailureMode || "Configuration Drift";
  for (const fm of Object.values(WORKER_FAILURE_DISPLAY)) {
    if (row.title.includes(fm) || row.summary.includes(fm)) {
      dominantFailureMode = fm;
      break;
    }
  }

  const isLegacy =
    row.slug.startsWith("legacy-") ||
    row.title.toLowerCase().includes("legacy archive") ||
    episodeNumber <= 30;
  const rawTranscript = row.transcript || row.summary || "";
  const parsedSections = parseEpisodeTranscriptSections(rawTranscript);

  return projectPublicEpisodeDto({
    id: `d1-ep-${row.id}`,
    slug: row.slug,
    episodeNumber,
    series: isLegacy ? "legacy_archive" : "weekly_rollup",
    title: row.title,
    summary: row.summary,
    transcript: rawTranscript,
    transcriptSections:
      parsedSections.weeklyTelemetry && parsedSections.separatingSignalFromPanic
        ? parsedSections
        : undefined,
    audioUrl: row.audio_url,
    durationSeconds,
    durationFormatted: `${mins}:${secs}`,
    fileSizeBytes: Number(row.file_size_bytes || 0),
    publishedAt: row.published_at,
    dominantTool,
    dominantFailureMode,
    incidentMarkers: incidents.slice(0, 3).map((inc, idx) => ({
      incidentId: inc.id,
      incidentCode: inc.incidentCode,
      incidentSlug: inc.slug,
      incidentTitle: inc.title,
      timestampSeconds: idx === 0 ? 35 : idx === 1 ? 115 : 210,
      timecodeLabel: idx === 0 ? "00:35" : idx === 1 ? "01:55" : "03:30",
      toolApplied: inc.primaryTool,
    })),
  });
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, HEAD, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, x-admin-secret, x-session-token, x-actor-email, x-actor-role, x-actor-auth-method, Authorization",
};

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(extraHeaders || {}),
    },
  });
}

function extractSessionTokenFromRequest(request: Request): string | null {
  const headerToken = request.headers.get("x-session-token");
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...vParts] = part.trim().split("=");
    if (k === ADMIN_SESSION_COOKIE_NAME) {
      const val = decodeURIComponent(vParts.join("=")).trim();
      if (val) return val;
    }
  }
  return null;
}

function isAuthorizedAdmin(request: Request, env: WorkerEnv): boolean {
  const expectedSecret = env.ADMIN_SECRET || "local-dev-secret";
  const providedSecret = request.headers.get("x-admin-secret");
  return Boolean(providedSecret && providedSecret === expectedSecret);
}

async function resolveAdminActor(
  request: Request,
  env: WorkerEnv
): Promise<AuthenticatedAdminActor | null> {
  const sessionToken = extractSessionTokenFromRequest(request);
  if (sessionToken) {
    const sessionActor = await verifyAdminSession(
      env.DB,
      sessionToken,
      env.OWNER_ADMIN_EMAIL
    );
    if (sessionActor) {
      return sessionActor;
    }
  }

  if (isAuthorizedAdmin(request, env)) {
    const ownerEmail = (
      env.OWNER_ADMIN_EMAIL || DEFAULT_OWNER_EMAIL
    ).toLowerCase();
    const actorEmail = (
      request.headers.get("x-actor-email") || ownerEmail
    )
      .trim()
      .toLowerCase();
    const actorRole = (request.headers.get("x-actor-role") ||
      "owner") as AdminUserRole;
    const authMethod = (request.headers.get("x-actor-auth-method") ||
      "admin_secret") as AuditAuthMethod;
    return {
      userId: 1,
      email: actorEmail,
      displayName: "CAB Admin",
      avatarUrl: null,
      role: actorRole,
      authMethod,
    };
  }

  return null;
}

function parseByteRangeHeader(
  rangeHeader: string | null,
  totalSize: number
): { start: number; end: number; length: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }
  const spec = rangeHeader.replace(/^bytes=/, "").split(",")[0].trim();
  const [startStr, endStr] = spec.split("-");
  let start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : totalSize - 1;

  if (!startStr && endStr) {
    const suffixLength = parseInt(endStr, 10);
    if (Number.isNaN(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  }

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    start >= totalSize
  ) {
    return null;
  }
  end = Math.min(end, totalSize - 1);
  if (end < start) return null;

  return { start, end, length: end - start + 1 };
}

const worker = {
  async fetch(
    request: Request,
    env: WorkerEnv,
    _ctx: ExecutionContextLike
  ): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Health & status check (zero internal model version tags exposed)
    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse({
        service: "thecabcall.com Editorial Edge Dispatch",
        feeds: US_HIGH_IMPACT_FEEDS,
        endpoints: {
          snapshot:
            "GET /api/snapshot (public editorial Trestleboard DTO snapshot)",
          audioStream: "GET /audio/:filename (supports Range requests)",
        },
      });
    }

    // Public Route: GET /api/snapshot (Returns strictly projected Public DTOs; zero SELECT * or telemetry bleed)
    if (request.method === "GET" && url.pathname === "/api/snapshot") {
      try {
        try {
          await ensureBaselineEpisodesSeeded(env.DB);
          await ensureEditorialPipelineSchema(env.DB);
        } catch {
          // ignore seed check failure
        }

        const articlesRes = await env.DB.prepare(
          `SELECT ${TELEMETRY_ARTICLES_SYNTHESIS_COLUMNS}
           FROM telemetry_articles
           WHERE status = 'synthesized' AND is_hidden = 0
           ORDER BY is_pinned DESC, published_at DESC, id DESC`
        ).all<TelemetryArticleRow>();
        const articleRows = articlesRes.results || [];

        const incidents: PublicIncidentDto[] = [];
        for (const row of articleRows) {
          const dto = mapWorkerRowToPublicIncidentDto(row);
          if (dto) {
            incidents.push(dto);
          }
        }

        let episodeRows: D1EpisodeTableRow[] = [];
        try {
          const episodesRes = await env.DB.prepare(
            `SELECT ${EPISODES_SELECT_COLUMNS}
             FROM episodes
             WHERE status = 'PUBLISHED'
             ORDER BY published_at DESC, episode_number DESC, id DESC`
          ).all<D1EpisodeTableRow>();
          episodeRows = episodesRes.results || [];
        } catch {
          episodeRows = [];
        }

        const episodes: PublicEpisodeDto[] = [];
        for (const epRow of episodeRows) {
          const dto = mapWorkerRowToPublicEpisodeDto(epRow, incidents);
          if (dto) {
            episodes.push(dto);
          }
        }

        return jsonResponse(
          {
            ok: true,
            publishedAt: new Date().toISOString(),
            incidents,
            episodes,
          },
          200,
          {
            "Cache-Control": "no-store, max-age=0",
          }
        );
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Public Route: GET /audio/:filename (Streams episode MP3 from R2 with byte-range support)
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      url.pathname.startsWith("/audio/")
    ) {
      const filename = decodeURIComponent(
        url.pathname.slice("/audio/".length)
      ).trim();
      if (!filename || filename.includes("..")) {
        return jsonResponse({ error: "Invalid audio filename" }, 400);
      }

      const obj = await env.AUDIO_BUCKET.get(filename);
      if (!obj) {
        return jsonResponse(
          { error: "Audio object not found in R2", key: filename },
          404
        );
      }

      const fullBuffer = await obj.arrayBuffer();
      const totalSize = fullBuffer.byteLength;
      const rangeHeader = request.headers.get("range");
      const parsedRange = parseByteRangeHeader(rangeHeader, totalSize);

      const baseHeaders: Record<string, string> = {
        "Content-Type": obj.httpMetadata?.contentType || "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      };

      if (obj.etag) {
        baseHeaders["ETag"] = obj.etag;
      }

      if (parsedRange) {
        const sliced = fullBuffer.slice(
          parsedRange.start,
          parsedRange.end + 1
        );
        return new Response(request.method === "HEAD" ? null : sliced, {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${parsedRange.start}-${parsedRange.end}/${totalSize}`,
            "Content-Length": String(parsedRange.length),
          },
        });
      }

      return new Response(request.method === "HEAD" ? null : fullBuffer, {
        status: 200,
        headers: {
          ...baseHeaders,
          "Content-Length": String(totalSize),
        },
      });
    }

    // Public Route: GET /media/:filename (Serves R2 media objects or dynamically generates Masonic/SRE Blueprint SVG cards)
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      url.pathname.startsWith("/media/")
    ) {
      const filename = decodeURIComponent(
        url.pathname.slice("/media/".length)
      ).trim();
      if (!filename || filename.includes("..") || filename.includes("/")) {
        return jsonResponse({ error: "Invalid media filename" }, 400);
      }

      // Check if this is a dynamic SVG card request: card-d1-<id>.svg or card-<id>.svg
      const cardMatch = filename.match(/^card-(?:d1-)?(\d+)\.svg$/i);
      if (cardMatch) {
        const incidentId = parseInt(cardMatch[1], 10);
        try {
          await ensureEditorialPipelineSchema(env.DB);
          const incidentLookup = await getAdminIncidentById(env.DB, incidentId);
          if (incidentLookup) {
            const rec = incidentLookup.record;
            const svg = generateIncidentTelemetrySvgCard({
              incidentCode: rec.incidentCode,
              title: rec.title,
              sourceFeed: rec.sourceFeed,
              publishedAt: rec.publishedAt,
              primaryTool: rec.primaryTool,
              secondaryTool: rec.secondaryTool,
              sreFailureMode: rec.sreFailureMode,
              domainSector: rec.domainSector,
              titleRewritten: rec.titleRewritten,
            });
            return new Response(request.method === "HEAD" ? null : svg, {
              status: 200,
              headers: {
                "Content-Type": "image/svg+xml; charset=utf-8",
                "Cache-Control": "public, max-age=300",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }
        } catch {
          // Fall through to R2 lookup or generic blueprint card
        }
      }

      const r2Key = `media/${filename}`;
      const obj = await env.AUDIO_BUCKET.get(r2Key);
      if (!obj) {
        if (filename.toLowerCase().endsWith(".svg")) {
          const fallbackSvg = generateIncidentTelemetrySvgCard({
            incidentCode: "#CAB-2026-2000",
            title: "Change Advisory Board — Structural Incident Telemetry",
            sourceFeed: "THE CAB CALL",
            publishedAt: new Date().toISOString(),
            primaryTool: "The Square",
            secondaryTool: "24-Inch Gauge",
            sreFailureMode: "Configuration Drift",
            domainSector: "Infrastructure & Supply Chain",
          });
          return new Response(request.method === "HEAD" ? null : fallbackSvg, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
        return jsonResponse(
          { error: "Media object not found in R2", key: r2Key },
          404
        );
      }

      const fullBuffer = await obj.arrayBuffer();
      const contentType =
        obj.httpMetadata?.contentType ||
        (filename.endsWith(".svg")
          ? "image/svg+xml; charset=utf-8"
          : filename.endsWith(".png")
          ? "image/png"
          : filename.endsWith(".webp")
          ? "image/webp"
          : filename.endsWith(".gif")
          ? "image/gif"
          : "image/jpeg");

      return new Response(request.method === "HEAD" ? null : fullBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(fullBuffer.byteLength),
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Admin Route 1: POST /api/test-jev
    if (request.method === "POST" && url.pathname === "/api/test-jev") {
      if (!isAuthorizedAdmin(request, env)) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing x-admin-secret header" },
          401
        );
      }

      let body: { title?: string; excerpt?: string; source?: string } = {};
      try {
        const rawText = await request.text();
        if (rawText.trim()) {
          body = JSON.parse(rawText);
        }
      } catch {
        // Fallback to default sample story if body is empty or malformed
      }

      const article = {
        title: body.title?.trim() || DEFAULT_SAMPLE_ARTICLE.title,
        source: body.source?.trim() || DEFAULT_SAMPLE_ARTICLE.source,
        excerpt: body.excerpt?.trim() || DEFAULT_SAMPLE_ARTICLE.excerpt,
      };

      try {
        const result = await evaluateArticleWithJev(
          article,
          env.TYPESAFE_API_KEY
        );

        return jsonResponse({
          ok: true,
          model: "jev-1.14.0",
          endpoint: "https://api.typesafe.ai/v1/systemone",
          input: article,
          classification: {
            status: result.status,
            is_systemic_prob: result.isSystemicProb,
            jev_confidence: result.jevConfidence,
            primary_tool: result.primaryTool,
            secondary_tool: result.secondaryTool,
            sre_failure_mode: result.sreFailureMode,
            working_tool_probabilities: result.workingToolProbabilities,
            sre_failure_mode_probabilities: result.sreFailureModeProbabilities,
          },
          jev_raw: result.rawResponse,
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Route 2: POST /api/run-ingest
    if (request.method === "POST" && url.pathname === "/api/run-ingest") {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing admin credentials" },
          401
        );
      }

      let body: {
        synthesize?: boolean;
        synthesizeLimit?: number;
        maxNetNew?: number;
        customArticle?: {
          title: string;
          description: string;
          sourceFeed: string;
          link?: string;
        };
      } = {};
      try {
        const rawText = await request.text();
        if (rawText.trim()) {
          body = JSON.parse(rawText);
        }
      } catch {
        // Ignore malformed body
      }

      const chainSynthesize =
        url.searchParams.get("synthesize") === "true" ||
        body.synthesize === true ||
        Boolean(body.customArticle);

      try {
        const summary = await runD1IngestPipeline({
          db: env.DB,
          typesafeApiKey: env.TYPESAFE_API_KEY,
          maxNetNew: body.maxNetNew ?? 10,
          itemsPerFeed: 5,
          customArticle: body.customArticle,
        });

        let synthesisSummary = undefined;
        if (chainSynthesize) {
          const insertedId = body.customArticle
            ? summary.articles[0]?.id
            : undefined;
          synthesisSummary = await runSynthesizePipeline({
            db: env.DB,
            geminiApiKey: env.GEMINI_API_KEY,
            limit: body.synthesizeLimit ?? 5,
            articleIds: insertedId ? [insertedId] : undefined,
          });
        }

        if (
          request.headers.get("x-actor-email") ||
          extractSessionTokenFromRequest(request)
        ) {
          try {
            const clientIp =
              request.headers.get("cf-connecting-ip") ||
              request.headers.get("x-forwarded-for");
            await appendAuditEntry(env.DB, {
              actorEmail: actor.email,
              actorRole: actor.role,
              authMethod: actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
              actionType: "pipeline.run_ingest",
              targetType: "pipeline",
              targetId: "rss_ingest",
              reason: `Manual RSS ingest & System-1 Jev triage triggered from Admin Command Center (${summary.ingestedCount} evaluated, ${summary.triagedCount} triaged, ${summary.droppedCount} dropped)${
                synthesisSummary
                  ? `; chained System-2 synthesis (${synthesisSummary.synthesizedCount} synthesized)`
                  : ""
              }.`,
              beforeState: null,
              afterState: {
                ingestedCount: summary.ingestedCount,
                triagedCount: summary.triagedCount,
                droppedCount: summary.droppedCount,
                chainedSynthesis: synthesisSummary
                  ? {
                      requestedLimit: synthesisSummary.requestedLimit,
                      synthesizedCount: synthesisSummary.synthesizedCount,
                    }
                  : null,
              },
            });
          } catch (auditErr) {
            console.warn("[Audit] Failed to log pipeline.run_ingest:", auditErr);
          }
        }

        return jsonResponse({
          ok: true,
          model: "jev-1.14.0",
          ...summary,
          synthesis: synthesisSummary,
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Route 3: POST /api/run-synthesize
    if (request.method === "POST" && url.pathname === "/api/run-synthesize") {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing admin credentials" },
          401
        );
      }

      let body: { limit?: number } = {};
      try {
        const rawText = await request.text();
        if (rawText.trim()) {
          body = JSON.parse(rawText);
        }
      } catch {
        // Default limit = 5
      }

      const limitParam = url.searchParams.get("limit");
      const limit = limitParam
        ? Math.min(10, Math.max(1, parseInt(limitParam, 10) || 5))
        : Math.min(10, Math.max(1, body.limit ?? 5));

      try {
        const result = await runSynthesizePipeline({
          db: env.DB,
          geminiApiKey: env.GEMINI_API_KEY,
          limit,
        });

        if (
          request.headers.get("x-actor-email") ||
          extractSessionTokenFromRequest(request)
        ) {
          try {
            const clientIp =
              request.headers.get("cf-connecting-ip") ||
              request.headers.get("x-forwarded-for");
            await appendAuditEntry(env.DB, {
              actorEmail: actor.email,
              actorRole: actor.role,
              authMethod: actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
              actionType: "pipeline.run_synthesize",
              targetType: "pipeline",
              targetId: "system2_synthesize",
              reason: `Manual System-2 Gemini 2.5 Flash synthesis triggered from Admin Command Center (${result.synthesizedCount} briefs synthesized, limit ${result.requestedLimit}).`,
              beforeState: null,
              afterState: {
                requestedLimit: result.requestedLimit,
                synthesizedCount: result.synthesizedCount,
              },
            });
          } catch (auditErr) {
            console.warn(
              "[Audit] Failed to log pipeline.run_synthesize:",
              auditErr
            );
          }
        }

        return jsonResponse({
          ok: true,
          stage: "Stage 4 System-2 Bounded Socratic Synthesis",
          ...result,
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Route 4: POST /api/run-rollup
    if (request.method === "POST" && url.pathname === "/api/run-rollup") {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing admin credentials" },
          401
        );
      }

      try {
        const episode = await runWeeklyRollupPipeline({
          db: env.DB,
          audioBucket: env.AUDIO_BUCKET,
          geminiApiKey: env.GEMINI_API_KEY,
        });

        try {
          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for");
          await appendAuditEntry(env.DB, {
            actorEmail: actor.email,
            actorRole: actor.role,
            authMethod: actor.authMethod,
            actorIpHash: await hashActorIp(clientIp),
            actionType: "episode.generate",
            targetType: "episode",
            targetId: String(episode.id ?? episode.slug),
            reason: `Generated podcast rollup episode #${episode.episode_number}: ${episode.title}`,
            beforeState: null,
            afterState: episode,
          });
        } catch (auditErr) {
          console.warn("[Audit] Failed to log episode.generate:", auditErr);
        }

        return jsonResponse({
          ok: true,
          stage: "Friday 5-Minute CAB Weekly Brief Rollup",
          episode,
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Audit Route 1: GET & POST /api/admin/audit
    if (url.pathname === "/api/admin/audit") {
      if (request.method === "GET") {
        try {
          const filters = {
            actionType: url.searchParams.get("actionType") || undefined,
            targetType: url.searchParams.get("targetType") || undefined,
            targetId: url.searchParams.get("targetId") || undefined,
            actorEmail: url.searchParams.get("actorEmail") || undefined,
            search: url.searchParams.get("search") || undefined,
            fromDate: url.searchParams.get("fromDate") || undefined,
            toDate: url.searchParams.get("toDate") || undefined,
            limit: url.searchParams.get("limit")
              ? parseInt(url.searchParams.get("limit")!, 10)
              : 100,
            offset: url.searchParams.get("offset")
              ? parseInt(url.searchParams.get("offset")!, 10)
              : 0,
          };

          const [listResult, chainIntegrity] = await Promise.all([
            listAuditEntries(env.DB, filters),
            verifyAuditChainIntegrity(env.DB),
          ]);

          return jsonResponse(
            {
              ok: true,
              ...listResult,
              chainIntegrity,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500
          );
        }
      }

      if (request.method === "POST") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { error: "Unauthorized: Invalid or missing admin credentials" },
            401
          );
        }

        try {
          const body = (await request.json()) as AppendAuditEntryInput;
          if (!body.actionType || !body.targetType || body.targetId === undefined) {
            return jsonResponse(
              {
                ok: false,
                error:
                  "Missing required fields: actionType, targetType, targetId",
              },
              400
            );
          }

          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for");
          const entry = await appendAuditEntry(env.DB, {
            ...body,
            actorEmail: body.actorEmail || actor.email,
            actorRole: body.actorRole || actor.role,
            authMethod: body.authMethod || actor.authMethod,
            actorIpHash:
              body.actorIpHash ?? (await hashActorIp(clientIp)),
          });

          return jsonResponse({ ok: true, entry }, 201);
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500
          );
        }
      }
    }

    // Audit Route 2: GET /api/admin/audit/verify (Cryptographic SHA-256 Chain Verification)
    if (
      request.method === "GET" &&
      url.pathname === "/api/admin/audit/verify"
    ) {
      try {
        const verification = await verifyAuditChainIntegrity(env.DB);
        return jsonResponse(
          {
            ok: true,
            ...verification,
          },
          200,
          { "Cache-Control": "no-store" }
        );
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            valid: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Audit Route 3: POST /api/admin/audit/replay (Deterministic State Revert / Re-Apply)
    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/audit/replay"
    ) {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing admin credentials" },
          401
        );
      }

      try {
        const body = (await request.json()) as {
          eventId?: string;
          mode?: "revert_to_before" | "reapply_after";
          actorEmail?: string;
          actorRole?: string;
          authMethod?:
            | "google_oauth"
            | "magic_link"
            | "admin_secret"
            | "system_bootstrap";
          reason?: string;
        };

        if (!body.eventId) {
          return jsonResponse(
            { ok: false, error: "Missing required field: eventId" },
            400
          );
        }

        const mode =
          body.mode === "reapply_after"
            ? "reapply_after"
            : "revert_to_before";
        const clientIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        const replayResult = await replayAuditEntry(
          env.DB,
          body.eventId,
          mode,
          {
            actorEmail: body.actorEmail || actor.email,
            actorRole: body.actorRole || actor.role,
            authMethod: body.authMethod || actor.authMethod,
            actorIpHash: await hashActorIp(clientIp),
            reason: body.reason,
          }
        );

        // If an episode was restored (insert/update), ensure its R2 MP3 audio object exists
        if (
          replayResult.targetType === "episode" &&
          replayResult.restoredState &&
          env.AUDIO_BUCKET
        ) {
          try {
            const restored = replayResult.restoredState;
            const audioUrl = String(restored.audio_url || "");
            const slug = String(restored.slug || "restored-episode");
            const r2Key = extractR2KeyFromAudioUrl(audioUrl, slug);
            const existingObj = await env.AUDIO_BUCKET.get(r2Key);
            if (!existingObj) {
              const mp3Bytes = buildValidMp3AudioBytes(
                String(restored.title || slug),
                String(restored.transcript || restored.summary || ""),
                600
              );
              await env.AUDIO_BUCKET.put(r2Key, mp3Bytes, {
                httpMetadata: { contentType: "audio/mpeg" },
                customMetadata: {
                  slug,
                  restoredFromAuditEvent: body.eventId,
                },
              });
            }
          } catch (r2Err) {
            console.warn(
              "[Audit Replay] Non-fatal error restoring R2 audio:",
              r2Err
            );
          }
        }

        return jsonResponse(replayResult, 200);
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          400
        );
      }
    }

    // Audit Route 4: GET /api/admin/audit/export (Signed JSON & Markdown Disclosure Bundle)
    if (
      request.method === "GET" &&
      url.pathname === "/api/admin/audit/export"
    ) {
      try {
        const filters = {
          actionType: url.searchParams.get("actionType") || undefined,
          targetType: url.searchParams.get("targetType") || undefined,
          targetId: url.searchParams.get("targetId") || undefined,
          actorEmail: url.searchParams.get("actorEmail") || undefined,
          search: url.searchParams.get("search") || undefined,
          fromDate: url.searchParams.get("fromDate") || undefined,
          toDate: url.searchParams.get("toDate") || undefined,
          limit: url.searchParams.get("limit")
            ? parseInt(url.searchParams.get("limit")!, 10)
            : 500,
        };

        const bundle = await exportAuditDisclosureBundle(env.DB, filters);
        const format = (url.searchParams.get("format") || "json").toLowerCase();

        if (format === "markdown" || format === "md") {
          return new Response(bundle.markdownReport, {
            status: 200,
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
              "Content-Disposition": `attachment; filename="cabcall-audit-disclosure-${bundle.generatedAt.slice(
                0,
                10
              )}.md"`,
              "Cache-Control": "no-store",
              ...CORS_HEADERS,
            },
          });
        }

        return jsonResponse(bundle, 200, { "Cache-Control": "no-store" });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Auth Route 1: POST /api/auth/google/verify-login
    if (
      request.method === "POST" &&
      url.pathname === "/api/auth/google/verify-login"
    ) {
      if (!isAuthorizedAdmin(request, env)) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing x-admin-secret header" },
          401
        );
      }

      try {
        const body = (await request.json()) as {
          email?: string;
          emailVerified?: boolean;
          displayName?: string | null;
          avatarUrl?: string | null;
          clientIp?: string | null;
        };

        const clientIp =
          body.clientIp ||
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        const result = await authenticateGoogleOAuthUser({
          db: env.DB,
          ownerEmail: env.OWNER_ADMIN_EMAIL,
          email: body.email || "",
          emailVerified: Boolean(body.emailVerified),
          displayName: body.displayName,
          avatarUrl: body.avatarUrl,
          clientIp,
        });

        return jsonResponse(result, result.status, {
          "Cache-Control": "no-store",
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Auth Route 2: POST /api/auth/magic-link/request
    if (
      request.method === "POST" &&
      url.pathname === "/api/auth/magic-link/request"
    ) {
      try {
        const body = (await request.json()) as {
          email?: string;
          purpose?: "login" | "invite";
          baseUrl?: string;
          includeRawLink?: boolean;
          clientIp?: string | null;
        };

        const clientIp =
          body.clientIp ||
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        const result = await requestAdminMagicLink({
          db: env.DB,
          ownerEmail: env.OWNER_ADMIN_EMAIL,
          email: body.email || "",
          purpose: body.purpose || "login",
          clientIp,
          baseUrl: body.baseUrl || "https://admin.thecabcall.com",
          resendApiKey: env.RESEND_API_KEY,
          emailFrom: env.EMAIL_FROM,
        });

        const adminCaller = await resolveAdminActor(request, env);
        const includeRawLink = Boolean(body.includeRawLink && adminCaller);

        const responsePayload = includeRawLink
          ? result
          : {
              ok: result.ok,
              status: result.status,
              code: result.code,
              error: result.error,
              email: result.email,
              purpose: result.purpose,
              expiresAt: result.expiresAt,
              emailSent: result.emailSent,
              emailError: result.emailError,
            };

        return jsonResponse(responsePayload, result.status, {
          "Cache-Control": "no-store",
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Auth Route 3: GET & POST /api/auth/magic-link/verify
    if (
      (request.method === "GET" || request.method === "POST") &&
      url.pathname === "/api/auth/magic-link/verify"
    ) {
      try {
        let token = url.searchParams.get("token") || "";
        let clientIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        if (request.method === "POST") {
          try {
            const body = (await request.json()) as {
              token?: string;
              clientIp?: string | null;
            };
            if (body.token) token = body.token;
            if (body.clientIp) clientIp = body.clientIp;
          } catch {
            // Use query token if body is empty
          }
        }

        const result = await verifyAdminMagicLinkToken({
          db: env.DB,
          ownerEmail: env.OWNER_ADMIN_EMAIL,
          rawToken: token,
          clientIp,
        });

        return jsonResponse(result, result.status, {
          "Cache-Control": "no-store",
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Auth Route 4: GET & POST /api/auth/session
    if (
      (request.method === "GET" || request.method === "POST") &&
      url.pathname === "/api/auth/session"
    ) {
      try {
        let token =
          extractSessionTokenFromRequest(request) ||
          url.searchParams.get("token") ||
          "";

        if (!token && request.method === "POST") {
          try {
            const body = (await request.json()) as { token?: string };
            if (body.token) token = body.token;
          } catch {
            // ignore
          }
        }

        const actor = await verifyAdminSession(
          env.DB,
          token,
          env.OWNER_ADMIN_EMAIL
        );

        return jsonResponse(
          {
            ok: true,
            authenticated: Boolean(actor),
            actor,
          },
          200,
          { "Cache-Control": "no-store" }
        );
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            authenticated: false,
            actor: null,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Auth Route 5: POST /api/auth/logout
    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      try {
        let token = extractSessionTokenFromRequest(request) || "";
        if (!token) {
          try {
            const body = (await request.json()) as { token?: string };
            if (body.token) token = body.token;
          } catch {
            // ignore
          }
        }

        await revokeAdminSessionByToken(env.DB, token);
        return jsonResponse(
          { ok: true, revoked: true },
          200,
          { "Cache-Control": "no-store" }
        );
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Users Route 1: GET /api/admin/users
    if (request.method === "GET" && url.pathname === "/api/admin/users") {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }

      try {
        const users = await listAdminUsers(env.DB, env.OWNER_ADMIN_EMAIL);
        return jsonResponse(
          {
            ok: true,
            ownerEmail: (
              env.OWNER_ADMIN_EMAIL || DEFAULT_OWNER_EMAIL
            ).toLowerCase(),
            actor,
            users,
          },
          200,
          { "Cache-Control": "no-store" }
        );
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Users Route 2: POST /api/admin/users/invite
    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/users/invite"
    ) {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }
      if (actor.role !== "owner" && actor.role !== "admin") {
        return jsonResponse(
          {
            ok: false,
            error: "Forbidden: Only Owner or Admin roles may invite users.",
          },
          403
        );
      }

      try {
        const body = (await request.json()) as {
          email?: string;
          displayName?: string | null;
          role?: AdminUserRole;
          authProviderPref?: AdminAuthProviderPref;
          reason?: string;
          baseUrl?: string;
          sendEmail?: boolean;
          actorEmail?: string;
          actorRole?: string;
          authMethod?: AuditAuthMethod;
        };

        const clientIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        const result = await inviteAdminUser({
          db: env.DB,
          ownerEmail: env.OWNER_ADMIN_EMAIL,
          actor: {
            actorEmail: body.actorEmail || actor.email,
            actorRole: body.actorRole || actor.role,
            authMethod: body.authMethod || actor.authMethod,
            actorIpHash: await hashActorIp(clientIp),
          },
          email: body.email || "",
          displayName: body.displayName,
          role: body.role,
          authProviderPref: body.authProviderPref,
          reason: body.reason,
          baseUrl: body.baseUrl || "https://admin.thecabcall.com",
          resendApiKey: env.RESEND_API_KEY,
          emailFrom: env.EMAIL_FROM,
          sendEmail: body.sendEmail !== false,
        });

        return jsonResponse(result, result.status, {
          "Cache-Control": "no-store",
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Users Route 3: POST /api/admin/users/revoke (or DELETE /api/admin/users)
    if (
      (request.method === "POST" &&
        url.pathname === "/api/admin/users/revoke") ||
      (request.method === "DELETE" && url.pathname === "/api/admin/users")
    ) {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }
      if (actor.role !== "owner" && actor.role !== "admin") {
        return jsonResponse(
          {
            ok: false,
            error: "Forbidden: Only Owner or Admin roles may revoke users.",
          },
          403
        );
      }

      try {
        const body = (await request.json()) as {
          email?: string;
          id?: number | string;
          reason?: string;
          actorEmail?: string;
          actorRole?: string;
          authMethod?: AuditAuthMethod;
        };

        const targetEmailOrId = body.id ?? body.email ?? "";
        if (!targetEmailOrId) {
          return jsonResponse(
            { ok: false, error: "Missing required field: email or id" },
            400
          );
        }

        const clientIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        const result = await revokeAdminUser({
          db: env.DB,
          ownerEmail: env.OWNER_ADMIN_EMAIL,
          actor: {
            actorEmail: body.actorEmail || actor.email,
            actorRole: body.actorRole || actor.role,
            authMethod: body.authMethod || actor.authMethod,
            actorIpHash: await hashActorIp(clientIp),
          },
          targetEmailOrId,
          reason: body.reason,
        });

        return jsonResponse(result, result.status, {
          "Cache-Control": "no-store",
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Users Route 4: POST /api/admin/users/role (or PUT /api/admin/users)
    if (
      (request.method === "POST" && url.pathname === "/api/admin/users/role") ||
      (request.method === "PUT" && url.pathname === "/api/admin/users")
    ) {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }
      if (actor.role !== "owner" && actor.role !== "admin") {
        return jsonResponse(
          {
            ok: false,
            error:
              "Forbidden: Only Owner or Admin roles may update user roles.",
          },
          403
        );
      }

      try {
        const body = (await request.json()) as {
          email?: string;
          id?: number | string;
          role?: AdminUserRole;
          authProviderPref?: AdminAuthProviderPref;
          displayName?: string | null;
          reason?: string;
          actorEmail?: string;
          actorRole?: string;
          authMethod?: AuditAuthMethod;
        };

        const targetEmailOrId = body.id ?? body.email ?? "";
        if (!targetEmailOrId || !body.role) {
          return jsonResponse(
            {
              ok: false,
              error: "Missing required fields: (email or id) and role",
            },
            400
          );
        }

        const clientIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        const result = await updateAdminUserRole({
          db: env.DB,
          ownerEmail: env.OWNER_ADMIN_EMAIL,
          actor: {
            actorEmail: body.actorEmail || actor.email,
            actorRole: body.actorRole || actor.role,
            authMethod: body.authMethod || actor.authMethod,
            actorIpHash: await hashActorIp(clientIp),
          },
          targetEmailOrId,
          role: body.role,
          authProviderPref: body.authProviderPref,
          displayName: body.displayName,
          reason: body.reason,
        });

        return jsonResponse(result, result.status, {
          "Cache-Control": "no-store",
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Feeds Route 1: GET / POST / PUT / DELETE /api/admin/feeds
    if (url.pathname === "/api/admin/feeds") {
      if (request.method === "GET") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Admin authentication required" },
            401
          );
        }

        try {
          const feeds = await listIngestFeeds(env.DB);
          return jsonResponse(
            {
              ok: true,
              feeds,
              activeCount: feeds.filter((f) => f.enabled).length,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500
          );
        }
      }

      if (request.method === "POST") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Admin authentication required" },
            401
          );
        }
        if (actor.role === "auditor") {
          return jsonResponse(
            {
              ok: false,
              error: "Forbidden: Auditor role is read-only.",
            },
            403
          );
        }

        try {
          const body = (await request.json()) as {
            name?: string;
            url?: string;
            focusArea?: string;
            domainSectorOverride?: string | null;
            itemsPerPoll?: number;
            enabled?: boolean;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          };

          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for");

          const result = await createIngestFeed(
            env.DB,
            {
              name: body.name || "",
              url: body.url || "",
              focusArea: body.focusArea || "General US Telemetry",
              domainSectorOverride: body.domainSectorOverride,
              itemsPerPoll: body.itemsPerPoll,
              enabled: body.enabled,
              reason: body.reason,
            },
            {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            }
          );

          const feeds = await listIngestFeeds(env.DB);
          return jsonResponse(
            {
              ok: true,
              ...result,
              feeds,
            },
            201,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }

      if (request.method === "PUT") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Admin authentication required" },
            401
          );
        }
        if (actor.role === "auditor") {
          return jsonResponse(
            {
              ok: false,
              error: "Forbidden: Auditor role is read-only.",
            },
            403
          );
        }

        try {
          const body = (await request.json()) as {
            id?: number;
            name?: string;
            url?: string;
            focusArea?: string;
            domainSectorOverride?: string | null;
            itemsPerPoll?: number;
            enabled?: boolean;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          };

          const id = Number(body.id || url.searchParams.get("id"));
          if (!id) {
            return jsonResponse(
              { ok: false, error: "Missing required feed id" },
              400
            );
          }

          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for");

          const result = await updateIngestFeed(
            env.DB,
            id,
            {
              name: body.name,
              url: body.url,
              focusArea: body.focusArea,
              domainSectorOverride: body.domainSectorOverride,
              itemsPerPoll: body.itemsPerPoll,
              enabled: body.enabled,
              reason: body.reason,
            },
            {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            }
          );

          const feeds = await listIngestFeeds(env.DB);
          return jsonResponse(
            {
              ok: true,
              ...result,
              feeds,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }

      if (request.method === "DELETE") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Admin authentication required" },
            401
          );
        }
        if (actor.role === "auditor") {
          return jsonResponse(
            {
              ok: false,
              error: "Forbidden: Auditor role is read-only.",
            },
            403
          );
        }

        try {
          let body: {
            id?: number;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          } = {};
          try {
            const raw = await request.text();
            if (raw.trim()) body = JSON.parse(raw);
          } catch {
            // ignore
          }

          const id = Number(body.id || url.searchParams.get("id"));
          if (!id) {
            return jsonResponse(
              { ok: false, error: "Missing required feed id" },
              400
            );
          }

          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for");

          const result = await deleteIngestFeed(
            env.DB,
            id,
            body.reason || url.searchParams.get("reason") || "",
            {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            }
          );

          const feeds = await listIngestFeeds(env.DB);
          return jsonResponse(
            {
              ok: true,
              ...result,
              feeds,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }
    }

    // Admin Feeds Route 2: POST /api/admin/feeds/test (Live RSS/Atom URL Preview)
    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/feeds/test"
    ) {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }

      try {
        const body = (await request.json()) as {
          url?: string;
          maxItems?: number;
        };
        const preview = await testCandidateRssFeed(
          body.url || "",
          body.maxItems ?? 5
        );
        return jsonResponse(preview, preview.ok ? 200 : 400, {
          "Cache-Control": "no-store",
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Filters Route 1: GET / POST / PUT / DELETE /api/admin/filters
    if (url.pathname === "/api/admin/filters") {
      if (request.method === "GET") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Admin authentication required" },
            401
          );
        }

        try {
          const [filters, thresholds, feeds] = await Promise.all([
            listIngestFilters(env.DB),
            getSystemThresholds(env.DB),
            listIngestFeeds(env.DB),
          ]);
          return jsonResponse(
            {
              ok: true,
              filters,
              thresholds,
              feeds,
              activeCount: filters.filter((f) => f.enabled).length,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500
          );
        }
      }

      if (request.method === "POST") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Admin authentication required" },
            401
          );
        }
        if (actor.role === "auditor") {
          return jsonResponse(
            {
              ok: false,
              error: "Forbidden: Auditor role is read-only.",
            },
            403
          );
        }

        try {
          const body = (await request.json()) as {
            name?: string;
            description?: string;
            filterType?: IngestFilterType;
            matchTarget?: IngestFilterMatchTarget;
            pattern?: string;
            scopeFeedId?: number | null;
            actionValue?: string | null;
            enabled?: boolean;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          };

          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for");

          const result = await createIngestFilter(
            env.DB,
            {
              name: body.name || "",
              description: body.description,
              filterType: body.filterType || "Drop_Keyword_Regex",
              matchTarget: body.matchTarget || "title_and_excerpt",
              pattern: body.pattern || "",
              scopeFeedId: body.scopeFeedId,
              actionValue: body.actionValue,
              enabled: body.enabled,
              reason: body.reason,
            },
            {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            }
          );

          const [filters, thresholds] = await Promise.all([
            listIngestFilters(env.DB),
            getSystemThresholds(env.DB),
          ]);
          return jsonResponse(
            {
              ok: true,
              ...result,
              filters,
              thresholds,
            },
            201,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }

      if (request.method === "PUT") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Admin authentication required" },
            401
          );
        }
        if (actor.role === "auditor") {
          return jsonResponse(
            {
              ok: false,
              error: "Forbidden: Auditor role is read-only.",
            },
            403
          );
        }

        try {
          const body = (await request.json()) as {
            action?: "update_thresholds" | "update_filter";
            id?: number;
            name?: string;
            description?: string;
            filterType?: IngestFilterType;
            matchTarget?: IngestFilterMatchTarget;
            pattern?: string;
            scopeFeedId?: number | null;
            actionValue?: string | null;
            enabled?: boolean;
            jevMinSystemicProb?: number;
            jevMinConfidence?: number;
            maxNetNewPerRun?: number;
            defaultItemsPerPoll?: number;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          };

          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for");

          const auditActor = {
            actorEmail: body.actorEmail || actor.email,
            actorRole: body.actorRole || actor.role,
            authMethod: body.authMethod || actor.authMethod,
            actorIpHash: await hashActorIp(clientIp),
          };

          if (
            body.action === "update_thresholds" ||
            body.jevMinSystemicProb !== undefined ||
            body.jevMinConfidence !== undefined ||
            body.maxNetNewPerRun !== undefined ||
            body.defaultItemsPerPoll !== undefined
          ) {
            const thresholdRes = await updateSystemThresholds(
              env.DB,
              {
                jevMinSystemicProb: body.jevMinSystemicProb,
                jevMinConfidence: body.jevMinConfidence,
                maxNetNewPerRun: body.maxNetNewPerRun,
                defaultItemsPerPoll: body.defaultItemsPerPoll,
                reason: body.reason,
              },
              auditActor
            );
            const filters = await listIngestFilters(env.DB);
            return jsonResponse(
              {
                ok: true,
                thresholds: thresholdRes.settings,
                auditEntry: thresholdRes.auditEntry,
                filters,
              },
              200,
              { "Cache-Control": "no-store" }
            );
          }

          const id = Number(body.id || url.searchParams.get("id"));
          if (!id) {
            return jsonResponse(
              { ok: false, error: "Missing required filter id" },
              400
            );
          }

          const result = await updateIngestFilter(
            env.DB,
            id,
            {
              name: body.name,
              description: body.description,
              filterType: body.filterType,
              matchTarget: body.matchTarget,
              pattern: body.pattern,
              scopeFeedId: body.scopeFeedId,
              actionValue: body.actionValue,
              enabled: body.enabled,
              reason: body.reason,
            },
            auditActor
          );

          const [filters, thresholds] = await Promise.all([
            listIngestFilters(env.DB),
            getSystemThresholds(env.DB),
          ]);
          return jsonResponse(
            {
              ok: true,
              ...result,
              filters,
              thresholds,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }

      if (request.method === "DELETE") {
        const actor = await resolveAdminActor(request, env);
        if (!actor) {
          return jsonResponse(
            { ok: false, error: "Unauthorized: Admin authentication required" },
            401
          );
        }
        if (actor.role === "auditor") {
          return jsonResponse(
            {
              ok: false,
              error: "Forbidden: Auditor role is read-only.",
            },
            403
          );
        }

        try {
          let body: {
            id?: number;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          } = {};
          try {
            const raw = await request.text();
            if (raw.trim()) body = JSON.parse(raw);
          } catch {
            // ignore
          }

          const id = Number(body.id || url.searchParams.get("id"));
          if (!id) {
            return jsonResponse(
              { ok: false, error: "Missing required filter id" },
              400
            );
          }

          const clientIp =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for");

          const result = await deleteIngestFilter(
            env.DB,
            id,
            body.reason || url.searchParams.get("reason") || "",
            {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            }
          );

          const [filters, thresholds] = await Promise.all([
            listIngestFilters(env.DB),
            getSystemThresholds(env.DB),
          ]);
          return jsonResponse(
            {
              ok: true,
              ...result,
              filters,
              thresholds,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }
    }

    // Admin Filters Route 2: POST /api/admin/filters/test (Filter Dry-Run Tester)
    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/filters/test"
    ) {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }

      try {
        const body = (await request.json()) as {
          candidateFilter?: {
            name?: string;
            filterType: IngestFilterType;
            matchTarget?: IngestFilterMatchTarget;
            pattern: string;
            actionValue?: string | null;
            scopeFeedId?: number | null;
          };
          customSamples?: Array<{
            title: string;
            excerpt?: string;
            sourceFeed?: string;
            sourceUrl?: string;
          }>;
          minSystemicProbOverride?: number;
          limit?: number;
        };

        const dryRunResult = await testIngestFiltersDryRun(env.DB, body);
        return jsonResponse(dryRunResult, 200, { "Cache-Control": "no-store" });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          500
        );
      }
    }

    // Admin Episodes Studio Routes:
    // - GET /api/admin/episodes
    // - GET /api/admin/episodes/:id
    // - POST /api/admin/episodes/generate (or POST /api/admin/episodes)
    // - PUT /api/admin/episodes/:id (or PUT /api/admin/episodes)
    // - DELETE /api/admin/episodes/:id (or POST /api/admin/episodes/delete or DELETE /api/admin/episodes)
    if (
      url.pathname === "/api/admin/episodes" ||
      url.pathname.startsWith("/api/admin/episodes/")
    ) {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }

      const subPath = url.pathname
        .slice("/api/admin/episodes".length)
        .replace(/^\/+|\/+$/g, "");

      // GET /api/admin/episodes or GET /api/admin/episodes/:id
      if (request.method === "GET") {
        try {
          if (subPath && subPath !== "generate" && subPath !== "delete") {
            const found = await getAdminEpisodeByIdOrSlug(
              env.DB,
              decodeURIComponent(subPath)
            );
            if (!found) {
              return jsonResponse(
                { ok: false, error: `Episode not found: ${subPath}` },
                404
              );
            }
            return jsonResponse(
              {
                ok: true,
                episode: found.record,
              },
              200,
              { "Cache-Control": "no-store" }
            );
          }

          const [episodes, candidateArticlesRes] = await Promise.all([
            listAdminEpisodes(env.DB),
            env.DB.prepare(
              `SELECT ${TELEMETRY_ARTICLES_SYNTHESIS_COLUMNS}
               FROM telemetry_articles
               WHERE status IN ('synthesized', 'triaged')
               ORDER BY
                 CASE WHEN status = 'synthesized' THEN 0 ELSE 1 END,
                 is_systemic_prob DESC,
                 published_at DESC
               LIMIT 40`
            ).all<TelemetryArticleRow>(),
          ]);

          return jsonResponse(
            {
              ok: true,
              episodes,
              candidateIncidents: candidateArticlesRes.results || [],
              totalCount: episodes.length,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500
          );
        }
      }

      // Mutating methods require owner, admin, or editor role
      if (actor.role === "auditor") {
        return jsonResponse(
          {
            ok: false,
            error: "Forbidden: Auditor role is read-only.",
          },
          403
        );
      }

      const clientIp =
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for");

      // POST /api/admin/episodes/generate (or POST /api/admin/episodes when not /delete)
      if (
        request.method === "POST" &&
        (subPath === "generate" || subPath === "")
      ) {
        try {
          let body: {
            episodeNumber?: number;
            titleOverride?: string;
            summaryOverride?: string;
            editorialFocusNote?: string;
            windowDays?: number;
            incidentIds?: number[];
            ttsVoice?: string;
            ttsProvider?: "gemini-tts" | "mpeg-framed";
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          } = {};
          try {
            const raw = await request.text();
            if (raw.trim()) body = JSON.parse(raw);
          } catch {
            // default overrides
          }

          const overrides: GenerateEpisodeOverrides = {
            episodeNumber: body.episodeNumber,
            titleOverride: body.titleOverride,
            summaryOverride: body.summaryOverride,
            editorialFocusNote: body.editorialFocusNote,
            windowDays: body.windowDays,
            incidentIds: Array.isArray(body.incidentIds)
              ? body.incidentIds
              : undefined,
            ttsVoice: body.ttsVoice,
            ttsProvider: body.ttsProvider,
          };

          const result = await generateAdminEpisode({
            db: env.DB,
            audioBucket: env.AUDIO_BUCKET,
            geminiApiKey: env.GEMINI_API_KEY,
            overrides,
            reason: body.reason,
            actor: {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            },
          });

          const episodes = await listAdminEpisodes(env.DB);
          return jsonResponse(
            {
              ok: true,
              ...result,
              episodes,
            },
            201,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }

      // PUT /api/admin/episodes/:id or PUT /api/admin/episodes
      if (request.method === "PUT") {
        try {
          const body = (await request.json()) as {
            id?: number | string;
            slug?: string;
            title?: string;
            summary?: string;
            transcript?: string;
            transcriptSections?: {
              weeklyTelemetry?: string;
              separatingSignalFromPanic?: string;
              forwardPosture?: string;
            };
            episodeNumber?: number;
            publishedAt?: string;
            regenerateAudio?: boolean;
            ttsVoice?: string;
            ttsProvider?: "gemini-tts" | "mpeg-framed";
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          };

          const targetIdOrSlug =
            (subPath && subPath !== "generate" && subPath !== "delete"
              ? decodeURIComponent(subPath)
              : undefined) ||
            body.id ||
            body.slug ||
            url.searchParams.get("id") ||
            url.searchParams.get("slug");

          if (!targetIdOrSlug) {
            return jsonResponse(
              { ok: false, error: "Missing required episode id or slug" },
              400
            );
          }

          const result = await updateAdminEpisode({
            db: env.DB,
            audioBucket: env.AUDIO_BUCKET,
            geminiApiKey: env.GEMINI_API_KEY,
            idOrSlug: targetIdOrSlug,
            input: {
              title: body.title,
              summary: body.summary,
              transcript: body.transcript,
              transcriptSections: body.transcriptSections,
              episodeNumber: body.episodeNumber,
              publishedAt: body.publishedAt,
              regenerateAudio: body.regenerateAudio,
              ttsVoice: body.ttsVoice,
              ttsProvider: body.ttsProvider,
              reason: body.reason,
            },
            actor: {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            },
          });

          const episodes = await listAdminEpisodes(env.DB);
          return jsonResponse(
            {
              ok: true,
              ...result,
              episodes,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }

      // DELETE /api/admin/episodes/:id, DELETE /api/admin/episodes, or POST /api/admin/episodes/delete
      if (
        request.method === "DELETE" ||
        (request.method === "POST" && subPath === "delete")
      ) {
        try {
          let body: {
            id?: number | string;
            slug?: string;
            purgeAudio?: boolean;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          } = {};
          try {
            const raw = await request.text();
            if (raw.trim()) body = JSON.parse(raw);
          } catch {
            // ignore empty body
          }

          const targetIdOrSlug =
            (subPath && subPath !== "delete" && subPath !== "generate"
              ? decodeURIComponent(subPath)
              : undefined) ||
            body.id ||
            body.slug ||
            url.searchParams.get("id") ||
            url.searchParams.get("slug");

          if (!targetIdOrSlug) {
            return jsonResponse(
              { ok: false, error: "Missing required episode id or slug" },
              400
            );
          }

          const purgeParam = url.searchParams.get("purgeAudio");
          const purgeAudio =
            body.purgeAudio !== undefined
              ? Boolean(body.purgeAudio)
              : purgeParam !== null
              ? purgeParam !== "false" && purgeParam !== "0"
              : true;

          const result = await deleteAdminEpisode({
            db: env.DB,
            audioBucket: env.AUDIO_BUCKET,
            idOrSlug: targetIdOrSlug,
            purgeAudio,
            reason: body.reason || url.searchParams.get("reason") || "",
            actor: {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            },
          });

          const episodes = await listAdminEpisodes(env.DB);
          return jsonResponse(
            {
              ok: true,
              ...result,
              episodes,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }
    }

    // Admin Editorial Media Upload Route: POST /api/admin/media/upload
    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/media/upload"
    ) {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }
      if (actor.role === "auditor") {
        return jsonResponse(
          { ok: false, error: "Forbidden: Auditor role is read-only." },
          403
        );
      }

      const clientIp =
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for");

      try {
        const contentTypeHeader = (
          request.headers.get("content-type") || ""
        ).toLowerCase();

        let filename = "incident-image.jpg";
        let mimeType = "image/jpeg";
        let bytes: Uint8Array | null = null;
        let incidentId: number | undefined = undefined;
        let imageAlt: string | undefined = undefined;
        let imageCaption: string | undefined = undefined;
        let reason: string | undefined = undefined;
        let actorEmailOverride: string | undefined = undefined;
        let actorRoleOverride: string | undefined = undefined;
        let authMethodOverride: AuditAuthMethod | undefined = undefined;

        if (contentTypeHeader.includes("multipart/form-data")) {
          const formData = await request.formData();
          const fileEntry = formData.get("file");
          if (fileEntry && typeof (fileEntry as Blob).arrayBuffer === "function") {
            const fileObj = fileEntry as File;
            filename = fileObj.name || filename;
            mimeType = fileObj.type || mimeType;
            const buf = await fileObj.arrayBuffer();
            bytes = new Uint8Array(buf);
          }
          const incVal = formData.get("incidentId");
          if (incVal) {
            const parsedId = Number(incVal);
            if (Number.isFinite(parsedId) && parsedId > 0) {
              incidentId = parsedId;
            }
          }
          const altVal = formData.get("imageAlt");
          if (typeof altVal === "string") imageAlt = altVal;
          const capVal = formData.get("imageCaption");
          if (typeof capVal === "string") imageCaption = capVal;
          const reasonVal = formData.get("reason");
          if (typeof reasonVal === "string") reason = reasonVal;
        } else {
          const body = (await request.json()) as {
            filename?: string;
            contentType?: string;
            base64Data?: string;
            incidentId?: number | string;
            imageAlt?: string;
            imageCaption?: string;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          };
          if (body.filename) filename = body.filename;
          if (body.contentType) mimeType = body.contentType;
          if (body.incidentId !== undefined) {
            const parsedId = Number(
              String(body.incidentId).replace(/^d1-inc-/i, "")
            );
            if (Number.isFinite(parsedId) && parsedId > 0) {
              incidentId = parsedId;
            }
          }
          imageAlt = body.imageAlt;
          imageCaption = body.imageCaption;
          reason = body.reason;
          actorEmailOverride = body.actorEmail;
          actorRoleOverride = body.actorRole;
          authMethodOverride = body.authMethod;

          if (body.base64Data) {
            const cleaned = body.base64Data.replace(
              /^data:[^;]+;base64,/i,
              ""
            );
            const binaryStr = atob(cleaned);
            const arr = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              arr[i] = binaryStr.charCodeAt(i);
            }
            bytes = arr;
          }
        }

        if (!bytes || bytes.byteLength === 0) {
          return jsonResponse(
            { ok: false, error: "No image bytes provided for upload." },
            400
          );
        }

        const uploadResult = await uploadAdminMediaToR2({
          db: env.DB,
          audioBucket: env.AUDIO_BUCKET,
          filename,
          contentType: mimeType,
          bytes,
          incidentId,
          imageAlt,
          imageCaption,
          reason,
          actor: {
            actorEmail: actorEmailOverride || actor.email,
            actorRole: actorRoleOverride || actor.role,
            authMethod: authMethodOverride || actor.authMethod,
            actorIpHash: await hashActorIp(clientIp),
          },
        });

        return jsonResponse(
          {
            ...uploadResult,
            mediaKey: uploadResult.key,
            mediaUrl: uploadResult.url,
            byteLength: uploadResult.sizeBytes,
            auditEventId: uploadResult.auditEntry?.eventId,
          },
          201,
          { "Cache-Control": "no-store" }
        );
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          },
          400
        );
      }
    }

    // Admin Editorial Incidents Studio Route: GET / PUT / POST /api/admin/incidents
    if (url.pathname === "/api/admin/incidents") {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }

      if (request.method === "GET") {
        try {
          const status = url.searchParams.get("status") || undefined;
          const search = url.searchParams.get("search") || undefined;
          const onlyRewritten =
            url.searchParams.get("rewrittenOnly") === "true" ||
            url.searchParams.get("rewrittenOnly") === "1" ||
            url.searchParams.get("onlyRewritten") === "true";
          const limit = url.searchParams.get("limit")
            ? parseInt(url.searchParams.get("limit")!, 10)
            : 100;

          const data = await listAdminIncidentsAndTransforms(env.DB, {
            status,
            search,
            onlyRewritten,
            limit,
          });

          return jsonResponse(
            {
              ok: true,
              ...data,
              counts: {
                ...data.counts,
                rewritten: data.counts.titleRewritten,
              },
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500
          );
        }
      }

      if (request.method === "PUT" || request.method === "POST") {
        if (actor.role === "auditor") {
          return jsonResponse(
            { ok: false, error: "Forbidden: Auditor role is read-only." },
            403
          );
        }

        const clientIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        try {
          const body = (await request.json()) as {
            action?:
              | "rewrite_title"
              | "attach_image"
              | "override_brief"
              | "resynthesize"
              | "update_transform";
            id?: number | string;
            incidentId?: number | string;
            newTitle?: string;
            autoDeescalate?: boolean;
            restoreOriginal?: boolean;
            imageUrl?: string | null;
            imageAlt?: string | null;
            imageCaption?: string | null;
            imageSourceType?: ImageSourceType;
            extractFromSource?: boolean;
            generateSvgCard?: boolean;
            executiveSummary?: string;
            socraticBrief?: string;
            noiseOverblown?: string;
            structuralSignal?: string;
            questions?: string[];
            primaryTool?: JevWorkingToolKey;
            secondaryTool?: JevWorkingToolKey;
            sreFailureMode?: JevSreFailureModeKey;
            status?:
              | "dropped"
              | "triaged"
              | "synthesized"
              | "QUARANTINED"
              | "PENDING_RETRY";
            isPinned?: boolean;
            isHidden?: boolean;
            isLeadPostMortem?: boolean;
            leadPostMortemAnalysis?: string | null;
            editorialNotes?: string | null;
            transformKey?: string;
            enabled?: boolean;
            config?: Record<string, unknown>;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          };

          const resolvedActor = {
            actorEmail: body.actorEmail || actor.email,
            actorRole: body.actorRole || actor.role,
            authMethod: body.authMethod || actor.authMethod,
            actorIpHash: await hashActorIp(clientIp),
          };

          const action = body.action || "override_brief";

          if (action === "update_transform") {
            if (!body.transformKey) {
              return jsonResponse(
                { ok: false, error: "Missing required transformKey" },
                400
              );
            }
            const transformResult = await updatePipelineTransform(
              env.DB,
              {
                idOrKey: body.transformKey,
                enabled: body.enabled,
                config: body.config,
                reason: body.reason,
              },
              resolvedActor
            );
            const data = await listAdminIncidentsAndTransforms(env.DB, {
              limit: 100,
            });
            return jsonResponse(
              {
                ok: true,
                ...transformResult,
                ...data,
                counts: {
                  ...data.counts,
                  rewritten: data.counts.titleRewritten,
                },
              },
              200,
              { "Cache-Control": "no-store" }
            );
          }

          const rawId = body.incidentId ?? body.id ?? url.searchParams.get("id");
          const incidentId = Number(
            String(rawId || "").replace(/^d1-inc-/i, "")
          );
          if (!Number.isFinite(incidentId) || incidentId <= 0) {
            return jsonResponse(
              { ok: false, error: "Valid incidentId is required." },
              400
            );
          }

          if (action === "rewrite_title") {
            const mode = body.restoreOriginal
              ? "restore_original"
              : body.autoDeescalate
              ? "ai_deescalate"
              : "manual_override";
            const result = await rewriteIncidentTitle(
              env.DB,
              {
                id: incidentId,
                mode,
                newTitle: body.newTitle,
                reason: body.reason,
                geminiApiKey: env.GEMINI_API_KEY,
              },
              resolvedActor
            );
            const data = await listAdminIncidentsAndTransforms(env.DB, {
              limit: 100,
            });
            return jsonResponse(
              {
                ok: true,
                ...result,
                ...data,
                counts: {
                  ...data.counts,
                  rewritten: data.counts.titleRewritten,
                },
              },
              200,
              { "Cache-Control": "no-store" }
            );
          }

          if (action === "attach_image") {
            const mode = body.generateSvgCard
              ? "generated_card"
              : body.extractFromSource
              ? "rss_extracted"
              : !body.imageUrl || body.imageSourceType === "none"
              ? "remove"
              : body.imageSourceType === "r2_upload" ||
                body.imageSourceType === "upload" ||
                body.imageUrl.startsWith("/media/")
              ? "r2_upload"
              : "external_url";

            const result = await attachIncidentImage(
              env.DB,
              {
                id: incidentId,
                mode,
                imageUrl: body.imageUrl,
                imageAlt: body.imageAlt,
                imageCaption: body.imageCaption,
                reason: body.reason,
                audioBucket: env.AUDIO_BUCKET,
              },
              resolvedActor
            );
            const data = await listAdminIncidentsAndTransforms(env.DB, {
              limit: 100,
            });
            return jsonResponse(
              {
                ok: true,
                ...result,
                ...data,
                counts: {
                  ...data.counts,
                  rewritten: data.counts.titleRewritten,
                },
              },
              200,
              { "Cache-Control": "no-store" }
            );
          }

          if (action === "resynthesize") {
            const beforeIncident = await getAdminIncidentById(
              env.DB,
              incidentId
            );
            if (!beforeIncident) {
              return jsonResponse(
                { ok: false, error: `Incident #${incidentId} not found.` },
                404
              );
            }
            const synthSummary = await runSynthesizePipeline({
              db: env.DB,
              geminiApiKey: env.GEMINI_API_KEY,
              articleIds: [incidentId],
              limit: 1,
            });
            const afterIncident = await getAdminIncidentById(
              env.DB,
              incidentId
            );
            const auditEntry = await appendAuditEntry(env.DB, {
              actorEmail: resolvedActor.actorEmail,
              actorRole: resolvedActor.actorRole,
              authMethod: resolvedActor.authMethod,
              actorIpHash: resolvedActor.actorIpHash,
              actionType: "incident.override_brief",
              targetType: "incident_article",
              targetId: String(incidentId),
              reason:
                body.reason ||
                `Re-triggered System-2 Gemini synthesis for incident #${incidentId}.`,
              beforeState: beforeIncident.row,
              afterState: afterIncident?.row ?? null,
            });
            const data = await listAdminIncidentsAndTransforms(env.DB, {
              limit: 100,
            });
            return jsonResponse(
              {
                ok: true,
                incident: afterIncident?.record,
                synthesis: synthSummary,
                auditEventId: auditEntry.eventId,
                ...data,
                counts: {
                  ...data.counts,
                  rewritten: data.counts.titleRewritten,
                },
              },
              200,
              { "Cache-Control": "no-store" }
            );
          }

          // Default action: override_brief
          const result = await overrideIncidentBriefAndClassification(
            env.DB,
            {
              id: incidentId,
              executiveSummary: body.executiveSummary,
              socraticBrief: body.socraticBrief,
              noiseOverblown: body.noiseOverblown,
              structuralSignal: body.structuralSignal,
              questions: body.questions,
              primaryTool: body.primaryTool,
              secondaryTool: body.secondaryTool,
              sreFailureMode: body.sreFailureMode,
              status: body.status,
              isPinned: body.isPinned,
              isHidden: body.isHidden,
              isLeadPostMortem: body.isLeadPostMortem,
              leadPostMortemAnalysis: body.leadPostMortemAnalysis,
              editorialNotes: body.editorialNotes,
              reason: body.reason,
            },
            resolvedActor
          );
          const data = await listAdminIncidentsAndTransforms(env.DB, {
            limit: 100,
          });
          return jsonResponse(
            {
              ok: true,
              ...result,
              ...data,
              counts: {
                ...data.counts,
                rewritten: data.counts.titleRewritten,
              },
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }
    }

    // Admin Editorial Pipeline Transforms Route: GET / PUT / POST /api/admin/transforms
    if (url.pathname === "/api/admin/transforms") {
      const actor = await resolveAdminActor(request, env);
      if (!actor) {
        return jsonResponse(
          { ok: false, error: "Unauthorized: Admin authentication required" },
          401
        );
      }

      if (request.method === "GET") {
        try {
          const transforms = await listPipelineTransforms(env.DB);
          return jsonResponse(
            {
              ok: true,
              transforms,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            500
          );
        }
      }

      if (request.method === "PUT" || request.method === "POST") {
        if (actor.role === "auditor") {
          return jsonResponse(
            { ok: false, error: "Forbidden: Auditor role is read-only." },
            403
          );
        }

        const clientIp =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for");

        try {
          const body = (await request.json()) as {
            transformKey?: string;
            enabled?: boolean;
            config?: Record<string, unknown>;
            reason?: string;
            actorEmail?: string;
            actorRole?: string;
            authMethod?: AuditAuthMethod;
          };

          if (!body.transformKey) {
            return jsonResponse(
              { ok: false, error: "Missing required transformKey" },
              400
            );
          }

          const result = await updatePipelineTransform(
            env.DB,
            {
              idOrKey: body.transformKey,
              enabled: body.enabled,
              config: body.config,
              reason: body.reason,
            },
            {
              actorEmail: body.actorEmail || actor.email,
              actorRole: body.actorRole || actor.role,
              authMethod: body.authMethod || actor.authMethod,
              actorIpHash: await hashActorIp(clientIp),
            }
          );

          const transforms = await listPipelineTransforms(env.DB);
          return jsonResponse(
            {
              ok: true,
              ...result,
              auditEventId: result.auditEntry.eventId,
              transforms,
            },
            200,
            { "Cache-Control": "no-store" }
          );
        } catch (err) {
          return jsonResponse(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            400
          );
        }
      }
    }

    return jsonResponse({ error: "Not Found", path: url.pathname }, 404);
  },

  async scheduled(
    controller: ScheduledControllerLike,
    env: WorkerEnv,
    ctx: ExecutionContextLike
  ): Promise<void> {
    if (controller.cron === "0 */6 * * *") {
      ctx.waitUntil(
        (async () => {
          try {
            await runD1IngestPipeline({
              db: env.DB,
              typesafeApiKey: env.TYPESAFE_API_KEY,
              maxNetNew: 10,
              itemsPerFeed: 5,
            });
          } catch (err) {
            console.error("[Scheduled 6h Cron] Ingest stage error:", err);
          }
          try {
            await runSynthesizePipeline({
              db: env.DB,
              geminiApiKey: env.GEMINI_API_KEY,
              limit: 5,
            });
          } catch (err) {
            console.error("[Scheduled 6h Cron] Synthesize stage error:", err);
          }
        })()
      );
    } else if (controller.cron === "0 12 * * 5") {
      // Weekly Friday 12:00 UTC rollup hook: runs latest ingestion + synthesis sweep, then generates the Weekly Rollup
      ctx.waitUntil(
        (async () => {
          try {
            await runD1IngestPipeline({
              db: env.DB,
              typesafeApiKey: env.TYPESAFE_API_KEY,
              maxNetNew: 10,
              itemsPerFeed: 5,
            });
          } catch (err) {
            console.error("[Scheduled Friday Cron] Ingest stage error:", err);
          }
          try {
            await runSynthesizePipeline({
              db: env.DB,
              geminiApiKey: env.GEMINI_API_KEY,
              limit: 5,
            });
          } catch (err) {
            console.error(
              "[Scheduled Friday Cron] Synthesize stage error:",
              err
            );
          }
          try {
            await runWeeklyRollupPipeline({
              db: env.DB,
              audioBucket: env.AUDIO_BUCKET,
              geminiApiKey: env.GEMINI_API_KEY,
            });
          } catch (err) {
            console.error("[Scheduled Friday Cron] Rollup stage error:", err);
          }
        })()
      );
    }
  },
};

export default worker;
