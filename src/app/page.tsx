import React from "react";
import { ensureD1Snapshot, triggerAutoRefreshIfStale } from "@/lib/d1-bridge";
import {
  buildWeeklyTrestleboardState,
  getAllIncidents,
  getLatestWeeklyRollup,
  getSystemPostureSummary,
} from "@/lib/store";
import { TrestleboardClient } from "@/components/TrestleboardClient";

export const dynamic = "force-dynamic";

export default async function TrestleboardPage() {
  await ensureD1Snapshot();
  triggerAutoRefreshIfStale(6);
  const incidents = getAllIncidents();
  const posture = getSystemPostureSummary();
  const pinnedEpisode = getLatestWeeklyRollup();
  const weeklyState = buildWeeklyTrestleboardState(
    incidents,
    posture,
    pinnedEpisode
  );

  return (
    <TrestleboardClient
      initialIncidents={incidents}
      weeklyState={weeklyState}
      pinnedEpisode={pinnedEpisode}
    />
  );
}

