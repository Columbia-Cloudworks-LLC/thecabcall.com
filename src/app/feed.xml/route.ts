import { NextResponse } from "next/server";
import {
  getOutboundFeedConfigBySlugBridge,
  renderPodcastRssXml,
} from "@/lib/publishing";
import { ensureD1Snapshot, getAllEpisodes } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureD1Snapshot(true);
  const episodes = getAllEpisodes();
  const config = await getOutboundFeedConfigBySlugBridge("podcast-rss");

  if (config && !config.enabled) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Feed Paused</title><description>This syndication feed is temporarily paused by the Change Advisory Board.</description></channel></rss>`,
      {
        status: 503,
        headers: {
          "Content-Type": "application/rss+xml; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  const xml = renderPodcastRssXml(episodes, config);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
