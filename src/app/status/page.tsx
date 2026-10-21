import React from "react";
import { SystemStatusClient } from "@/components/SystemStatusClient";
import {
  formatFriendlySourceName,
  isRenderablePublicEpisode,
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  projectPublicEpisodeDto,
  projectPublicIncidentDto,
} from "@/lib/dto";
import { getIngestFeedsBridge } from "@/lib/feeds-filters";
import { ensureD1Snapshot, getAllEpisodes, getAllIncidents } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "About & Feeds — The Philosophy, Charter & Syndication Ledger of The CAB Call",
};

export default async function SystemStatusPage() {
  await ensureD1Snapshot();

  const [rawFeeds] = await Promise.all([
    getIngestFeedsBridge().catch(() => []),
  ]);

  const activeSourceFeeds = rawFeeds
    .filter((f) => f.enabled)
    .map((f) => ({
      name: formatFriendlySourceName(f.name) === "Source" ? f.name : f.name,
      category: f.focusArea || "Public Infrastructure & Institutional Governance",
    }));

  const validIncidents = getAllIncidents()
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null)
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  const validEpisodes = getAllEpisodes()
    .map((ep) => projectPublicEpisodeDto(ep))
    .filter((ep): ep is NonNullable<typeof ep> => ep !== null)
    .map((ep) => mapDtoToCraftLexicon(ep))
    .filter((ep) => isRenderablePublicEpisode(ep));

  return (
    <SystemStatusClient
      sourcedFeeds={activeSourceFeeds.length > 0 ? activeSourceFeeds : undefined}
      publishedBriefCount={validIncidents.length}
      publishedEpisodeCount={validEpisodes.length}
      latestEpisodeTitle={validEpisodes[0]?.title}
      latestEpisodeNumber={validEpisodes[0]?.episodeNumber}
    />
  );
}
