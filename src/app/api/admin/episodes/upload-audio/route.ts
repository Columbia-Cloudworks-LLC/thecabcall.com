import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import { uploadEpisodeAudioBridge } from "@/lib/episodes";
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
    const contentTypeHeader = (
      req.headers.get("content-type") || ""
    ).toLowerCase();

    let filename =
      req.nextUrl.searchParams.get("filename") || "episode-audio.mp3";
    let contentType =
      req.nextUrl.searchParams.get("contentType") || "audio/mpeg";
    let episodeNumber = req.nextUrl.searchParams.get("episodeNumber")
      ? parseInt(req.nextUrl.searchParams.get("episodeNumber")!, 10)
      : undefined;
    let bytes: Uint8Array | null = null;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      const fileEntry = formData.get("file");
      if (
        fileEntry &&
        typeof (fileEntry as Blob).arrayBuffer === "function"
      ) {
        const f = fileEntry as File;
        filename = f.name || filename;
        contentType = f.type || contentType;
        const buf = await f.arrayBuffer();
        bytes = new Uint8Array(buf);
      }
      const epVal = formData.get("episodeNumber");
      if (epVal) {
        const parsed = parseInt(String(epVal), 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          episodeNumber = parsed;
        }
      }
    } else {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 0) {
        bytes = new Uint8Array(buf);
        if (contentTypeHeader.startsWith("audio/")) {
          contentType = contentTypeHeader;
        }
      }
    }

    if (!bytes || bytes.byteLength === 0) {
      return NextResponse.json(
        { ok: false, error: "No audio bytes provided for upload." },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for");

    const result = await uploadEpisodeAudioBridge(
      {
        filename,
        contentType,
        bytes,
        episodeNumber,
      },
      {
        actorEmail: auth.actor.email,
        actorRole: auth.actor.role,
        authMethod: auth.actor.authMethod,
        actorIpHash: await hashActorIp(clientIp),
      }
    );

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
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
