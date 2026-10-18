import { NextResponse } from "next/server";
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
      const episodeUrl = `${siteUrl}/archive#${ep.slug}`;
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
      const disclaimerSuffix = ep.aiDisclaimer ? `\n\n${ep.aiDisclaimer}` : "";
      const descriptionWithDisclaimer = ep.summary.includes("Google Gemini")
        ? ep.summary
        : `${ep.summary}${disclaimerSuffix}`;
      const artworkXml = artworkHref
        ? `\n      <itunes:image href="${escapeXml(artworkHref)}" />`
        : "";
      const disclaimerHtml = ep.aiDisclaimer
        ? `<p><em>${escapeXml(ep.aiDisclaimer)}</em></p>`
        : "";
      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <link>${episodeUrl}</link>
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(descriptionWithDisclaimer)}</description>
      <content:encoded><![CDATA[<p>${ep.summary}</p>${disclaimerHtml}<pre>${ep.transcript}</pre>]]></content:encoded>
      <enclosure url="${escapeXml(enclosureUrl)}" length="${ep.fileSizeBytes}" type="${enclosureMime}" />${artworkXml}
      <itunes:episode>${ep.episodeNumber}</itunes:episode>
      <itunes:duration>${ep.durationSeconds}</itunes:duration>
      <itunes:summary>${escapeXml(descriptionWithDisclaimer)}</itunes:summary>
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
    <description>Post-Incident Reviews for current events analyzed through the lens of Site Reliability Engineering and the Working Tools of Freemasonry. Includes 5-minute Friday CAB Weekly Brief telemetry rollups and the Legacy Deep-Dive Archive.</description>
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
