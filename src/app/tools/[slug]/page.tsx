import React, { Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkingToolHubClient } from "@/components/WorkingToolHubClient";
import {
  ensureD1Snapshot,
  getAllPublicIncidentDtos,
  getWorkingToolHubData,
} from "@/lib/store";
import { getWorkingToolBySlug, WORKING_TOOLS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return WORKING_TOOLS.map((tool) => ({
    slug: tool.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spec = getWorkingToolBySlug(slug);
  if (!spec) {
    return {
      title: "Working Tool Not Found | The CAB Call",
    };
  }

  return {
    title: `${spec.id} (${spec.sreEquivalent}) — Axis I Working Tool Hub | The CAB Call`,
    description: `${spec.moralDefinition} Core Socratic Question: "${spec.diagnosticQuestionPattern}"`,
  };
}

export default async function WorkingToolHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await ensureD1Snapshot();
  const { slug } = await params;
  const hubData = getWorkingToolHubData(slug);

  if (!hubData) {
    notFound();
  }

  const corpus = getAllPublicIncidentDtos();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0F17] text-[#F4EFE6] flex items-center justify-center font-mono text-xs uppercase tracking-widest">
          Loading {hubData.spec.id} Hub Telemetry…
        </div>
      }
    >
      <WorkingToolHubClient
        spec={hubData.spec}
        corpus={corpus}
        initialTelemetry={hubData.telemetry}
        relatedEpisodes={hubData.relatedEpisodes}
      />
    </Suspense>
  );
}
