import { NextRequest, NextResponse } from "next/server";
import { appendAuditEntry, hashActorIp } from "@/lib/audit";
import { requireAdminRequestActor } from "@/lib/auth";
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
  const auth = await requireAdminRequestActor(req, [
    "owner",
    "admin",
    "editor",
  ]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized: Admin session or x-admin-secret required" },
      { status: auth.status }
    );
  }

  const envVars = loadLocalEnvVars();

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
        actor: {
          email: auth.actor.email,
          role: auth.actor.role,
          authMethod: auth.actor.authMethod,
        },
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

  try {
    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await appendAuditEntry(db, {
      actorEmail: auth.actor.email,
      actorRole: auth.actor.role,
      authMethod: auth.actor.authMethod,
      actorIpHash: await hashActorIp(clientIp),
      actionType: "pipeline.run_ingest",
      targetType: "pipeline",
      targetId: "rss_ingest",
      reason: `Manual RSS ingest & System-1 Jev triage triggered (${summary.ingestedCount} evaluated, ${summary.triagedCount} triaged, ${summary.droppedCount} dropped).`,
      beforeState: null,
      afterState: {
        ingestedCount: summary.ingestedCount,
        triagedCount: summary.triagedCount,
        droppedCount: summary.droppedCount,
      },
    });
  } catch (err) {
    console.warn("[Audit] Failed to log local pipeline.run_ingest:", err);
  }

  return NextResponse.json({
    ok: true,
    model: "jev-1.14.0",
    ...summary,
    synthesis: synthesisSummary,
  });
}
