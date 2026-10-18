import { NextResponse } from "next/server";
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

async function executeD1WeeklyRollup() {
  if (shouldUseRemoteWorker()) {
    try {
      await triggerRemoteWorkerRollup();
      await ensureD1Snapshot(true);
      const episode = projectPublicEpisodeDto(getLatestWeeklyRollup());

      return {
        ok: true,
        episode,
      };
    } catch (err) {
      console.warn(
        "[Cron Weekly Rollup] Remote Cloudflare Worker call failed, checking local fallback:",
        err
      );
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    const episode = projectPublicEpisodeDto(generateWeeklyRollupEpisode());
    return {
      ok: true,
      episode,
    };
  }

  const envVars = loadLocalEnvVars();
  const audioBucket = createLocalR2AudioAdapter();
  await runWeeklyRollupPipeline({
    db,
    audioBucket,
    geminiApiKey: envVars.GEMINI_API_KEY,
  });

  const episode = projectPublicEpisodeDto(getLatestWeeklyRollup());

  return {
    ok: true,
    episode,
  };
}

export async function GET() {
  const result = await executeD1WeeklyRollup();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await executeD1WeeklyRollup();
  return NextResponse.json(result);
}
