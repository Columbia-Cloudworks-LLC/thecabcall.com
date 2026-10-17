import { NextRequest, NextResponse } from "next/server";
import {
  AdminAuthProviderPref,
  AdminUserRole,
  inviteAdminUserBridge,
  requireAdminRequestActor,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function resolveAdminConsoleOrigin(req: NextRequest): string {
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "admin.thecabcall.com"
  ).toLowerCase();

  if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
    return `http://${host}`;
  }
  return "https://admin.thecabcall.com";
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminRequestActor(req, ["owner", "admin"]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      displayName?: string | null;
      role?: AdminUserRole;
      authProviderPref?: AdminAuthProviderPref;
      reason?: string;
      sendEmail?: boolean;
    };

    const email = (body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const origin = resolveAdminConsoleOrigin(req);
    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    const result = await inviteAdminUserBridge({
      actor: auth.actor,
      email,
      displayName: body.displayName,
      role: body.role || "editor",
      authProviderPref: body.authProviderPref || "any",
      reason: body.reason,
      baseUrl: origin,
      sendEmail: body.sendEmail !== false,
      clientIp,
    });

    return NextResponse.json(result, { status: result.status || 201 });
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
