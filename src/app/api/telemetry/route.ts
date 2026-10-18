import { NextResponse } from "next/server";
import {
  ensureD1Snapshot,
  triggerAutoRefreshIfStale,
} from "@/lib/d1-bridge";
import { projectPublicSnapshotDto } from "@/lib/dto";
import {
  getAllEpisodes,
  getAllIncidents,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureD1Snapshot();
  triggerAutoRefreshIfStale(6);

  const snapshot = projectPublicSnapshotDto({
    incidents: getAllIncidents(),
    episodes: getAllEpisodes(),
  });

  return NextResponse.json(snapshot);
}
