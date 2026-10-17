import { NextRequest, NextResponse } from "next/server";
import {
  createLocalR2AudioAdapter,
  readLocalD1Snapshot,
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

  let audioBytes: Uint8Array | null = null;
  const localR2 = createLocalR2AudioAdapter();
  const r2Obj = await localR2.get(cleanName);
  if (r2Obj) {
    const ab = await r2Obj.arrayBuffer();
    audioBytes = new Uint8Array(ab);
  }

  if (!audioBytes) {
    const slug = cleanName.replace(/\.mp3$/i, "");
    const d1 = readLocalD1Snapshot();
    const episode =
      d1.episodes.find(
        (ep) => ep.slug === slug || ep.audioUrl.endsWith(cleanName)
      ) || d1.episodes[0];

    audioBytes = buildValidMp3AudioBytes(
      episode?.title || slug,
      episode?.transcript || "The CAB Call Weekly Brief",
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
          "Content-Type": "audio/mpeg",
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
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Content-Length": String(totalSize),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
