import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  generateAdminEpisodeBridge,
  GenerateEpisodeOverrides,
} from "@/lib/episodes";
import { hashActorIp } from "@/pipeline/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
      episodeNumber?: number;
      titleOverride?: string;
      summaryOverride?: string;
      editorialFocusNote?: string;
      windowDays?: number;
      incidentIds?: number[];
      ttsVoice?: string;
      ttsProvider?: "gemini-tts" | "mpeg-framed";
      reason?: string;
    } = {};
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      // default overrides
    }

    const overrides: GenerateEpisodeOverrides = {
      episodeNumber: body.episodeNumber,
      titleOverride: body.titleOverride,
      summaryOverride: body.summaryOverride,
      editorialFocusNote: body.editorialFocusNote,
      windowDays: body.windowDays,
      incidentIds: Array.isArray(body.incidentIds)
        ? body.incidentIds
        : undefined,
      ttsVoice: body.ttsVoice,
      ttsProvider: body.ttsProvider,
    };

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await generateAdminEpisodeBridge(
      overrides,
      body.reason,
      {
        actorEmail: auth.actor.email,
        actorRole: auth.actor.role,
        authMethod: auth.actor.authMethod,
        actorIpHash: await hashActorIp(clientIp),
      }
    );

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
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
