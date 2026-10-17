import { NextRequest, NextResponse } from "next/server";
import { evaluateArticleWithJev } from "@/pipeline/jev";

export const dynamic = "force-dynamic";

const DEFAULT_SAMPLE_ARTICLE = {
  title: "FAA Audit Finds Maintenance Logs Skipped Before Regional Outage",
  source: "NPR Top News",
  excerpt:
    "Federal investigators reported Tuesday that routine inspection alerts were repeatedly dismissed over six months due to staffing shortages before the dispatch system failed.",
};

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.ADMIN_SECRET || "local-dev-secret";
  const providedSecret = req.headers.get("x-admin-secret");

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing x-admin-secret header" },
      { status: 401 }
    );
  }

  let body: { title?: string; excerpt?: string; source?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Use default sample article if body is empty
  }

  const article = {
    title: body.title?.trim() || DEFAULT_SAMPLE_ARTICLE.title,
    source: body.source?.trim() || DEFAULT_SAMPLE_ARTICLE.source,
    excerpt: body.excerpt?.trim() || DEFAULT_SAMPLE_ARTICLE.excerpt,
  };

  try {
    const result = await evaluateArticleWithJev(
      article,
      process.env.TYPESAFE_API_KEY
    );

    return NextResponse.json({
      ok: true,
      model: "jev-1.14.0",
      endpoint: "https://api.typesafe.ai/v1/systemone",
      input: article,
      classification: {
        status: result.status,
        is_systemic_prob: result.isSystemicProb,
        jev_confidence: result.jevConfidence,
        primary_tool: result.primaryTool,
        secondary_tool: result.secondaryTool,
        sre_failure_mode: result.sreFailureMode,
        working_tool_probabilities: result.workingToolProbabilities,
        sre_failure_mode_probabilities: result.sreFailureModeProbabilities,
      },
      jev_raw: result.rawResponse,
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
