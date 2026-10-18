import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  getAdminIncidentsAndTransformsBridge,
  mutateAdminIncidentBridge,
} from "@/lib/incidents";
import { hashActorIp } from "@/pipeline/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminRequestActor(req);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized: Admin authentication required" },
      { status: auth.status }
    );
  }

  try {
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const search = req.nextUrl.searchParams.get("search") || undefined;
    const rewrittenOnly =
      req.nextUrl.searchParams.get("rewrittenOnly") === "true" ||
      req.nextUrl.searchParams.get("rewrittenOnly") === "1";
    const limit = req.nextUrl.searchParams.get("limit")
      ? parseInt(req.nextUrl.searchParams.get("limit")!, 10)
      : 100;

    const data = await getAdminIncidentsAndTransformsBridge({
      status,
      search,
      rewrittenOnly,
      limit,
    });

    return NextResponse.json(
      {
        ok: true,
        ...data,
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

async function handleIncidentMutation(req: NextRequest) {
  const auth = await requireAdminRequestActor(req, ["owner", "admin", "editor"]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized: Admin authentication required" },
      { status: auth.status }
    );
  }
  const actor = auth.actor;

  try {
    const body = (await req.json()) as Record<string, any>;
    const clientIp =
      req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");

    const result = await mutateAdminIncidentBridge(body, {
      actorEmail: actor.email,
      actorRole: actor.role,
      authMethod: actor.authMethod,
      actorIpHash: await hashActorIp(clientIp),
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
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
  return handleIncidentMutation(req);
}

export async function POST(req: NextRequest) {
  return handleIncidentMutation(req);
}
