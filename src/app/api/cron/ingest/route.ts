import { NextRequest, NextResponse } from "next/server";
import {
  createLocalSqliteD1Adapter,
  ensureD1Snapshot,
  loadLocalEnvVars,
  readLocalD1Snapshot,
  shouldUseRemoteWorker,
  triggerRemoteWorkerIngest,
  triggerRemoteWorkerSynthesize,
} from "@/lib/d1-bridge";
import { projectPublicIncidentDto } from "@/lib/dto";
import { runIngestionPipeline } from "@/lib/pipeline";
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
  const stage = body.stage || "ingest";

  if (shouldUseRemoteWorker()) {
    try {
      const affectedHashes = new Set<string>();
      const affectedIds = new Set<number>();

      if (body.customArticle) {
        const res = await triggerRemoteWorkerIngest({
          synthesize: true,
          synthesizeLimit: 1,
          customArticle: body.customArticle,
        });
        const articles = (res.articles as Array<{ id?: number; url_hash?: string }>) || [];
        for (const art of articles) {
          if (art.url_hash) affectedHashes.add(art.url_hash);
          if (art.id) affectedIds.add(art.id);
        }
      } else if (stage === "synthesize") {
        const res = await triggerRemoteWorkerSynthesize({
          limit: body.limit ?? 5,
        });
        const articles = (res.articles as Array<{ id?: number; url_hash?: string }>) || [];
        for (const art of articles) {
          if (art.url_hash) affectedHashes.add(art.url_hash);
          if (art.id) affectedIds.add(art.id);
        }
      } else {
        const res = await triggerRemoteWorkerIngest({
          synthesize: stage === "both",
          synthesizeLimit: body.limit ?? 5,
          maxNetNew: body.maxNetNew ?? 10,
        });
        const articles = (res.articles as Array<{ id?: number; url_hash?: string }>) || [];
        for (const art of articles) {
          if (art.url_hash) affectedHashes.add(art.url_hash);
          if (art.id) affectedIds.add(art.id);
        }
      }

      const snap = await ensureD1Snapshot(true);
      const createdIncidents = snap.incidents
        .filter(
          (inc) =>
            affectedHashes.has(inc.urlHash) ||
            Array.from(affectedIds).some((id) => inc.id === `d1-inc-${id}`)
        )
        .map((inc) => projectPublicIncidentDto(inc))
        .filter((inc): inc is NonNullable<typeof inc> => inc !== null);

      const fallbackIncidents = snap.incidents
        .slice(0, 1)
        .map((inc) => projectPublicIncidentDto(inc))
        .filter((inc): inc is NonNullable<typeof inc> => inc !== null);

      return {
        ok: true,
        stage: body.customArticle ? "custom_sandbox" : stage,
        createdIncidents:
          createdIncidents.length > 0 ? createdIncidents : fallbackIncidents,
      };
    } catch (err) {
      console.warn(
        "[Cron Ingest] Remote Cloudflare Worker call failed, checking local fallback:",
        err
      );
    }
  }

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
      stage: body.customArticle ? "custom_sandbox" : stage,
      createdIncidents: fallback.createdIncidents
        .map((inc) => projectPublicIncidentDto(inc))
        .filter((inc): inc is NonNullable<typeof inc> => inc !== null),
    };
  }

  const envVars = loadLocalEnvVars();

  const affectedHashes = new Set<string>();
  const affectedIds = new Set<number>();

  if (body.customArticle) {
    const ingestSummary = await runD1IngestPipeline({
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
      await runSynthesizePipeline({
        db,
        geminiApiKey: envVars.GEMINI_API_KEY,
        articleIds: [insertedId],
      });
    }
  } else if (stage === "synthesize") {
    const synthesisSummary = await runSynthesizePipeline({
      db,
      geminiApiKey: envVars.GEMINI_API_KEY,
      limit: body.limit ?? 5,
    });
    for (const art of synthesisSummary.articles) {
      affectedHashes.add(art.url_hash);
      affectedIds.add(art.id);
    }
  } else {
    const ingestSummary = await runD1IngestPipeline({
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
      const synthesisSummary = await runSynthesizePipeline({
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
  const createdIncidents = snap.incidents
    .filter(
      (inc) =>
        affectedHashes.has(inc.urlHash) ||
        Array.from(affectedIds).some((id) => inc.id === `d1-inc-${id}`)
    )
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null);

  const fallbackIncidents = snap.incidents
    .slice(0, 1)
    .map((inc) => projectPublicIncidentDto(inc))
    .filter((inc): inc is NonNullable<typeof inc> => inc !== null);

  return {
    ok: true,
    stage: body.customArticle ? "custom_sandbox" : stage,
    createdIncidents:
      createdIncidents.length > 0 ? createdIncidents : fallbackIncidents,
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
