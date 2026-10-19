import React from "react";
import { RubricCodexClient } from "@/components/RubricCodexClient";
import {
  ensureD1Snapshot,
  getAllPublicIncidentDtos,
  getPaginatedArchiveDispatches,
} from "@/lib/store";
import { WORKING_TOOLS, WorkingToolId } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Working Tools & Rubric — Three-Axis Methodology Codex & Visual Directory",
  description:
    "Explore the Six Working Tools of Freemasonry (Axis I), the Six Site Reliability Engineering Structural Failure Modes (Axis II), and the Five Civic & Industrial Sectors (Axis III).",
};

export default async function RubricPage() {
  await ensureD1Snapshot();
  const archiveSummary = getPaginatedArchiveDispatches({ page: 1, pageSize: 25 });
  const corpus = getAllPublicIncidentDtos();

  // Compute total tagged (primary + secondary) per Working Tool
  const toolCounts: Partial<Record<WorkingToolId, number>> = {};
  for (const t of WORKING_TOOLS) {
    toolCounts[t.id] = corpus.filter(
      (inc) => inc.primaryTool === t.id || inc.secondaryTool === t.id
    ).length;
  }

  return (
    <RubricCodexClient
      toolCounts={toolCounts}
      failureCounts={archiveSummary.failureColTotals}
      sectorCounts={archiveSummary.sectorCounts}
    />
  );
}
