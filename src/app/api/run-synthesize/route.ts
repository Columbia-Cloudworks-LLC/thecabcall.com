import { NextRequest, NextResponse } from "next/server";
import { appendAuditEntry, hashActorIp } from "@/lib/audit";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  createLocalSqliteD1Adapter,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
  triggerRemoteWorkerSynthesize,
} from "@/lib/d1-bridge";
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

  let limit = 5;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number") {
      limit = Math.min(10, Math.max(1, body.limit));
    }
  } catch {
    // default limit 5
  }

  if (shouldUseRemoteWorker()) {
    try {
      const remoteResult = await triggerRemoteWorkerSynthesize({
        limit,
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

  const result = await runSynthesizePipeline({
    db,
    geminiApiKey: envVars.GEMINI_API_KEY,
    limit,
  });

  try {
    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await appendAuditEntry(db, {
      actorEmail: auth.actor.email,
      actorRole: auth.actor.role,
      authMethod: auth.actor.authMethod,
      actorIpHash: await hashActorIp(clientIp),
      actionType: "pipeline.run_synthesize",
      targetType: "pipeline",
      targetId: "system2_synthesize",
      reason: `Manual System-2 Gemini 2.5 Flash synthesis triggered (${result.synthesizedCount} briefs synthesized, limit ${result.requestedLimit}).`,
      beforeState: null,
      afterState: {
        requestedLimit: result.requestedLimit,
        synthesizedCount: result.synthesizedCount,
      },
    });
  } catch (err) {
    console.warn("[Audit] Failed to log local pipeline.run_synthesize:", err);
  }

  return NextResponse.json({
    ok: true,
    stage: "Stage 4 System-2 Bounded Socratic Synthesis",
    ...result,
  });
}
