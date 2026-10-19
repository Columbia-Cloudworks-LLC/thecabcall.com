import React, { Suspense } from "react";
import {
  ensureD1Snapshot,
  getAllPublicIncidentDtos,
  getPaginatedArchiveDispatches,
} from "@/lib/store";
import { KnowledgeGraphClient } from "@/components/KnowledgeGraphClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Archive & Knowledge Graph — Dual-Axis Taxonomy & Master Case Ledger",
  description:
    "Browse the complete Master Case Ledger of verified post-incident dispatches, filter across the 6×6 Working Tools × Failure Modes Diagnostic Matrix, and inspect Monitored Publications.",
};

export default async function KnowledgeGraphPage() {
  await ensureD1Snapshot();
  const incidents = getAllPublicIncidentDtos();
  const initialArchivePage = getPaginatedArchiveDispatches({
    page: 1,
    pageSize: 25,
  });

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-12 font-mono text-sm text-[#C5A059]">
          Loading Master Case Ledger &amp; 6×6 Diagnostic Matrix…
        </div>
      }
    >
      <KnowledgeGraphClient
        incidents={incidents}
        initialArchivePage={initialArchivePage}
      />
    </Suspense>
  );
}
