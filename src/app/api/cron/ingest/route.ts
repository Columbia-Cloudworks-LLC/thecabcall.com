import { NextRequest, NextResponse } from "next/server";
import {
  createLocalSqliteD1Adapter,
  loadLocalEnvVars,
  readLocalD1Snapshot,
} from "@/lib/d1-bridge";
import { runIngestionPipeline } from "@/lib/pipeline";
import { getPipelineRuns, getSystemPostureSummary } from "@/lib/store";
import { runD1IngestPipeline } from "@/pipeline/ingest";
import { runSynthesizePipeline } from "@/pipeline/synthesize";

export const dynamic = "force-dynamic";

async function executeD1CronWorkflow(body: {
  stage?: "ingest" | "synthesize" | "both";
  limit?: number;
  maxNetNew?: number;
  customArticle?: {
    title: string;
    description: string;
    sourceFeed: string;
    link?: string;
  };
}) {
  const db = createLocalSqliteD1Adapter();
  if (!db) {
    const fallback = await runIngestionPipeline(
      body.customArticle
        ? {
            customArticle: {
              title: body.customArticle.title,
              description: body.customArticle.description,
              sourceFeed: body.customArticle.sourceFeed,
              link:
                body.customArticle.link ||
                `https://thecabcall.com/live-sim/${Date.now()}`,
            },
          }
        : undefined
    );
    return {
      ok: true,
      pipeline: "In-Memory Fallback Pipeline",
      ...fallback,
      runs: getPipelineRuns(),
      posture: getSystemPostureSummary(),
    };
  }

  const envVars = loadLocalEnvVars();
  const stage = body.stage || "ingest";

  let ingestSummary = undefined;
  let synthesisSummary = undefined;
  const affectedHashes = new Set<string>();
  const affectedIds = new Set<number>();

  if (body.customArticle) {
    ingestSummary = await runD1IngestPipeline({
      db,
      typesafeApiKey: envVars.TYPESAFE_API_KEY,
      customArticle: body.customArticle,
    });
    const insertedId = ingestSummary.articles[0]?.id;
    if (ingestSummary.articles[0]?.url_hash) {
      affectedHashes.add(ingestSummary.articles[0].url_hash);
    }
    if (insertedId) {
      affectedIds.add(insertedId);
      synthesisSummary = await runSynthesizePipeline({
        db,
        geminiApiKey: envVars.GEMINI_API_KEY,
        articleIds: [insertedId],
      });
    }
  } else if (stage === "synthesize") {
    synthesisSummary = await runSynthesizePipeline({
      db,
      geminiApiKey: envVars.GEMINI_API_KEY,
      limit: body.limit ?? 5,
    });
    for (const art of synthesisSummary.articles) {
      affectedHashes.add(art.url_hash);
      affectedIds.add(art.id);
    }
  } else {
    ingestSummary = await runD1IngestPipeline({
      db,
      typesafeApiKey: envVars.TYPESAFE_API_KEY,
      maxNetNew: body.maxNetNew ?? 10,
      itemsPerFeed: 5,
    });
    for (const art of ingestSummary.articles) {
      affectedHashes.add(art.url_hash);
      if (art.id) affectedIds.add(art.id);
    }

    if (stage === "both") {
      synthesisSummary = await runSynthesizePipeline({
        db,
        geminiApiKey: envVars.GEMINI_API_KEY,
        limit: body.limit ?? 5,
      });
      for (const art of synthesisSummary.articles) {
        affectedHashes.add(art.url_hash);
        affectedIds.add(art.id);
      }
    }
  }

  const snap = readLocalD1Snapshot();
  const createdIncidents = snap.incidents.filter(
    (inc) =>
      affectedHashes.has(inc.urlHash) ||
      Array.from(affectedIds).some((id) => inc.id === `d1-inc-${id}`)
  );

  const runs = getPipelineRuns();
  const posture = getSystemPostureSummary();

  return {
    ok: true,
    pipeline:
      "Cloudflare D1 (cabcall-db) // System-1 Jev (jev-1.14.0) + System-2 Gemini Synthesis",
    stage: body.customArticle ? "custom_sandbox" : stage,
    ingestSummary,
    synthesisSummary,
    run: runs[0],
    runs,
    posture,
    createdIncidents:
      createdIncidents.length > 0
        ? createdIncidents
        : snap.incidents.slice(0, 1),
  };
}

export async function GET() {
  const result = await executeD1CronWorkflow({ stage: "both" });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  let body: {
    stage?: "ingest" | "synthesize" | "both";
    limit?: number;
    maxNetNew?: number;
    customArticle?: {
      title: string;
      description: string;
      sourceFeed: string;
      link?: string;
    };
  } = {};

  try {
    body = await req.json();
  } catch {
    // Empty body triggers standard live D1 RSS feed sweep
  }

  const result = await executeD1CronWorkflow(body);
  return NextResponse.json(result);
}
