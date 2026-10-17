import { NextResponse } from "next/server";
import {
  createLocalR2AudioAdapter,
  createLocalSqliteD1Adapter,
  ensureD1Snapshot,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
  triggerRemoteWorkerRollup,
} from "@/lib/d1-bridge";
import { generateWeeklyRollupEpisode } from "@/lib/pipeline";
import {
  getLatestWeeklyRollup,
  getPipelineRuns,
  getSystemPostureSummary,
} from "@/lib/store";
import { runWeeklyRollupPipeline } from "@/pipeline/rollup";

export const dynamic = "force-dynamic";

async function executeD1WeeklyRollup() {
  if (shouldUseRemoteWorker()) {
    try {
      const remoteResult = await triggerRemoteWorkerRollup();
      await ensureD1Snapshot(true);
      const episode = getLatestWeeklyRollup();
      const runs = getPipelineRuns();
      const posture = getSystemPostureSummary();

      return {
        ok: true,
        pipeline: "Cloudflare Worker Bridge (cabcall-db + cabcall-audio)",
        episode,
        rollupRecord: remoteResult.episode,
        run: runs[0],
        runs,
        posture,
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
    const episode = generateWeeklyRollupEpisode();
    const runs = getPipelineRuns();
    return {
      ok: true,
      episode,
      run: runs[0],
      runs,
      posture: getSystemPostureSummary(),
    };
  }

  const envVars = loadLocalEnvVars();
  const audioBucket = createLocalR2AudioAdapter();
  const rollupRecord = await runWeeklyRollupPipeline({
    db,
    audioBucket,
    geminiApiKey: envVars.GEMINI_API_KEY,
  });

  const episode = getLatestWeeklyRollup();
  const runs = getPipelineRuns();
  const posture = getSystemPostureSummary();

  return {
    ok: true,
    episode,
    rollupRecord,
    run: runs[0],
    runs,
    posture,
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
