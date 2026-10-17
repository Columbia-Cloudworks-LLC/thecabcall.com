import React from "react";
import { getPipelineRuns, getSystemPostureSummary } from "@/lib/store";
import { SystemStatusClient } from "@/components/SystemStatusClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Status & Pipeline Architecture — Colophon & Transparency",
};

export default function SystemStatusPage() {
  const runs = getPipelineRuns();
  const posture = getSystemPostureSummary();

  return <SystemStatusClient initialRuns={runs} posture={posture} />;
}
