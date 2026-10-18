import React from "react";
import { projectPublicEpisodeDto } from "@/lib/dto";
import { ensureD1Snapshot, getAllEpisodes } from "@/lib/store";
import { PodcastArchiveClient } from "@/components/PodcastArchiveClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The CAB Call Podcast — Conversational Deep-Dives & Archive",
  description:
    "Conversational deep-dives analyzing live Trestleboard ledger dispatches alongside foundational essays on Site Reliability Engineering and the Working Tools of Freemasonry.",
};

export default async function ArchivePage() {
  await ensureD1Snapshot(true);
  const episodes = getAllEpisodes()
    .map((ep) => projectPublicEpisodeDto(ep))
    .filter((ep): ep is NonNullable<typeof ep> => ep !== null);
  return <PodcastArchiveClient initialEpisodes={episodes} />;
}
