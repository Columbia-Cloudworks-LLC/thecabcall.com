import { NextResponse } from "next/server";
import {
  CANONICAL_PODCAST_AI_COLOPHON,
  sanitizeEpisodeSummaryDefensive,
  stripAiDisclaimers,
} from "@/lib/episode-metadata";
import { ensureD1Snapshot, getAllEpisodes } from "@/lib/store";

export const dynamic = "force-dynamic";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  await ensureD1Snapshot(true);
  const episodes = getAllEpisodes();
  const siteUrl = "https://thecabcall.com";

  const itemsXml = episodes
    .map((ep) => {
      const pubDate = new Date(ep.publishedAt).toUTCString();
      const episodeUrl = `${siteUrl}/podcast#${ep.slug}`;
      const enclosureUrl = ep.audioUrl.startsWith("http")
        ? ep.audioUrl
        : `${siteUrl}${ep.audioUrl.startsWith("/") ? "" : "/"}${ep.audioUrl}`;
      const enclosureMime = enclosureUrl.toLowerCase().endsWith(".m4a")
        ? "audio/x-m4a"
        : "audio/mpeg";
      const artworkHref = ep.artworkUrl
        ? ep.artworkUrl.startsWith("http")
          ? ep.artworkUrl
          : `${siteUrl}${ep.artworkUrl.startsWith("/") ? "" : "/"}${ep.artworkUrl}`
        : null;
      const cleanSummary = sanitizeEpisodeSummaryDefensive(ep.summary);
      const cleanExtended = ep.extendedNotes
        ? stripAiDisclaimers(ep.extendedNotes)
        : cleanSummary;
      const cleanTranscript = stripAiDisclaimers(ep.transcript);
      const artworkXml = artworkHref
        ? `\n      <itunes:image href="${escapeXml(artworkHref)}" />`
        : "";
      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <link>${episodeUrl}</link>
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(cleanSummary)}</description>
      <content:encoded><![CDATA[<p>${cleanExtended}</p><pre>${cleanTranscript}</pre>]]></content:encoded>
      <enclosure url="${escapeXml(enclosureUrl)}" length="${ep.fileSizeBytes}" type="${enclosureMime}" />${artworkXml}
      <itunes:episode>${ep.episodeNumber}</itunes:episode>
      <itunes:duration>${ep.durationSeconds}</itunes:duration>
      <itunes:summary>${escapeXml(cleanSummary)}</itunes:summary>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Change Advisory Board (The CAB Call)</title>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} Change Advisory Board (thecabcall.com)</copyright>
    <itunes:author>Change Advisory Board</itunes:author>
    <description>Conversational deep-dives analyzing live Trestleboard ledger dispatches alongside foundational essays on Site Reliability Engineering and the Working Tools of Freemasonry. ${escapeXml(CANONICAL_PODCAST_AI_COLOPHON)}</description>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>Change Advisory Board</itunes:name>
      <itunes:email>telemetry@thecabcall.com</itunes:email>
    </itunes:owner>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Technology" />
    <itunes:category text="Society &amp; Culture">
      <itunes:category text="Philosophy" />
    </itunes:category>
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
