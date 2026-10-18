import React, { Suspense } from "react";
import { projectPublicIncidentDto } from "@/lib/dto";
import { ensureD1Snapshot, getAllIncidents } from "@/lib/store";
import { KnowledgeGraphClient } from "@/components/KnowledgeGraphClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Knowledge Graph — Dual-Axis Taxonomy & Archive Explorer",
};

export default async function KnowledgeGraphPage() {
  await ensureD1Snapshot();
  const incidents = getAllIncidents()
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null);

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-12 font-mono text-sm text-[#C5A059]">
          Loading Knowledge Graph Matrix...
        </div>
      }
    >
      <KnowledgeGraphClient incidents={incidents} />
    </Suspense>
  );
}
