import React from "react";
import { redirect } from "next/navigation";
import { AdminPublishingClient } from "@/components/AdminPublishingClient";
import { getCurrentAdminSession } from "@/lib/auth";
import {
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  projectPublicIncidentDto,
} from "@/lib/dto";
import {
  listOutboundFeedsBridge,
  renderIncidentsJsonFeed,
  renderIncidentsRssXml,
  renderPodcastRssXml,
} from "@/lib/publishing";
import { ensureD1Snapshot, getAllEpisodes, getAllIncidents } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Syndication & Outbound Feeds — The Editor's Study | The CAB Call",
  description:
    "Configure public Podcast RSS, De-Alarmed Incident RSS 2.0, and JSON Feed 1.1 syndication channels (Inspect Feed ↗) for The CAB Call.",
};

export default async function AdminPublishingPage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin/publishing");
  }

  await ensureD1Snapshot(false);
  const feeds = await listOutboundFeedsBridge();
  const episodes = getAllEpisodes();
  const rawIncidents = getAllIncidents();
  const incidents = rawIncidents
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null)
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  const firstFeed = feeds[0];
  let initialPreviewContent = "";
  let initialPreviewFormat: "xml" | "json" = "xml";

  if (firstFeed?.slug === "incidents-json") {
    initialPreviewFormat = "json";
    initialPreviewContent = JSON.stringify(
      renderIncidentsJsonFeed(incidents, firstFeed),
      null,
      2
    );
  } else if (firstFeed?.slug === "incidents-rss") {
    initialPreviewFormat = "xml";
    initialPreviewContent = renderIncidentsRssXml(incidents, firstFeed);
  } else {
    initialPreviewFormat = "xml";
    initialPreviewContent = renderPodcastRssXml(episodes, firstFeed);
  }

  return (
    <AdminPublishingClient
      actor={actor}
      initialFeeds={feeds}
      initialPreview={{
        slug: firstFeed?.slug || "podcast-rss",
        format: initialPreviewFormat,
        content: initialPreviewContent,
      }}
      episodeCount={episodes.length}
      incidentCount={incidents.length}
    />
  );
}
