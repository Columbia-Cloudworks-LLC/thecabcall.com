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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
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

    // Health & status check
    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse({
        service: "thecabcall.com Cloudflare Worker Pipeline",
        system1Model: "jev-1.14.0",
        system2Model: "gemini-2.5-flash (with gemini-3.8-flash fallback)",
        feeds: US_HIGH_IMPACT_FEEDS,
        endpoints: {
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
        body.synthesize === true;

      try {
        const summary = await runD1IngestPipeline({
          db: env.DB,
          typesafeApiKey: env.TYPESAFE_API_KEY,
          maxNetNew: body.maxNetNew ?? 10,
          itemsPerFeed: 5,
        });

        let synthesisSummary = undefined;
        if (chainSynthesize) {
          synthesisSummary = await runSynthesizePipeline({
            db: env.DB,
            geminiApiKey: env.GEMINI_API_KEY,
            limit: body.synthesizeLimit ?? 5,
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
