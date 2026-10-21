import { NextRequest, NextResponse } from "next/server";
import {
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  projectPublicIncidentDto,
} from "@/lib/dto";
import {
  getOutboundFeedConfigBySlugBridge,
  renderIncidentsJsonFeed,
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

  const slugParam = req.nextUrl.searchParams.get("feed") || "incidents-json";
  const toolParam = req.nextUrl.searchParams.get("tool");
  const config = await getOutboundFeedConfigBySlugBridge(slugParam);

  if (config && !config.enabled) {
    return NextResponse.json(
      {
        version: "https://jsonfeed.org/version/1.1",
        title: "Feed Paused",
        description:
          "This syndication feed is temporarily paused by the Change Advisory Board.",
        items: [],
      },
      {
        status: 503,
        headers: {
          "Content-Type": "application/feed+json; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  const feed = renderIncidentsJsonFeed(incidents, config, {
    toolFilter: toolParam,
    selfPath: "/feeds/incidents.json",
  });

  return NextResponse.json(feed, {
    status: 200,
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
