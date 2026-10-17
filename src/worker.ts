import {
  AppendAuditEntryInput,
  appendAuditEntry,
  exportAuditDisclosureBundle,
  hashActorIp,
  listAuditEntries,
  replayAuditEntry,
  verifyAuditChainIntegrity,
} from "./pipeline/audit";
import {
  D1DatabaseLike,
  runD1IngestPipeline,
  US_HIGH_IMPACT_FEEDS,
} from "./pipeline/ingest";
import { evaluateArticleWithJev } from "./pipeline/jev";
import { R2BucketLike, runWeeklyRollupPipeline } from "./pipeline/rollup";
import { runSynthesizePipeline } from "./pipeline/synthesize";

export interface WorkerEnv {
  DB: D1DatabaseLike;
  AUDIO_BUCKET: R2BucketLike;
  TYPESAFE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ADMIN_SECRET?: string;
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

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-secret",
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

function isAuthorizedAdmin(request: Request, env: WorkerEnv): boolean {
  const expectedSecret = env.ADMIN_SECRET || "local-dev-secret";
  const providedSecret = request.headers.get("x-admin-secret");
  return Boolean(providedSecret && providedSecret === expectedSecret);
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

    // Health & status check
    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse({
        service: "thecabcall.com Cloudflare Worker Pipeline",
        system1Model: "jev-1.14.0",
        system2Model: "gemini-2.5-flash (with gemini-3.8-flash fallback)",
        feeds: US_HIGH_IMPACT_FEEDS,
        endpoints: {
          snapshot:
            "GET /api/snapshot (public edge-cached D1 telemetry snapshot)",
          auditList:
            "GET /api/admin/audit (list & filter immutable audit_ledger entries)",
          auditVerify:
            "GET /api/admin/audit/verify (verify SHA-256 cryptographic hash chain)",
          auditReplay:
            "POST /api/admin/audit/replay (requires x-admin-secret; deterministic state revert/replay)",
          auditExport:
            "GET /api/admin/audit/export (signed JSON & Markdown public disclosure bundle)",
          testJev: "POST /api/test-jev (requires x-admin-secret header)",
          runIngest:
            "POST /api/run-ingest (requires x-admin-secret header; optional ?synthesize=true)",
          runSynthesize:
            "POST /api/run-synthesize (requires x-admin-secret header)",
          runRollup: "POST /api/run-rollup (requires x-admin-secret header)",
          audioStream: "GET /audio/:filename (supports Range requests)",
        },
      });
    }

    // Public Route: GET /api/snapshot (Returns live D1 telemetry_articles, episodes, and pipeline_runs)
    if (request.method === "GET" && url.pathname === "/api/snapshot") {
      try {
        const articlesRes = await env.DB.prepare(
          `SELECT * FROM telemetry_articles
           ORDER BY
             CASE WHEN status = 'synthesized' THEN 0 WHEN status = 'triaged' THEN 1 ELSE 2 END,
             published_at DESC,
             id DESC`
        ).all<Record<string, unknown>>();
        const articles = articlesRes.results || [];

        let episodes: Record<string, unknown>[] = [];
        try {
          const episodesRes = await env.DB.prepare(
            "SELECT * FROM episodes ORDER BY published_at DESC, id DESC"
          ).all<Record<string, unknown>>();
          episodes = episodesRes.results || [];
        } catch {
          episodes = [];
        }

        let pipelineRuns: Record<string, unknown>[] = [];
        try {
          const runsRes = await env.DB.prepare(
            "SELECT * FROM pipeline_runs ORDER BY started_at DESC, id DESC LIMIT 50"
          ).all<Record<string, unknown>>();
          pipelineRuns = runsRes.results || [];
        } catch {
          pipelineRuns = [];
        }

        const synthesizedCount = articles.filter(
          (r) => r.status === "synthesized"
        ).length;
        const triagedCount = articles.filter(
          (r) => r.status === "triaged"
        ).length;
        const droppedCount = articles.filter(
          (r) => r.status === "dropped"
        ).length;

        const forceFresh =
          url.searchParams.get("fresh") === "1" ||
          url.searchParams.get("fresh") === "true";

        return jsonResponse(
          {
            ok: true,
            source: "cloudflare-d1",
            database: "cabcall-db",
            timestamp: new Date().toISOString(),
            counts: {
              synthesizedCount,
              triagedCount,
              droppedCount,
              totalEvaluated: articles.length,
            },
            articles,
            episodes,
            pipelineRuns,
          },
          200,
          {
            "Cache-Control": forceFresh
              ? "no-store"
              : "public, s-maxage=30, stale-while-revalidate=120",
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
      if (!isAuthorizedAdmin(request, env)) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing x-admin-secret header" },
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
      if (!isAuthorizedAdmin(request, env)) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing x-admin-secret header" },
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
      if (!isAuthorizedAdmin(request, env)) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing x-admin-secret header" },
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
            actorEmail:
              request.headers.get("x-actor-email") || "system@thecabcall.com",
            actorRole: "owner",
            authMethod: "admin_secret",
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
        if (!isAuthorizedAdmin(request, env)) {
          return jsonResponse(
            { error: "Unauthorized: Invalid or missing x-admin-secret header" },
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
            actorEmail: body.actorEmail || "system@thecabcall.com",
            authMethod: body.authMethod || "admin_secret",
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
      if (!isAuthorizedAdmin(request, env)) {
        return jsonResponse(
          { error: "Unauthorized: Invalid or missing x-admin-secret header" },
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
            actorEmail: body.actorEmail || "owner@thecabcall.com",
            actorRole: body.actorRole || "owner",
            authMethod: body.authMethod || "admin_secret",
            actorIpHash: await hashActorIp(clientIp),
            reason: body.reason,
          }
        );

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
          await runD1IngestPipeline({
            db: env.DB,
            typesafeApiKey: env.TYPESAFE_API_KEY,
            maxNetNew: 10,
            itemsPerFeed: 5,
          });
          await runSynthesizePipeline({
            db: env.DB,
            geminiApiKey: env.GEMINI_API_KEY,
            limit: 5,
          });
        })()
      );
    } else if (controller.cron === "0 12 * * 5") {
      // Weekly Friday 12:00 UTC rollup hook: runs latest ingestion + synthesis sweep, then generates the Weekly Rollup
      ctx.waitUntil(
        (async () => {
          await runD1IngestPipeline({
            db: env.DB,
            typesafeApiKey: env.TYPESAFE_API_KEY,
            maxNetNew: 10,
            itemsPerFeed: 5,
          });
          await runSynthesizePipeline({
            db: env.DB,
            geminiApiKey: env.GEMINI_API_KEY,
            limit: 5,
          });
          await runWeeklyRollupPipeline({
            db: env.DB,
            audioBucket: env.AUDIO_BUCKET,
            geminiApiKey: env.GEMINI_API_KEY,
          });
        })()
      );
    }
  },
};

export default worker;
