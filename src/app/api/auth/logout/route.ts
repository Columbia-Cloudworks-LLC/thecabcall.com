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
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "admin.thecabcall.com"
  ).toLowerCase();
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  const targetUrl = isLocal
    ? new URL("/admin/login", req.url)
    : new URL("https://admin.thecabcall.com/login");

  const res = NextResponse.redirect(targetUrl);
  clearAdminSessionCookie(res);
  return res;
}
