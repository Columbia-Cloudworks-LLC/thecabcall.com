import { NextRequest, NextResponse } from "next/server";
import {
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  projectPublicIncidentDto,
} from "@/lib/dto";
import {
  getOutboundFeedConfigBySlugBridge,
  renderIncidentsJsonFeed,
  renderIncidentsRssXml,
} from "@/lib/publishing";
import { ensureD1Snapshot, getAllIncidents } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await context.params;
  const isJson = rawSlug.toLowerCase().endsWith(".json");
  const baseSlug = rawSlug.replace(/\.(xml|json)$/i, "").trim();

  await ensureD1Snapshot(true);
  const config =
    (await getOutboundFeedConfigBySlugBridge(baseSlug)) ||
    (await getOutboundFeedConfigBySlugBridge(rawSlug));

  if (!config) {
    return NextResponse.json(
      { ok: false, error: `Syndication feed not found: ${rawSlug}` },
      { status: 404 }
    );
  }

  if (!config.enabled) {
    return new NextResponse("Feed temporarily paused.", { status: 503 });
  }

  const rawIncidents = getAllIncidents();
  const incidents = rawIncidents
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null)
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  const toolParam = req.nextUrl.searchParams.get("tool");

  if (isJson || config.slug.endsWith("-json")) {
    const feed = renderIncidentsJsonFeed(incidents, config, {
      toolFilter: toolParam,
      selfPath: `/feeds/${rawSlug}`,
    });
    return NextResponse.json(feed, {
      status: 200,
      headers: {
        "Content-Type": "application/feed+json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const xml = renderIncidentsRssXml(incidents, config, {
    toolFilter: toolParam,
    selfPath: `/feeds/${rawSlug}`,
  });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
