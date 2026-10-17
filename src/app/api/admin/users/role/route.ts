import { NextRequest, NextResponse } from "next/server";
import {
  AdminAuthProviderPref,
  AdminUserRole,
  requireAdminRequestActor,
  updateAdminUserRoleBridge,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

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
      id?: number | string;
      role?: AdminUserRole;
      authProviderPref?: AdminAuthProviderPref;
      displayName?: string | null;
      reason?: string;
    };

    const targetEmailOrId = body.id ?? body.email ?? "";
    if (!targetEmailOrId || !body.role) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: (email or id) and role",
        },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    const result = await updateAdminUserRoleBridge({
      actor: auth.actor,
      targetEmailOrId,
      role: body.role,
      authProviderPref: body.authProviderPref,
      displayName: body.displayName,
      reason: body.reason,
      clientIp,
    });

    return NextResponse.json(result, { status: result.status || 200 });
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
