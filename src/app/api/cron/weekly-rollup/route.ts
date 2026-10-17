import { NextResponse } from "next/server";
import { generateWeeklyRollupEpisode } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const episode = generateWeeklyRollupEpisode();
  return NextResponse.json({
    ok: true,
    episode,
  });
}

export async function POST() {
  const episode = generateWeeklyRollupEpisode();
  return NextResponse.json({
    ok: true,
    episode,
  });
}
