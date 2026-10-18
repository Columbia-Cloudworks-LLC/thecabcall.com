import { NextRequest, NextResponse } from "next/server";
import {
  createLocalR2AudioAdapter,
  ensureD1Snapshot,
  fetchRemoteWorkerAudioBytes,
  getEffectiveWorkerUrl,
  shouldUseRemoteWorker,
} from "@/lib/d1-bridge";
import { buildValidMp3AudioBytes } from "@/pipeline/rollup";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const cleanName = decodeURIComponent(filename || "").trim();
  if (!cleanName || cleanName.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const isM4a = cleanName.toLowerCase().endsWith(".m4a");
  const contentType = isM4a ? "audio/mp4" : "audio/mpeg";

  // Large legacy .m4a episodes (24 MB - 88 MB) exceed Vercel's 4.5 MB serverless response limit;
  // redirect directly to the Cloudflare Worker R2 range-streaming endpoint when remote worker is active.
  if (isM4a && shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    return NextResponse.redirect(
      `${workerUrl}/audio/${encodeURIComponent(cleanName)}`,
      307
    );
  }

  let audioBytes: Uint8Array | null = null;

  if (shouldUseRemoteWorker() && !isM4a) {
    audioBytes = await fetchRemoteWorkerAudioBytes(cleanName);
  }

  if (!audioBytes) {
    const localR2 = createLocalR2AudioAdapter();
    const r2Obj = await localR2.get(cleanName);
    if (r2Obj) {
      const ab = await r2Obj.arrayBuffer();
      audioBytes = new Uint8Array(ab);
    }
  }

  if (!audioBytes && isM4a) {
    const workerUrl = getEffectiveWorkerUrl();
    return NextResponse.redirect(
      `${workerUrl}/audio/${encodeURIComponent(cleanName)}`,
      307
    );
  }

  if (!audioBytes && !shouldUseRemoteWorker()) {
    audioBytes = await fetchRemoteWorkerAudioBytes(cleanName);
  }

  if (!audioBytes) {
    const slug = cleanName.replace(/\.(mp3|m4a)$/i, "");
    const d1 = await ensureD1Snapshot();
    const episode = d1.episodes.find(
      (ep) => ep.slug === slug || ep.audioUrl.endsWith(cleanName)
    );

    if (!episode) {
      return NextResponse.json(
        { error: "Audio object not found", key: cleanName },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    audioBytes = buildValidMp3AudioBytes(
      episode.title || slug,
      episode.transcript || "The CAB Call Weekly Brief",
      600
    );
  }

  const totalSize = audioBytes.byteLength;
  const rangeHeader = req.headers.get("range");

  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const [startStr, endStr] = rangeHeader
      .replace(/^bytes=/, "")
      .split(",")[0]
      .trim()
      .split("-");
    const start = startStr ? parseInt(startStr, 10) : 0;
    const end = endStr
      ? Math.min(totalSize - 1, parseInt(endStr, 10))
      : totalSize - 1;

    if (
      !Number.isNaN(start) &&
      !Number.isNaN(end) &&
      start >= 0 &&
      start <= end &&
      start < totalSize
    ) {
      const sliced = audioBytes.slice(start, end + 1);
      return new NextResponse(sliced, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Length": String(sliced.byteLength),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  return new NextResponse(Buffer.from(audioBytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(totalSize),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
