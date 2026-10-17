import { NextRequest, NextResponse } from "next/server";
import { generateSecureTokenHex, OAUTH_STATE_COOKIE_NAME } from "@/lib/auth";
import { loadLocalEnvVars } from "@/lib/d1-bridge";

export const dynamic = "force-dynamic";

function resolveOAuthCallbackOrigin(req: NextRequest): string {
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "thecabcall.com"
  ).toLowerCase();

  if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
    return `http://${host}`;
  }
  // Use https://thecabcall.com/api/auth/google/callback as the canonical Google OAuth redirect URI
  // while sharing state & session cookies across .thecabcall.com (including admin.thecabcall.com).
  return "https://thecabcall.com";
}

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

export async function GET(req: NextRequest) {
  const envVars = loadLocalEnvVars();
  const clientId = envVars.GOOGLE_CLIENT_ID;

  const callbackOrigin = resolveOAuthCallbackOrigin(req);
  const adminOrigin = resolveAdminConsoleOrigin(req);
  const isProd = process.env.NODE_ENV === "production";

  const url = new URL(req.url);
  const nextPath = url.searchParams.get("next") || "/users";

  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        `/login?error=missing_oauth_config&message=${encodeURIComponent(
          "GOOGLE_CLIENT_ID is not configured."
        )}`,
        adminOrigin
      )
    );
  }

  const nonce = generateSecureTokenHex(16);
  const statePayload = `${nonce}:${Buffer.from(nextPath, "utf8").toString(
    "base64url"
  )}`;
  const redirectUri = `${callbackOrigin}/api/auth/google/callback`;

  const googleAuthUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth"
  );
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("access_type", "online");
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("state", statePayload);

  const response = NextResponse.redirect(googleAuthUrl.toString());
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: nonce,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    ...(isProd ? { domain: ".thecabcall.com" } : {}),
    maxAge: 600,
  });

  return response;
}
