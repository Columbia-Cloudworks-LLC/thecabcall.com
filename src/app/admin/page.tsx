import { redirect } from "next/navigation";
import { AdminOverviewClient } from "@/components/AdminOverviewClient";
import { getAuditLedgerEntries } from "@/lib/audit";
import { getAdminUsersBridge, getCurrentAdminSession } from "@/lib/auth";
import {
  ensureD1Snapshot,
  getAllEpisodes,
  getAllIncidents,
  getPipelineRuns,
  getSystemPostureSummary,
} from "@/lib/store";
import { US_HIGH_IMPACT_FEEDS } from "@/pipeline/ingest";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Command Center — Change Advisory Board",
};

export default async function AdminHomePage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin");
  }

  const [d1Snap, { users, ownerEmail }, auditData] = await Promise.all([
    ensureD1Snapshot(true),
    getAdminUsersBridge(),
    getAuditLedgerEntries({ limit: 20 }),
  ]);

  const posture = getSystemPostureSummary();
  const incidents = getAllIncidents();
  const episodes = getAllEpisodes();
  const pipelineRuns = getPipelineRuns().slice(0, 12);

  const activeUsersCount = users.filter((u) => u.status === "active").length;
  const invitedUsersCount = users.filter((u) => u.status === "invited").length;
  const latestEpisode = episodes[0];

  const systemHealth = {
    d1Source: d1Snap.source || "cloudflare-d1",
    synthesizedCount: d1Snap.synthesizedCount || incidents.length,
    triagedCount: d1Snap.triagedCount || 0,
    droppedCount: d1Snap.droppedCount || 0,
    totalEvaluated: d1Snap.totalEvaluated || posture.totalEvaluatedWindow,
    totalIncidents: incidents.length,
    totalEpisodes: episodes.length,
    latestEpisodeTitle: latestEpisode?.title || "Weekly CAB Brief",
    latestEpisodeNumber: latestEpisode?.episodeNumber || 43,
    noiseRejectionRate: posture.noiseRejectionRate,
    avgClassifierLatencyMs: posture.avgClassifierLatencyMs,
    avgJevConfidence: posture.avgSignalConfidence,
    activeFeedCount: US_HIGH_IMPACT_FEEDS.length,
    activeFeedsList: US_HIGH_IMPACT_FEEDS.map((f) => ({
      name: f.name,
      focus: f.focusArea,
    })),
    activeFilterCount: 12,
    activeUsersCount,
    invitedUsersCount,
  };

  return (
    <AdminOverviewClient
      actor={actor}
      ownerEmail={ownerEmail}
      systemHealth={systemHealth}
      initialAuditEntries={auditData.entries}
      initialAuditTotal={auditData.total}
      initialChainIntegrity={auditData.chainIntegrity}
      initialPipelineRuns={pipelineRuns}
    />
  );
}
