import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import { uploadAdminMediaBridge } from "@/lib/incidents";
import { hashActorIp } from "@/pipeline/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAdminRequestActor(req, ["owner", "admin", "editor"]);
  if (!auth.authorized || !auth.actor) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized: Admin authentication required" },
      { status: auth.status }
    );
  }
  const actor = auth.actor;

  try {
    const contentTypeHeader = (
      req.headers.get("content-type") || ""
    ).toLowerCase();

    let filename = "incident-image.jpg";
    let contentType = "image/jpeg";
    let bytes: Uint8Array | null = null;
    let base64Data: string | undefined = undefined;
    let incidentId: number | undefined = undefined;
    let imageAlt: string | undefined = undefined;
    let imageCaption: string | undefined = undefined;
    let reason: string | undefined = undefined;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      const fileEntry = formData.get("file");
      if (fileEntry && typeof (fileEntry as Blob).arrayBuffer === "function") {
        const fileObj = fileEntry as File;
        filename = fileObj.name || filename;
        contentType = fileObj.type || contentType;
        const buf = await fileObj.arrayBuffer();
        bytes = new Uint8Array(buf);
      }
      const incVal = formData.get("incidentId");
      if (incVal) {
        const parsedId = Number(String(incVal).replace(/^d1-inc-/i, ""));
        if (Number.isFinite(parsedId) && parsedId > 0) {
          incidentId = parsedId;
        }
      }
      const altVal = formData.get("imageAlt");
      if (typeof altVal === "string") imageAlt = altVal;
      const capVal = formData.get("imageCaption");
      if (typeof capVal === "string") imageCaption = capVal;
      const reasonVal = formData.get("reason");
      if (typeof reasonVal === "string") reason = reasonVal;
    } else {
      const body = (await req.json()) as {
        filename?: string;
        contentType?: string;
        base64Data?: string;
        incidentId?: number | string;
        imageAlt?: string;
        imageCaption?: string;
        reason?: string;
      };
      if (body.filename) filename = body.filename;
      if (body.contentType) contentType = body.contentType;
      if (body.incidentId !== undefined) {
        const parsedId = Number(
          String(body.incidentId).replace(/^d1-inc-/i, "")
        );
        if (Number.isFinite(parsedId) && parsedId > 0) {
          incidentId = parsedId;
        }
      }
      imageAlt = body.imageAlt;
      imageCaption = body.imageCaption;
      reason = body.reason;
      if (body.base64Data) {
        const cleaned = body.base64Data.replace(/^data:[^;]+;base64,/i, "");
        base64Data = cleaned;
        bytes = new Uint8Array(Buffer.from(cleaned, "base64"));
      }
    }

    if (!bytes || bytes.byteLength === 0) {
      return NextResponse.json(
        { ok: false, error: "No image bytes provided for upload." },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");

    const result = await uploadAdminMediaBridge(
      {
        filename,
        contentType,
        bytes,
        base64Data,
        incidentId,
        imageAlt,
        imageCaption,
        reason,
      },
      {
        actorEmail: actor.email,
        actorRole: actor.role,
        authMethod: actor.authMethod,
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
