import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  listPipelineTransformsBridge,
  updatePipelineTransformBridge,
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
    const transforms = await listPipelineTransformsBridge();
    return NextResponse.json(
      {
        ok: true,
        transforms,
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

async function handleTransformUpdate(req: NextRequest) {
  const auth = await requireAdminRequestActor(req, ["owner", "admin", "editor"]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized: Admin authentication required" },
      { status: auth.status }
    );
  }
  const actor = auth.actor;

  try {
    const body = (await req.json()) as {
      transformKey?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      reason?: string;
    };
    if (!body.transformKey) {
      return NextResponse.json(
        { ok: false, error: "Missing required transformKey" },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");

    const result = await updatePipelineTransformBridge(
      {
        transformKey: body.transformKey,
        enabled: body.enabled,
        config: body.config,
        reason: body.reason,
      },
      {
        actorEmail: actor.email,
        actorRole: actor.role,
        authMethod: actor.authMethod,
        actorIpHash: await hashActorIp(clientIp),
      }
    );

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
  return handleTransformUpdate(req);
}

export async function POST(req: NextRequest) {
  return handleTransformUpdate(req);
}
