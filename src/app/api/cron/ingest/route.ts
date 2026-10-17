import { NextRequest, NextResponse } from "next/server";
import { runIngestionPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runIngestionPipeline();
  return NextResponse.json({
    ok: true,
    pipeline: "System 1 (Jev NLI) + System 2 (Bounded Socratic Synthesis)",
    ...result,
  });
}

export async function POST(req: NextRequest) {
  let body: {
    customArticle?: {
      title: string;
      description: string;
      sourceFeed: string;
      link: string;
    };
  } = {};

  try {
    body = await req.json();
  } catch {
    // Empty body triggers standard live RSS feed sweep
  }

  const result = await runIngestionPipeline(body);
  return NextResponse.json({
    ok: true,
    pipeline: "System 1 (Jev NLI) + System 2 (Bounded Socratic Synthesis)",
    ...result,
  });
}
