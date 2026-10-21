import { NextRequest, NextResponse } from "next/server";
import {
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  projectPublicIncidentDto,
} from "@/lib/dto";
import {
  getOutboundFeedConfigBySlugBridge,
  renderIncidentsRssXml,
} from "@/lib/publishing";
import { ensureD1Snapshot, getAllIncidents } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureD1Snapshot(true);
  const rawIncidents = getAllIncidents();
  const incidents = rawIncidents
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null)
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  const slugParam = req.nextUrl.searchParams.get("feed") || "incidents-rss";
  const toolParam = req.nextUrl.searchParams.get("tool");
  const config = await getOutboundFeedConfigBySlugBridge(slugParam);

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

  const xml = renderIncidentsRssXml(incidents, config, {
    toolFilter: toolParam,
    selfPath: "/feeds/incidents.xml",
  });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
