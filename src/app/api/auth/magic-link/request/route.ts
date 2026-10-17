import { NextRequest, NextResponse } from "next/server";
import {
  requestMagicLinkBridge,
  requireAdminRequestActor,
} from "@/lib/auth";

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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      purpose?: "login" | "invite";
      includeRawLink?: boolean;
    };

    const email = (body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_EMAIL",
          error: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    let allowRawLink = false;
    if (body.includeRawLink) {
      const adminAuth = await requireAdminRequestActor(req, ["owner", "admin"]);
      allowRawLink = adminAuth.authorized;
    }

    const origin = resolvePublicOrigin(req);
    const clientIp =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    const result = await requestMagicLinkBridge({
      email,
      purpose: body.purpose || "login",
      baseUrl: origin,
      includeRawLink: allowRawLink,
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
