import React from "react";
import {
  ensureD1Snapshot,
  getPipelineRuns,
  getSystemPostureSummary,
} from "@/lib/store";
import { SystemStatusClient } from "@/components/SystemStatusClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Status & Pipeline Architecture — Colophon & Transparency",
};

export default async function SystemStatusPage() {
  await ensureD1Snapshot();
  const runs = getPipelineRuns();
  const posture = getSystemPostureSummary();

  return <SystemStatusClient initialRuns={runs} posture={posture} />;
}
