import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import { testCandidateRssFeedBridge } from "@/lib/feeds-filters";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAdminRequestActor(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: auth.error || "Unauthorized" },
      { status: auth.status }
    );
  }

  try {
    const body = (await req.json()) as { url?: string; maxItems?: number };
    const result = await testCandidateRssFeedBridge(
      body.url || "",
      body.maxItems ?? 5
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
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
