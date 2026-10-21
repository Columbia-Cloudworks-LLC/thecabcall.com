import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  projectPublicIncidentDto,
} from "@/lib/dto";
import {
  createOutboundFeedBridge,
  deleteOutboundFeedBridge,
  listOutboundFeedsBridge,
  OutboundFeedConfig,
  renderIncidentsJsonFeed,
  renderIncidentsRssXml,
  renderPodcastRssXml,
  updateOutboundFeedBridge,
} from "@/lib/publishing";
import { ensureD1Snapshot, getAllEpisodes, getAllIncidents } from "@/lib/store";
import { hashActorIp } from "@/pipeline/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminRequestActor(req);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error || "Unauthorized: Admin authentication required",
      },
      { status: auth.status }
    );
  }

  try {
    const feeds = await listOutboundFeedsBridge();
    const previewSlug = req.nextUrl.searchParams.get("previewSlug");
    if (previewSlug) {
      await ensureD1Snapshot(true);
      const targetConfig =
        feeds.find((f) => f.slug === previewSlug) || feeds[0];
      const preview = buildFeedPreviewPayload(targetConfig);
      return NextResponse.json(
        {
          ok: true,
          feeds,
          preview,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        feeds,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

function buildFeedPreviewPayload(config: OutboundFeedConfig): {
  slug: string;
  format: "xml" | "json";
  content: string;
} {
  if (config.slug === "podcast-rss") {
    const episodes = getAllEpisodes();
    return {
      slug: config.slug,
      format: "xml",
      content: renderPodcastRssXml(episodes, config),
    };
  }

  const rawIncidents = getAllIncidents();
  const incidents = rawIncidents
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null)
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  if (config.slug === "incidents-json" || config.slug.endsWith("-json")) {
    const jsonObj = renderIncidentsJsonFeed(incidents, config, {
      selfPath:
        config.slug === "incidents-json"
          ? "/feeds/incidents.json"
          : `/feeds/${config.slug}.json`,
    });
    return {
      slug: config.slug,
      format: "json",
      content: JSON.stringify(jsonObj, null, 2),
    };
  }

  return {
    slug: config.slug,
    format: "xml",
    content: renderIncidentsRssXml(incidents, config, {
      selfPath:
        config.slug === "incidents-rss"
          ? "/feeds/incidents.xml"
          : `/feeds/${config.slug}.xml`,
    }),
  };
}

async function handleMutation(req: NextRequest) {
  const auth = await requireAdminRequestActor(req, [
    "owner",
    "admin",
    "editor",
  ]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error || "Unauthorized: Admin authentication required",
      },
      { status: auth.status }
    );
  }
  const actor = auth.actor;

  try {
    const body = (await req.json()) as {
      action?: "create" | "update" | "delete" | "preview";
      idOrSlug?: number | string;
      slug?: string;
      title?: string;
      subtitle?: string;
      description?: string;
      authorName?: string;
      ownerEmail?: string;
      coverImageUrl?: string | null;
      language?: string;
      category?: string;
      maxItems?: number;
      useDeescalatedTitles?: boolean;
      includeOriginalTitleNote?: boolean;
      includeAttachedImages?: boolean;
      includeFullSocraticBrief?: boolean;
      includeAuditLedgerFooter?: boolean;
      filterWorkingTool?: string | null;
      enabled?: boolean;
      reason?: string;
      draftConfig?: OutboundFeedConfig;
    };

    if (body.action === "preview" && body.draftConfig) {
      await ensureD1Snapshot(false);
      const preview = buildFeedPreviewPayload(body.draftConfig);
      return NextResponse.json(
        {
          ok: true,
          preview,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const clientIp =
      req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");
    const actorPayload = {
      actorEmail: actor.email,
      actorRole: actor.role,
      authMethod: actor.authMethod,
      actorIpHash: await hashActorIp(clientIp),
    };

    if (req.method === "DELETE" || body.action === "delete") {
      const target = body.idOrSlug ?? body.slug;
      if (!target) {
        return NextResponse.json(
          { ok: false, error: "Missing required feed slug or id." },
          { status: 400 }
        );
      }
      const result = await deleteOutboundFeedBridge(
        target,
        body.reason,
        actorPayload
      );
      return NextResponse.json(
        {
          ok: true,
          ...result,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (body.action === "create") {
      if (!body.slug || !body.title) {
        return NextResponse.json(
          { ok: false, error: "Both slug and title are required." },
          { status: 400 }
        );
      }
      const result = await createOutboundFeedBridge(
        {
          slug: body.slug,
          title: body.title,
          subtitle: body.subtitle,
          description:
            body.description ||
            "Synthesized Craftsman's Briefs published from The Trestleboard.",
          authorName: body.authorName,
          ownerEmail: body.ownerEmail,
          coverImageUrl: body.coverImageUrl,
          language: body.language,
          category: body.category,
          maxItems: body.maxItems,
          useDeescalatedTitles: body.useDeescalatedTitles,
          includeOriginalTitleNote: body.includeOriginalTitleNote,
          includeAttachedImages: body.includeAttachedImages,
          includeFullSocraticBrief: body.includeFullSocraticBrief,
          includeAuditLedgerFooter: body.includeAuditLedgerFooter,
          filterWorkingTool: body.filterWorkingTool,
          enabled: body.enabled,
          reason: body.reason,
        },
        actorPayload
      );
      await ensureD1Snapshot(false);
      return NextResponse.json(
        {
          ok: true,
          ...result,
          preview: buildFeedPreviewPayload(result.feed),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const target = body.idOrSlug ?? body.slug;
    if (!target) {
      return NextResponse.json(
        { ok: false, error: "Missing required feed slug or id." },
        { status: 400 }
      );
    }

    const result = await updateOutboundFeedBridge(
      {
        idOrSlug: target,
        title: body.title,
        subtitle: body.subtitle,
        description: body.description,
        authorName: body.authorName,
        ownerEmail: body.ownerEmail,
        coverImageUrl: body.coverImageUrl,
        language: body.language,
        category: body.category,
        maxItems: body.maxItems,
        useDeescalatedTitles: body.useDeescalatedTitles,
        includeOriginalTitleNote: body.includeOriginalTitleNote,
        includeAttachedImages: body.includeAttachedImages,
        includeFullSocraticBrief: body.includeFullSocraticBrief,
        includeAuditLedgerFooter: body.includeAuditLedgerFooter,
        filterWorkingTool: body.filterWorkingTool,
        enabled: body.enabled,
        reason: body.reason,
      },
      actorPayload
    );

    await ensureD1Snapshot(false);
    return NextResponse.json(
      {
        ok: true,
        ...result,
        preview: buildFeedPreviewPayload(result.feed),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return handleMutation(req);
}

export async function POST(req: NextRequest) {
  return handleMutation(req);
}

export async function DELETE(req: NextRequest) {
  return handleMutation(req);
}
