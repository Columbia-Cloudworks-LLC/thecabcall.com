import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createLocalSqliteD1Adapter } from "@/lib/d1-bridge";
import { runSynthesizePipeline } from "@/pipeline/synthesize";

export const dynamic = "force-dynamic";

function loadDevVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  try {
    const devVarsPath = path.join(process.cwd(), ".dev.vars");
    if (fs.existsSync(devVarsPath)) {
      const content = fs.readFileSync(devVarsPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match) {
          vars[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
        }
      }
    }
  } catch {
    // ignore
  }
  return vars;
}

export async function POST(req: NextRequest) {
  const devVars = loadDevVars();
  const expectedSecret =
    process.env.ADMIN_SECRET || devVars.ADMIN_SECRET || "local-dev-secret";
  const providedSecret = req.headers.get("x-admin-secret");

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing x-admin-secret header" },
      { status: 401 }
    );
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return NextResponse.json(
      { error: "Local Wrangler D1 database not found in .wrangler/state/v3/d1" },
      { status: 500 }
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

  const geminiApiKey = process.env.GEMINI_API_KEY || devVars.GEMINI_API_KEY;
  const result = await runSynthesizePipeline({
    db,
    geminiApiKey,
    limit,
  });

  return NextResponse.json({
    ok: true,
    stage: "Stage 4 System-2 Bounded Socratic Synthesis",
    ...result,
  });
}
