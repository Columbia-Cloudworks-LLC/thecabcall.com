import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import { deleteAdminEpisodeBridge } from "@/lib/episodes";
import { hashActorIp } from "@/pipeline/audit";

export const dynamic = "force-dynamic";

async function handleDelete(req: NextRequest) {
  const auth = await requireAdminRequestActor(req, [
    "owner",
    "admin",
    "editor",
  ]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    let body: {
      id?: number | string;
      slug?: string;
      purgeAudio?: boolean;
      reason?: string;
    } = {};
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      // ignore empty body
    }

    const targetIdOrSlug =
      body.id ||
      body.slug ||
      req.nextUrl.searchParams.get("id") ||
      req.nextUrl.searchParams.get("slug");

    if (!targetIdOrSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing required episode id or slug" },
        { status: 400 }
      );
    }

    const purgeParam = req.nextUrl.searchParams.get("purgeAudio");
    const purgeAudio =
      body.purgeAudio !== undefined
        ? Boolean(body.purgeAudio)
        : purgeParam !== null
        ? purgeParam !== "false" && purgeParam !== "0"
        : true;

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await deleteAdminEpisodeBridge(
      targetIdOrSlug,
      {
        purgeAudio,
        reason: body.reason || req.nextUrl.searchParams.get("reason") || "",
      },
      {
        actorEmail: auth.actor.email,
        actorRole: auth.actor.role,
        authMethod: auth.actor.authMethod,
        actorIpHash: await hashActorIp(clientIp),
      }
    );

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
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

export async function POST(req: NextRequest) {
  return handleDelete(req);
}

export async function DELETE(req: NextRequest) {
  return handleDelete(req);
}
