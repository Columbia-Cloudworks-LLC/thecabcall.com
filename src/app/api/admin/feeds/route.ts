import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  createIngestFeedBridge,
  deleteIngestFeedBridge,
  getIngestFeedsBridge,
  updateIngestFeedBridge,
} from "@/lib/feeds-filters";
import { hashActorIp } from "@/pipeline/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminRequestActor(req);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const feeds = await getIngestFeedsBridge();
    return NextResponse.json({
      ok: true,
      feeds,
      activeCount: feeds.filter((f) => f.enabled).length,
    });
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

export async function POST(req: NextRequest) {
  const auth = await requireAdminRequestActor(req, ["owner", "admin", "editor"]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      url?: string;
      focusArea?: string;
      domainSectorOverride?: string | null;
      itemsPerPoll?: number;
      enabled?: boolean;
      reason?: string;
    };

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await createIngestFeedBridge(
      {
        name: body.name || "",
        url: body.url || "",
        focusArea: body.focusArea || "General US Telemetry",
        domainSectorOverride: body.domainSectorOverride,
        itemsPerPoll: body.itemsPerPoll,
        enabled: body.enabled,
        reason: body.reason,
      },
      {
        actorEmail: auth.actor.email,
        actorRole: auth.actor.role,
        authMethod: auth.actor.authMethod,
        actorIpHash: await hashActorIp(clientIp),
      }
    );

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
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
  const auth = await requireAdminRequestActor(req, ["owner", "admin", "editor"]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const body = (await req.json()) as {
      id?: number;
      name?: string;
      url?: string;
      focusArea?: string;
      domainSectorOverride?: string | null;
      itemsPerPoll?: number;
      enabled?: boolean;
      reason?: string;
    };

    const id = Number(body.id || req.nextUrl.searchParams.get("id"));
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing required feed id" },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await updateIngestFeedBridge(
      id,
      {
        name: body.name,
        url: body.url,
        focusArea: body.focusArea,
        domainSectorOverride: body.domainSectorOverride,
        itemsPerPoll: body.itemsPerPoll,
        enabled: body.enabled,
        reason: body.reason,
      },
      {
        actorEmail: auth.actor.email,
        actorRole: auth.actor.role,
        authMethod: auth.actor.authMethod,
        actorIpHash: await hashActorIp(clientIp),
      }
    );

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
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

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminRequestActor(req, ["owner", "admin", "editor"]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    let body: { id?: number; reason?: string } = {};
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      // ignore
    }

    const id = Number(body.id || req.nextUrl.searchParams.get("id"));
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing required feed id" },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await deleteIngestFeedBridge(
      id,
      body.reason || req.nextUrl.searchParams.get("reason") || "",
      {
        actorEmail: auth.actor.email,
        actorRole: auth.actor.role,
        authMethod: auth.actor.authMethod,
        actorIpHash: await hashActorIp(clientIp),
      }
    );

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
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
