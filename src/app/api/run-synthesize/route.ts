import { NextRequest, NextResponse } from "next/server";
import {
  createLocalSqliteD1Adapter,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
  triggerRemoteWorkerSynthesize,
} from "@/lib/d1-bridge";
import { runSynthesizePipeline } from "@/pipeline/synthesize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const envVars = loadLocalEnvVars();
  const providedSecret = req.headers.get("x-admin-secret");

  if (!providedSecret || providedSecret !== envVars.ADMIN_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing x-admin-secret header" },
      { status: 401 }
    );
  }

  let limit = 5;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number") {
      limit = Math.min(10, Math.max(1, body.limit));
    }
  } catch {
    // default limit 5
  }

  if (shouldUseRemoteWorker()) {
    try {
      const remoteResult = await triggerRemoteWorkerSynthesize({ limit });
      return NextResponse.json(remoteResult);
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

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return NextResponse.json(
      { error: "Local Wrangler D1 database not found in .wrangler/state/v3/d1" },
      { status: 500 }
    );
  }

  const result = await runSynthesizePipeline({
    db,
    geminiApiKey: envVars.GEMINI_API_KEY,
    limit,
  });

  return NextResponse.json({
    ok: true,
    stage: "Stage 4 System-2 Bounded Socratic Synthesis",
    ...result,
  });
}
