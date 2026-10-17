import { NextRequest, NextResponse } from "next/server";
import {
  AuditAuthMethod,
  executeAuditReplay,
  hashActorIp,
} from "@/lib/audit";
import { loadLocalEnvVars } from "@/lib/d1-bridge";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { requireAdminRequestActor } = await import("@/lib/auth");
  const auth = await requireAdminRequestActor(req, ["owner", "admin"]);

  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const body = (await req.json()) as {
      eventId?: string;
      mode?: "revert_to_before" | "reapply_after";
      actorEmail?: string;
      actorRole?: string;
      authMethod?: AuditAuthMethod;
      reason?: string;
    };

    if (!body.eventId) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: eventId" },
        { status: 400 }
      );
    }

    const mode =
      body.mode === "reapply_after" ? "reapply_after" : "revert_to_before";
    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    const result = await executeAuditReplay(body.eventId, mode, {
      actorEmail: body.actorEmail || auth.actor.email,
      actorRole: body.actorRole || auth.actor.role,
      authMethod: body.authMethod || auth.actor.authMethod,
      actorIpHash: await hashActorIp(clientIp),
      reason: body.reason,
    });

    return NextResponse.json(result);
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
