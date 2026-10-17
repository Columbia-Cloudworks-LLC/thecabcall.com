import { NextResponse } from "next/server";
import {
  getAllEpisodes,
  getAllIncidents,
  getPipelineRuns,
  getSystemPostureSummary,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    posture: getSystemPostureSummary(),
    incidents: getAllIncidents(),
    episodes: getAllEpisodes(),
    pipelineRuns: getPipelineRuns(),
  });
}
