import React from "react";
import { notFound } from "next/navigation";
import { getAllIncidents, getIncidentBySlug } from "@/lib/store";
import { IncidentBriefClient } from "@/components/IncidentBriefClient";

export const dynamic = "force-dynamic";

export default async function IncidentBriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const incident = getIncidentBySlug(slug);

  if (!incident) {
    notFound();
  }

  const relatedIncidents = getAllIncidents()
    .filter((i) => i.id !== incident.id)
    .slice(0, 2);

  return (
    <IncidentBriefClient
      incident={incident}
      relatedIncidents={relatedIncidents}
    />
  );
}
