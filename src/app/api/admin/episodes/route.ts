import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  deleteAdminEpisodeBridge,
  generateAdminEpisodeBridge,
  GenerateEpisodeOverrides,
  getAdminEpisodesAndCandidatesBridge,
  updateAdminEpisodeBridge,
} from "@/lib/episodes";
import { hashActorIp } from "@/pipeline/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminRequestActor(req);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const { episodes, candidateIncidents } =
      await getAdminEpisodesAndCandidatesBridge();
    return NextResponse.json({
      ok: true,
      episodes,
      candidateIncidents,
      totalCount: episodes.length,
    });
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

export async function PUT(req: NextRequest) {
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
    const body = (await req.json()) as {
      id?: number | string;
      slug?: string;
      title?: string;
      summary?: string;
      extendedNotes?: string;
      externalSources?: import("@/lib/types").EpisodeExternalSource[];
      sourcePages?: import("@/lib/types").EpisodeSourcePage[];
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

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await updateAdminEpisodeBridge(
      targetIdOrSlug,
      {
        title: body.title,
        summary: body.summary,
        extendedNotes: body.extendedNotes,
        externalSources: body.externalSources,
        sourcePages: body.sourcePages,
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

export async function DELETE(req: NextRequest) {
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
