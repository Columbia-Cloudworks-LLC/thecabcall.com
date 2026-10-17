import { NextRequest, NextResponse } from "next/server";
import { generateAuditDisclosureBundle } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filters = {
      actionType: url.searchParams.get("actionType") || undefined,
      targetType: url.searchParams.get("targetType") || undefined,
      targetId: url.searchParams.get("targetId") || undefined,
      actorEmail: url.searchParams.get("actorEmail") || undefined,
      search: url.searchParams.get("search") || undefined,
      fromDate: url.searchParams.get("fromDate") || undefined,
      toDate: url.searchParams.get("toDate") || undefined,
      limit: url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!, 10)
        : 500,
    };

    const bundle = await generateAuditDisclosureBundle(filters);
    const format = (url.searchParams.get("format") || "json").toLowerCase();

    if (format === "markdown" || format === "md") {
      return new NextResponse(bundle.markdownReport, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="cabcall-audit-disclosure-${bundle.generatedAt.slice(
            0,
            10
          )}.md"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(bundle, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
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
