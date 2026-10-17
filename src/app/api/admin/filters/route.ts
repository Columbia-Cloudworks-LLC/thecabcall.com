import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  createIngestFilterBridge,
  deleteIngestFilterBridge,
  getIngestFiltersAndThresholdsBridge,
  IngestFilterMatchTarget,
  IngestFilterType,
  updateIngestFilterBridge,
  updateSystemThresholdsBridge,
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
    const data = await getIngestFiltersAndThresholdsBridge();
    return NextResponse.json({
      ok: true,
      ...data,
      activeCount: data.filters.filter((f) => f.enabled).length,
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
      description?: string;
      filterType?: IngestFilterType;
      matchTarget?: IngestFilterMatchTarget;
      pattern?: string;
      scopeFeedId?: number | null;
      actionValue?: string | null;
      enabled?: boolean;
      reason?: string;
    };

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await createIngestFilterBridge(
      {
        name: body.name || "",
        description: body.description,
        filterType: body.filterType || "Drop_Keyword_Regex",
        matchTarget: body.matchTarget || "title_and_excerpt",
        pattern: body.pattern || "",
        scopeFeedId: body.scopeFeedId,
        actionValue: body.actionValue,
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
      action?: "update_thresholds" | "update_filter";
      id?: number;
      name?: string;
      description?: string;
      filterType?: IngestFilterType;
      matchTarget?: IngestFilterMatchTarget;
      pattern?: string;
      scopeFeedId?: number | null;
      actionValue?: string | null;
      enabled?: boolean;
      jevMinSystemicProb?: number;
      jevMinConfidence?: number;
      maxNetNewPerRun?: number;
      defaultItemsPerPoll?: number;
      reason?: string;
    };

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const actor = {
      actorEmail: auth.actor.email,
      actorRole: auth.actor.role,
      authMethod: auth.actor.authMethod,
      actorIpHash: await hashActorIp(clientIp),
    };

    if (
      body.action === "update_thresholds" ||
      body.jevMinSystemicProb !== undefined ||
      body.jevMinConfidence !== undefined ||
      body.maxNetNewPerRun !== undefined ||
      body.defaultItemsPerPoll !== undefined
    ) {
      const result = await updateSystemThresholdsBridge(
        {
          jevMinSystemicProb: body.jevMinSystemicProb,
          jevMinConfidence: body.jevMinConfidence,
          maxNetNewPerRun: body.maxNetNewPerRun,
          defaultItemsPerPoll: body.defaultItemsPerPoll,
          reason: body.reason,
        },
        actor
      );
      return NextResponse.json({ ok: true, ...result }, { status: 200 });
    }

    const id = Number(body.id || req.nextUrl.searchParams.get("id"));
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing required filter id" },
        { status: 400 }
      );
    }

    const result = await updateIngestFilterBridge(
      id,
      {
        name: body.name,
        description: body.description,
        filterType: body.filterType,
        matchTarget: body.matchTarget,
        pattern: body.pattern,
        scopeFeedId: body.scopeFeedId,
        actionValue: body.actionValue,
        enabled: body.enabled,
        reason: body.reason,
      },
      actor
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
        { ok: false, error: "Missing required filter id" },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await deleteIngestFilterBridge(
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
