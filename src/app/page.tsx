import React from "react";
import {
  getAllIncidents,
  getLatestWeeklyRollup,
  getSystemPostureSummary,
} from "@/lib/store";
import { TrestleboardClient } from "@/components/TrestleboardClient";

export const dynamic = "force-dynamic";

export default function TrestleboardPage() {
  const incidents = getAllIncidents();
  const posture = getSystemPostureSummary();
  const pinnedEpisode = getLatestWeeklyRollup();

  return (
    <TrestleboardClient
      initialIncidents={incidents}
      posture={posture}
      pinnedEpisode={pinnedEpisode}
    />
  );
}
