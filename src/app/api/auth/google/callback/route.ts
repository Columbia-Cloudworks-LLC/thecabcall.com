import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleCodeAndAuthenticate,
  OAUTH_STATE_COOKIE_NAME,
  setAdminSessionCookie,
  verifyGoogleLoginAgainstD1,
} from "@/lib/auth";
import { loadLocalEnvVars } from "@/lib/d1-bridge";

export const dynamic = "force-dynamic";

function resolvePublicOrigin(req: NextRequest): string {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "thecabcall.com";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  if (host.includes("thecabcall.com") && !host.includes("localhost")) {
    return "https://thecabcall.com";
  }
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const origin = resolvePublicOrigin(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state") || "";
  const errorParam = url.searchParams.get("error");
  const wantsJson =
    url.searchParams.get("format") === "json" ||
    (req.headers.get("accept") || "").includes("application/json");

  if (errorParam) {
    if (wantsJson) {
      return NextResponse.json(
        {
          ok: false,
          code: "OAUTH_ACCESS_DENIED",
          error: `Google OAuth error: ${errorParam}`,
        },
        { status: 403 }
      );
    }
    return NextResponse.redirect(
      new URL(
        `/admin/login?error=oauth_cancelled&message=${encodeURIComponent(
          `Google Sign-In was cancelled or denied (${errorParam}).`
        )}`,
        origin
      )
    );
  }

  if (!code) {
    if (wantsJson) {
      return NextResponse.json(
        {
          ok: false,
          code: "MISSING_OAUTH_CODE",
          error: "Missing Google OAuth authorization code.",
        },
        { status: 400 }
      );
    }
    return NextResponse.redirect(
      new URL(
        `/admin/login?error=missing_code&message=${encodeURIComponent(
          "Missing authorization code from Google."
        )}`,
        origin
      )
    );
  }

  // Extract optional next path from state payload (`nonce:base64url(nextPath)`)
  let nextPath = "/admin/users";
  const [stateNonce, encodedNext] = stateParam.split(":");
  const cookieNonce = req.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (cookieNonce && stateNonce && cookieNonce !== stateNonce) {
    if (wantsJson) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_OAUTH_STATE",
          error: "OAuth state mismatch. Please try signing in again.",
        },
        { status: 400 }
      );
    }
    return NextResponse.redirect(
      new URL(
        `/admin/login?error=invalid_state&message=${encodeURIComponent(
          "OAuth state verification failed. Please try signing in again."
        )}`,
        origin
      )
    );
  }

  if (encodedNext) {
    try {
      const decoded = Buffer.from(encodedNext, "base64url").toString("utf8");
      if (decoded.startsWith("/admin")) {
        nextPath = decoded;
      }
    } catch {
      // keep default /admin/users
    }
  }

  const clientIp =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    const authResult = await exchangeGoogleCodeAndAuthenticate({
      code,
      redirectUri,
      clientIp,
    });

    if (!authResult.ok || !authResult.rawSessionToken) {
      if (wantsJson) {
        return NextResponse.json(
          {
            ok: false,
            code: authResult.code || "UNAUTHORIZED_ACCOUNT",
            error:
              authResult.error ||
              "403 Unauthorized Account: Only the Owner and invited emails may sign in.",
            email: authResult.email,
          },
          { status: authResult.status || 403 }
        );
      }

      const loginUrl = new URL("/admin/login", origin);
      loginUrl.searchParams.set(
        "error",
        authResult.code || "UNAUTHORIZED_ACCOUNT"
      );
      loginUrl.searchParams.set(
        "message",
        authResult.error ||
          "403 Unauthorized Account: Access is restricted to the Owner and explicitly invited emails."
      );
      if (authResult.email) {
        loginUrl.searchParams.set("email", authResult.email);
      }
      return NextResponse.redirect(loginUrl);
    }

    if (wantsJson) {
      const res = NextResponse.json(
        {
          ok: true,
          user: authResult.user,
          expiresAt: authResult.expiresAt,
        },
        { status: 200 }
      );
      setAdminSessionCookie(
        res,
        authResult.rawSessionToken,
        authResult.expiresAt
      );
      return res;
    }

    const redirectResponse = NextResponse.redirect(new URL(nextPath, origin));
    setAdminSessionCookie(
      redirectResponse,
      authResult.rawSessionToken,
      authResult.expiresAt
    );
    redirectResponse.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return redirectResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (wantsJson) {
      return NextResponse.json(
        { ok: false, error: message },
        { status: 500 }
      );
    }
    return NextResponse.redirect(
      new URL(
        `/admin/login?error=callback_error&message=${encodeURIComponent(
          message
        )}`,
        origin
      )
    );
  }
}

/**
 * POST /api/auth/google/callback (Admin/Test verification endpoint requiring x-admin-secret)
 * Allows deterministic verification of Google OAuth account lock & 403 audit logging.
 */
export async function POST(req: NextRequest) {
  const envVars = loadLocalEnvVars();
  const providedSecret = req.headers.get("x-admin-secret");

  if (!providedSecret || providedSecret !== envVars.ADMIN_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized: Invalid or missing x-admin-secret header",
      },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      emailVerified?: boolean;
      displayName?: string | null;
      avatarUrl?: string | null;
    };

    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    const result = await verifyGoogleLoginAgainstD1({
      email: body.email || "",
      emailVerified: body.emailVerified !== false,
      displayName: body.displayName,
      avatarUrl: body.avatarUrl,
      clientIp,
    });

    const res = NextResponse.json(result, { status: result.status || 200 });
    if (result.ok && result.rawSessionToken) {
      setAdminSessionCookie(res, result.rawSessionToken, result.expiresAt);
    }
    return res;
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
