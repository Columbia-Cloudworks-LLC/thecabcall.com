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

export async function GET() {
  await ensureD1Snapshot(true);
  const rawIncidents = getAllIncidents();
  const incidents = rawIncidents
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null)
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  const siteUrl = "https://thecabcall.com";

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "Change Advisory Board — The Trestleboard Case Ledger",
    home_page_url: siteUrl,
    feed_url: `${siteUrl}/feeds/incidents.json`,
    description:
      "Craftsman's Briefs examining current events through Site Reliability Engineering failure analysis and the Six Working Tools of Freemasonry.",
    language: "en-US",
    authors: [
      {
        name: "Change Advisory Board",
        url: `${siteUrl}/status`,
      },
    ],
    items: incidents.map((inc) => {
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

      const contentText = [
        `${ledgerLabel} — ${inc.title}`,
        `Primary Working Tool: ${inc.primaryTool} | Secondary Working Tool: ${inc.secondaryTool} | Failure Mode: ${failureSpec.craftTitle}`,
        "",
        "I. WHAT HAPPENED (THE PLAIN FACTS)",
        inc.socraticBrief,
        "",
        `II. THE DIAGNOSTIC LENS (${inc.primaryTool} & ${failureSpec.craftTitle})`,
        `Partisan Heat & Spin (The Noise): ${inc.proportionalityCheck.noiseOverblown}`,
        `The Actual Foundation (The Signal): ${dedupedSignal}`,
        "",
        "III. QUESTIONS FOR FAIR & CONSISTENT JUDGMENT",
        `1. ${inc.questions[0]}`,
        `2. ${inc.questions[1]}`,
        "",
        `Original ${friendlySource} Article: ${inc.sourceUrl}`,
      ].join("\n");

      return {
        id: briefUrl,
        url: briefUrl,
        external_url: inc.sourceUrl,
        title: inc.title,
        summary: inc.executiveSummary,
        content_text: contentText,
        date_published: inc.publishedAt,
        tags: [inc.primaryTool, inc.secondaryTool, failureSpec.craftTitle, inc.domainSector],
      };
    }),
  };

  return NextResponse.json(feed, {
    status: 200,
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
