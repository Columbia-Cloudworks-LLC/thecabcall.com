import { NextRequest, NextResponse } from "next/server";
import {
  createLocalSqliteD1Adapter,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
  triggerRemoteWorkerIngest,
} from "@/lib/d1-bridge";
import { runD1IngestPipeline } from "@/pipeline/ingest";
import { runSynthesizePipeline } from "@/pipeline/synthesize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const envVars = loadLocalEnvVars();
  const providedSecret = req.headers.get("x-admin-secret");

  if (!providedSecret || providedSecret !== envVars.ADMIN_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing x-admin-secret header" },
      { status: 401 }
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
    body = await req.json();
  } catch {
    // ignore empty body
  }

  const url = new URL(req.url);
  const chainSynthesize =
    url.searchParams.get("synthesize") === "true" || body.synthesize === true;

  if (shouldUseRemoteWorker()) {
    try {
      const remoteResult = await triggerRemoteWorkerIngest({
        synthesize: chainSynthesize,
        synthesizeLimit: body.synthesizeLimit ?? 5,
        maxNetNew: body.maxNetNew ?? 10,
        customArticle: body.customArticle,
      });
      return NextResponse.json(remoteResult);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return NextResponse.json(
      { error: "Local Wrangler D1 database not found in .wrangler/state/v3/d1" },
      { status: 500 }
    );
  }

  const summary = await runD1IngestPipeline({
    db,
    typesafeApiKey: envVars.TYPESAFE_API_KEY,
    maxNetNew: body.maxNetNew ?? 10,
    itemsPerFeed: 5,
    customArticle: body.customArticle,
  });

  let synthesisSummary = undefined;
  if (chainSynthesize) {
    synthesisSummary = await runSynthesizePipeline({
      db,
      geminiApiKey: envVars.GEMINI_API_KEY,
      limit: body.synthesizeLimit ?? 5,
    });
  }

  return NextResponse.json({
    ok: true,
    model: "jev-1.14.0",
    ...summary,
    synthesis: synthesisSummary,
  });
}
