import React, { Suspense } from "react";
import { getAllIncidents } from "@/lib/store";
import { KnowledgeGraphClient } from "@/components/KnowledgeGraphClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Knowledge Graph — Dual-Axis Taxonomy & Archive Explorer",
};

export default function KnowledgeGraphPage() {
  const incidents = getAllIncidents();

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-12 font-mono text-sm text-[#C5A059]">
          Loading Knowledge Graph Telemetry Matrix...
        </div>
      }
    >
      <KnowledgeGraphClient incidents={incidents} />
    </Suspense>
  );
}
