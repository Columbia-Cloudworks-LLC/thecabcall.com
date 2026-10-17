import { NextRequest, NextResponse } from "next/server";
import { appendAuditEntry, hashActorIp } from "@/lib/audit";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  createLocalR2AudioAdapter,
  createLocalSqliteD1Adapter,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
  triggerRemoteWorkerRollup,
} from "@/lib/d1-bridge";
import { runWeeklyRollupPipeline } from "@/pipeline/rollup";

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

  if (shouldUseRemoteWorker()) {
    try {
      const remoteResult = await triggerRemoteWorkerRollup({
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

  const audioBucket = createLocalR2AudioAdapter();
  const episode = await runWeeklyRollupPipeline({
    db,
    audioBucket,
    geminiApiKey: envVars.GEMINI_API_KEY,
  });

  try {
    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await appendAuditEntry(db, {
      actorEmail: auth.actor.email,
      actorRole: auth.actor.role,
      authMethod: auth.actor.authMethod,
      actorIpHash: await hashActorIp(clientIp),
      actionType: "episode.generate",
      targetType: "episode",
      targetId: String(episode.id ?? episode.slug),
      reason: `Generated podcast rollup episode #${episode.episode_number}: ${episode.title}`,
      beforeState: null,
      afterState: episode,
    });
  } catch (err) {
    console.warn("[Audit] Failed to log local episode.generate:", err);
  }

  return NextResponse.json({
    ok: true,
    stage: "Friday 5-Minute CAB Weekly Brief Rollup",
    episode,
  });
}
