import React, { Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { FailureModeHubClient } from "@/components/FailureModeHubClient";
import {
  ensureD1Snapshot,
  getAllPublicIncidentDtos,
  getFailureModeHubData,
} from "@/lib/store";
import { getFailureModeBySlug, SRE_FAILURE_MODES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SRE_FAILURE_MODES.map((mode) => ({
    slug: mode.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spec = getFailureModeBySlug(slug);
  if (!spec) {
    return {
      title: "Failure Mode Not Found | The CAB Call",
    };
  }

  return {
    title: `${spec.craftTitle} (${spec.id}) — Axis II Structural Failure Mode Hub | The CAB Call`,
    description: `${spec.summary} Paired Corrective Working Tool: ${spec.defaultPairedTool}.`,
  };
}

export default async function FailureModeHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await ensureD1Snapshot();
  const { slug } = await params;
  const hubData = getFailureModeHubData(slug);

  if (!hubData) {
    notFound();
  }

  const corpus = getAllPublicIncidentDtos();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0F17] text-[#F4EFE6] flex items-center justify-center font-mono text-xs uppercase tracking-widest">
          Loading {hubData.spec.craftShortLabel} Hub Telemetry…
        </div>
      }
    >
      <FailureModeHubClient
        spec={hubData.spec}
        corpus={corpus}
        initialTelemetry={hubData.telemetry}
        relatedEpisodes={hubData.relatedEpisodes}
      />
    </Suspense>
  );
}
