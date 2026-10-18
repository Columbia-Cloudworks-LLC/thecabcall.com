import { NextRequest, NextResponse } from "next/server";
import {
  createLocalR2AudioAdapter,
  createLocalSqliteD1Adapter,
  ensureD1Snapshot,
  getEffectiveWorkerUrl,
  inferDomainSector,
  shouldUseRemoteWorker,
} from "@/lib/d1-bridge";
import {
  ensureEditorialPipelineSchema,
  generateIncidentTelemetrySvgCard,
  getAdminIncidentById,
} from "@/lib/incidents";
import { getAllIncidents } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const cleanName = decodeURIComponent(filename || "").trim();
  if (!cleanName || cleanName.includes("..") || cleanName.includes("/")) {
    return NextResponse.json(
      { error: "Invalid media filename" },
      { status: 400 }
    );
  }

  // Dynamic blueprint SVG card generation for card-d1-<id>.svg or card-<id>.svg
  const cardMatch = cleanName.match(/^card-(?:d1-)?(\d+)\.svg$/i);
  if (cardMatch) {
    const incidentId = parseInt(cardMatch[1], 10);

    if (shouldUseRemoteWorker()) {
      try {
        const workerUrl = getEffectiveWorkerUrl();
        const res = await fetch(
          `${workerUrl}/media/${encodeURIComponent(cleanName)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const svg = await res.text();
          return new NextResponse(svg, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "public, max-age=300",
            },
          });
        }
      } catch {
        // Fallback to local snapshot/D1
      }
    }

    const db = createLocalSqliteD1Adapter();
    if (db) {
      try {
        await ensureEditorialPipelineSchema(db);
        const incident = await getAdminIncidentById(db, incidentId);
        if (incident) {
          const rec = incident.record;
          const svg = generateIncidentTelemetrySvgCard({
            incidentCode: rec.incidentCode,
            title: rec.title,
            sourceFeed: rec.sourceFeed,
            publishedAt: rec.publishedAt,
            primaryTool: rec.primaryTool,
            secondaryTool: rec.secondaryTool,
            sreFailureMode: rec.sreFailureMode,
            domainSector:
              rec.domainSector ||
              inferDomainSector(rec.sourceFeed, rec.title, rec.rawExcerpt),
            titleRewritten: rec.titleRewritten,
          });
          return new NextResponse(svg, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "public, max-age=300",
            },
          });
        }
      } catch {
        // Ignore and fallback
      }
    }

    await ensureD1Snapshot();
    const matched = getAllIncidents().find(
      (i) => i.id === `d1-inc-${incidentId}` || i.id === `inc-${incidentId}`
    );
    if (matched) {
      const svg = generateIncidentTelemetrySvgCard({
        incidentCode: matched.incidentCode,
        title: matched.title,
        sourceFeed: matched.sourceFeed,
        publishedAt: matched.publishedAt,
        primaryTool: matched.primaryTool,
        secondaryTool: matched.secondaryTool,
        sreFailureMode: matched.sreFailureMode,
        domainSector: matched.domainSector,
        titleRewritten: matched.titleRewritten,
      });
      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    }
  }

  // Proxy from remote Worker R2 /media/:filename if active
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const res = await fetch(
        `${workerUrl}/media/${encodeURIComponent(cleanName)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const ab = await res.arrayBuffer();
        const contentType =
          res.headers.get("content-type") || "application/octet-stream";
        return new NextResponse(Buffer.from(ab), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(ab.byteLength),
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    } catch {
      // Fallback to local R2 adapter
    }
  }

  const localR2 = createLocalR2AudioAdapter();
  const r2Obj = await localR2.get(`media/${cleanName}`);
  if (r2Obj) {
    const ab = await r2Obj.arrayBuffer();
    const contentType =
      r2Obj.httpMetadata?.contentType ||
      (cleanName.endsWith(".svg")
        ? "image/svg+xml; charset=utf-8"
        : cleanName.endsWith(".png")
        ? "image/png"
        : cleanName.endsWith(".webp")
        ? "image/webp"
        : cleanName.endsWith(".gif")
        ? "image/gif"
        : "image/jpeg");

    return new NextResponse(Buffer.from(ab), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(ab.byteLength),
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // If SVG requested, return generic blueprint card
  if (cleanName.toLowerCase().endsWith(".svg")) {
    const svg = generateIncidentTelemetrySvgCard({
      incidentCode: "#CAB-2026-2000",
      title: "Change Advisory Board — Structural Incident Telemetry",
      sourceFeed: "THE CAB CALL",
      publishedAt: new Date().toISOString(),
      primaryTool: "The Square",
      secondaryTool: "24-Inch Gauge",
      sreFailureMode: "Configuration Drift",
      domainSector: "Infrastructure & Supply Chain",
    });
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return NextResponse.json(
    { error: "Media object not found", key: cleanName },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}
