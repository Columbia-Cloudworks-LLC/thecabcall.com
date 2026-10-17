import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequestActor } from "@/lib/auth";
import {
  IngestFilterMatchTarget,
  IngestFilterType,
  testIngestFiltersDryRunBridge,
} from "@/lib/feeds-filters";

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
    const body = (await req.json()) as {
      candidateFilter?: {
        name?: string;
        filterType: IngestFilterType;
        matchTarget?: IngestFilterMatchTarget;
        pattern: string;
        actionValue?: string | null;
        scopeFeedId?: number | null;
      };
      customSamples?: Array<{
        title: string;
        excerpt?: string;
        sourceFeed?: string;
        sourceUrl?: string;
      }>;
      minSystemicProbOverride?: number;
      limit?: number;
    };

    const result = await testIngestFiltersDryRunBridge(body);
    return NextResponse.json(result, { status: 200 });
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
