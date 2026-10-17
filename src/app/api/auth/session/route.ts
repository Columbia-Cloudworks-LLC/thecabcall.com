import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentAdminSession,
  getSessionTokenFromNextRequest,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = getSessionTokenFromNextRequest(req);
  const actor = await getCurrentAdminSession(token);
  return NextResponse.json(
    {
      ok: true,
      authenticated: Boolean(actor),
      actor,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
