import React from "react";
import { notFound } from "next/navigation";
import { projectPublicIncidentDto } from "@/lib/dto";
import {
  ensureD1Snapshot,
  getAllIncidents,
  getIncidentBySlug,
} from "@/lib/store";
import { IncidentBriefClient } from "@/components/IncidentBriefClient";

export const dynamic = "force-dynamic";

export default async function IncidentBriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await ensureD1Snapshot();
  const { slug } = await params;
  const rawIncident = getIncidentBySlug(slug);
  const incident = rawIncident ? projectPublicIncidentDto(rawIncident) : null;

  if (!incident) {
    notFound();
  }

  const relatedIncidents = getAllIncidents()
    .filter((i) => i.id !== incident.id)
    .map((i) => projectPublicIncidentDto(i))
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .slice(0, 2);

  return (
    <IncidentBriefClient
      incident={incident}
      relatedIncidents={relatedIncidents}
    />
  );
}
