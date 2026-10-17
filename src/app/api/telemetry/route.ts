import { NextResponse } from "next/server";
import {
  ensureD1Snapshot,
  triggerAutoRefreshIfStale,
} from "@/lib/d1-bridge";
import {
  getAllEpisodes,
  getAllIncidents,
  getPipelineRuns,
  getSystemPostureSummary,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const d1 = await ensureD1Snapshot();
  triggerAutoRefreshIfStale(6);

  return NextResponse.json({
    d1: {
      available: d1.available,
      source: d1.source || "none",
      endpoint: d1.sqlitePath,
      synthesizedCount: d1.synthesizedCount,
      triagedCount: d1.triagedCount,
      droppedCount: d1.droppedCount,
      totalEvaluated: d1.totalEvaluated,
      d1IncidentCount: d1.incidents.length,
      d1EpisodeCount: d1.episodes.length,
      d1PipelineRunCount: d1.pipelineRuns.length,
    },
    posture: getSystemPostureSummary(),
    incidents: getAllIncidents(),
    episodes: getAllEpisodes(),
    pipelineRuns: getPipelineRuns(),
  });
}
