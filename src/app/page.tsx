import React from "react";
import { ensureD1Snapshot, triggerAutoRefreshIfStale } from "@/lib/d1-bridge";
import {
  projectPublicEpisodeDto,
  projectPublicIncidentDto,
} from "@/lib/dto";
import {
  buildWeeklyTrestleboardState,
  getAllIncidents,
  getLatestWeeklyRollup,
  getSystemPostureSummary,
} from "@/lib/store";
import { INITIAL_EPISODES } from "@/lib/seed-data";
import { TrestleboardClient } from "@/components/TrestleboardClient";

export const dynamic = "force-dynamic";

export default async function TrestleboardPage() {
  await ensureD1Snapshot();
  triggerAutoRefreshIfStale(6);
  const rawIncidents = getAllIncidents();
  const posture = getSystemPostureSummary();
  const rawPinnedEpisode = getLatestWeeklyRollup();
  const weeklyState = buildWeeklyTrestleboardState(
    rawIncidents,
    posture,
    rawPinnedEpisode
  );

  const publicIncidents = rawIncidents
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null);

  const publicPinnedEpisode =
    projectPublicEpisodeDto(rawPinnedEpisode) ||
    projectPublicEpisodeDto(INITIAL_EPISODES[0])!;

  return (
    <TrestleboardClient
      initialIncidents={publicIncidents}
      weeklyState={weeklyState}
      pinnedEpisode={publicPinnedEpisode}
    />
  );
}
