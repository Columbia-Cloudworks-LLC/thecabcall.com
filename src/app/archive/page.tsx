import React from "react";
import { getAllEpisodes } from "@/lib/store";
import { PodcastArchiveClient } from "@/components/PodcastArchiveClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The CAB Call Archive — 5-Minute Friday Rollups & Legacy Podcast Hub",
};

export default function ArchivePage() {
  const episodes = getAllEpisodes();
  return <PodcastArchiveClient initialEpisodes={episodes} />;
}
