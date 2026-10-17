import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  getSessionTokenFromNextRequest,
  logoutSessionBridge,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = getSessionTokenFromNextRequest(req);
  if (token) {
    await logoutSessionBridge(token);
  }
  const res = NextResponse.json({ ok: true, signedOut: true }, { status: 200 });
  clearAdminSessionCookie(res);
  return res;
}

export async function GET(req: NextRequest) {
  const token = getSessionTokenFromNextRequest(req);
  if (token) {
    await logoutSessionBridge(token);
  }
  const url = new URL("/admin/login", req.url);
  const res = NextResponse.redirect(url);
  clearAdminSessionCookie(res);
  return res;
}
