import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  createLocalR2AudioAdapter,
  createLocalSqliteD1Adapter,
  ensureD1Snapshot,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
  triggerRemoteWorkerRollup,
} from "@/lib/d1-bridge";
import { projectPublicEpisodeDto } from "@/lib/dto";
import { generateWeeklyRollupEpisode } from "@/lib/pipeline";
import { getLatestWeeklyRollup } from "@/lib/store";
import { runWeeklyRollupPipeline } from "@/pipeline/rollup";

export const dynamic = "force-dynamic";

async function isAuthorizedCronOrAdmin(req: NextRequest): Promise<{
  authorized: boolean;
  status: number;
  error?: string;
}> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization")?.trim();
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, status: 200 };
  }

  const adminAuth = await requireAdminRequestActor(req, [
    "owner",
    "admin",
    "editor",
  ]);
  if (adminAuth.authorized) {
    return { authorized: true, status: 200 };
  }

  return {
    authorized: false,
    status: adminAuth.status || 401,
    error:
      "Unauthorized: Podcast rollup generation is restricted to Administrators.",
  };
}

async function executeD1WeeklyRollup() {
  await ensureD1Snapshot(true);
  const episode = projectPublicEpisodeDto(getLatestWeeklyRollup());
  return {
    ok: true,
    skipped: true,
    reason:
      "Automatic article-to-podcast rollup generation is disabled; episodes are published using externally produced MP3/M4A audio files.",
    episode,
  };
}

export async function GET(req: NextRequest) {
  const auth = await isAuthorizedCronOrAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const result = await executeD1WeeklyRollup();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = await isAuthorizedCronOrAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const result = await executeD1WeeklyRollup();
  return NextResponse.json(result);
}
