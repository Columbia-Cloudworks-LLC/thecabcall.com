import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  deleteAdminEpisodeBridge,
  getAdminEpisodeByIdBridge,
  updateAdminEpisodeBridge,
} from "@/lib/episodes";
import { hashActorIp } from "@/pipeline/audit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminRequestActor(req);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const targetIdOrSlug = decodeURIComponent(id || "").trim();
  if (!targetIdOrSlug) {
    return NextResponse.json(
      { ok: false, error: "Missing episode id" },
      { status: 400 }
    );
  }

  try {
    const episode = await getAdminEpisodeByIdBridge(targetIdOrSlug);
    if (!episode) {
      return NextResponse.json(
        { ok: false, error: `Episode not found: ${targetIdOrSlug}` },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, episode });
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const targetIdOrSlug = decodeURIComponent(id || "").trim();
  if (!targetIdOrSlug) {
    return NextResponse.json(
      { ok: false, error: "Missing episode id" },
      { status: 400 }
    );
  }

  try {
    const body = (await req.json()) as {
      title?: string;
      summary?: string;
      transcript?: string;
      transcriptSections?: {
        weeklyTelemetry?: string;
        separatingSignalFromPanic?: string;
        forwardPosture?: string;
      };
      episodeNumber?: number;
      publishedAt?: string;
      regenerateAudio?: boolean;
      ttsVoice?: string;
      ttsProvider?: "gemini-tts" | "mpeg-framed";
      reason?: string;
    };

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await updateAdminEpisodeBridge(
      targetIdOrSlug,
      {
        title: body.title,
        summary: body.summary,
        transcript: body.transcript,
        transcriptSections: body.transcriptSections,
        episodeNumber: body.episodeNumber,
        publishedAt: body.publishedAt,
        regenerateAudio: body.regenerateAudio,
        ttsVoice: body.ttsVoice,
        ttsProvider: body.ttsProvider,
        reason: body.reason,
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const targetIdOrSlug = decodeURIComponent(id || "").trim();
  if (!targetIdOrSlug) {
    return NextResponse.json(
      { ok: false, error: "Missing episode id" },
      { status: 400 }
    );
  }

  try {
    let body: {
      purgeAudio?: boolean;
      reason?: string;
    } = {};
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      // ignore empty body
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
