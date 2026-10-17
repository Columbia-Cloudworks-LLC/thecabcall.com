import { NextRequest, NextResponse } from "next/server";
import {
  AppendAuditEntryInput,
  getAuditLedgerEntries,
  hashActorIp,
  recordAuditEntry,
} from "@/lib/audit";
import { loadLocalEnvVars } from "@/lib/d1-bridge";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filters = {
      actionType: url.searchParams.get("actionType") || undefined,
      targetType: url.searchParams.get("targetType") || undefined,
      targetId: url.searchParams.get("targetId") || undefined,
      actorEmail: url.searchParams.get("actorEmail") || undefined,
      search: url.searchParams.get("search") || undefined,
      fromDate: url.searchParams.get("fromDate") || undefined,
      toDate: url.searchParams.get("toDate") || undefined,
      limit: url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!, 10)
        : 100,
      offset: url.searchParams.get("offset")
        ? parseInt(url.searchParams.get("offset")!, 10)
        : 0,
    };

    const result = await getAuditLedgerEntries(filters);
    return NextResponse.json({
      ok: true,
      ...result,
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
  const { requireAdminRequestActor } = await import("@/lib/auth");
  const auth = await requireAdminRequestActor(req, [
    "owner",
    "admin",
    "editor",
  ]);

  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const body = (await req.json()) as AppendAuditEntryInput;
    if (!body.actionType || !body.targetType || body.targetId === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: actionType, targetType, targetId",
        },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    const entry = await recordAuditEntry({
      ...body,
      actorEmail: body.actorEmail || auth.actor.email,
      actorRole: body.actorRole || auth.actor.role,
      authMethod: body.authMethod || auth.actor.authMethod,
      actorIpHash: body.actorIpHash ?? (await hashActorIp(clientIp)),
    });

    return NextResponse.json({ ok: true, entry }, { status: 201 });
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
