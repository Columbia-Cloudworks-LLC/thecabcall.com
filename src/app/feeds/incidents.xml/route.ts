import { NextResponse } from "next/server";
import {
  formatCraftLedgerEntry,
  formatFriendlySourceName,
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  projectPublicIncidentDto,
} from "@/lib/dto";
import { deduplicateSignalAgainstFacts } from "@/lib/sanitize";
import { ensureD1Snapshot, getAllIncidents } from "@/lib/store";
import { getSreFailureModeSpec } from "@/lib/taxonomy";

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
  const rawIncidents = getAllIncidents();
  const incidents = rawIncidents
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null)
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  const siteUrl = "https://thecabcall.com";

  const itemsXml = incidents
    .map((inc) => {
      const pubDate = new Date(inc.publishedAt).toUTCString();
      const briefUrl = `${siteUrl}/incidents/${inc.slug}`;
      const failureSpec = getSreFailureModeSpec(inc.sreFailureMode);
      const ledgerLabel = formatCraftLedgerEntry(inc.incidentCode);
      const friendlySource = formatFriendlySourceName(inc.sourceFeed);
      const dedupedSignal = deduplicateSignalAgainstFacts(
        [inc.socraticBrief, inc.executiveSummary],
        inc.proportionalityCheck.structuralSignal,
        inc.primaryTool,
        inc.sreFailureMode,
        inc.secondaryTool
      );

      const htmlBody = [
        `<p><strong>${escapeXml(ledgerLabel)}</strong> &bull; Primary Working Tool: <strong>${escapeXml(inc.primaryTool)}</strong> &bull; Secondary Tool: <strong>${escapeXml(inc.secondaryTool)}</strong> &bull; Failure Mode: <strong>${escapeXml(failureSpec.craftTitle)}</strong></p>`,
        `<h3>I. What Happened (The Plain Facts)</h3>`,
        `<p>${escapeXml(inc.socraticBrief)}</p>`,
        `<h3>II. The Diagnostic Lens: ${escapeXml(inc.primaryTool)} &amp; ${escapeXml(failureSpec.craftTitle)}</h3>`,
        `<p><strong>Partisan Heat &amp; Spin (The Noise):</strong> ${escapeXml(inc.proportionalityCheck.noiseOverblown)}</p>`,
        `<p><strong>The Actual Foundation (The Signal):</strong> ${escapeXml(dedupedSignal)}</p>`,
        `<h3>III. Questions for Fair &amp; Consistent Judgment</h3>`,
        `<ol><li>${escapeXml(inc.questions[0])}</li><li>${escapeXml(inc.questions[1])}</li></ol>`,
        `<p><a href="${escapeXml(inc.sourceUrl)}">Read Original ${escapeXml(friendlySource)} Article</a> &bull; <a href="${escapeXml(briefUrl)}">Read Full Craftsman&apos;s Brief on The Trestleboard</a></p>`,
      ].join("\n");

      return `    <item>
      <title>${escapeXml(inc.title)}</title>
      <link>${escapeXml(briefUrl)}</link>
      <guid isPermaLink="true">${escapeXml(briefUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(inc.primaryTool)}</category>
      <category>${escapeXml(failureSpec.craftTitle)}</category>
      <category>${escapeXml(inc.domainSector)}</category>
      <description>${escapeXml(inc.executiveSummary)}</description>
      <content:encoded><![CDATA[${htmlBody}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Change Advisory Board — The Trestleboard Case Briefs</title>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/feeds/incidents.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} Change Advisory Board (thecabcall.com)</copyright>
    <description>Synthesized Craftsman's Briefs examining current events through Site Reliability Engineering and the Six Working Tools of Freemasonry. Separates Partisan Heat &amp; Spin (The Noise) from The Actual Foundation (The Signal).</description>
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
