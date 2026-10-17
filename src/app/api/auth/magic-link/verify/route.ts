import { NextRequest, NextResponse } from "next/server";
import { setAdminSessionCookie, verifyMagicLinkBridge } from "@/lib/auth";

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

export async function GET(req: NextRequest) {
  const origin = resolveAdminConsoleOrigin(req);
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const defaultLoginPath = isLocal ? "/admin/login" : "/login";
  const defaultDestPath = isLocal ? "/admin/users" : "/users";

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  const nextPath = url.searchParams.get("next") || defaultDestPath;
  const wantsJson =
    url.searchParams.get("format") === "json" ||
    (req.headers.get("accept") || "").includes("application/json");

  if (!token) {
    if (wantsJson) {
      return NextResponse.json(
        { ok: false, code: "MISSING_TOKEN", error: "Missing Magic Link token." },
        { status: 400 }
      );
    }
    return NextResponse.redirect(
      new URL(
        `${defaultLoginPath}?error=missing_token&message=${encodeURIComponent(
          "Missing Magic Link token."
        )}`,
        origin
      )
    );
  }

  const clientIp =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

  try {
    const result = await verifyMagicLinkBridge({ token, clientIp });

    if (!result.ok || !result.rawSessionToken) {
      if (wantsJson) {
        return NextResponse.json(
          {
            ok: false,
            code: result.code || "INVALID_MAGIC_LINK",
            error: result.error || "Invalid or expired Magic Link.",
          },
          { status: result.status || 401 }
        );
      }

      const loginUrl = new URL(defaultLoginPath, origin);
      loginUrl.searchParams.set("error", result.code || "INVALID_MAGIC_LINK");
      loginUrl.searchParams.set(
        "message",
        result.error || "Invalid or expired single-use Magic Link."
      );
      return NextResponse.redirect(loginUrl);
    }

    if (wantsJson) {
      const res = NextResponse.json(
        {
          ok: true,
          user: result.user,
          expiresAt: result.expiresAt,
        },
        { status: 200 }
      );
      setAdminSessionCookie(res, result.rawSessionToken, result.expiresAt);
      return res;
    }

    const safeNext = nextPath.startsWith("/") ? nextPath : defaultDestPath;
    const redirectResponse = NextResponse.redirect(new URL(safeNext, origin));
    setAdminSessionCookie(
      redirectResponse,
      result.rawSessionToken,
      result.expiresAt
    );
    return redirectResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (wantsJson) {
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
    return NextResponse.redirect(
      new URL(
        `${defaultLoginPath}?error=verify_error&message=${encodeURIComponent(
          message
        )}`,
        origin
      )
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string };
    const token = (body.token || "").trim();
    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    const result = await verifyMagicLinkBridge({ token, clientIp });
    if (!result.ok || !result.rawSessionToken) {
      return NextResponse.json(
        {
          ok: false,
          code: result.code || "INVALID_MAGIC_LINK",
          error: result.error || "Invalid or expired Magic Link.",
        },
        { status: result.status || 401 }
      );
    }

    const res = NextResponse.json(
      {
        ok: true,
        user: result.user,
        expiresAt: result.expiresAt,
      },
      { status: 200 }
    );
    setAdminSessionCookie(res, result.rawSessionToken, result.expiresAt);
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
