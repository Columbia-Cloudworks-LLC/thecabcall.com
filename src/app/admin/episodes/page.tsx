import { redirect } from "next/navigation";
import { AdminEpisodesClient } from "@/components/AdminEpisodesClient";
import { getAuditLedgerEntries } from "@/lib/audit";
import {
  getCurrentAdminSession,
  getSessionTokenFromCookies,
} from "@/lib/auth";
import { getEffectiveWorkerUrl } from "@/lib/d1-bridge";
import { getAdminEpisodesAndCandidatesBridge } from "@/lib/episodes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Podcast Episode & R2 Audio Studio — The CAB Call Admin",
};

export default async function AdminEpisodesPage() {
  const [actor, sessionToken] = await Promise.all([
    getCurrentAdminSession(),
    getSessionTokenFromCookies(),
  ]);
  if (!actor) {
    redirect("/admin/login?next=/admin/episodes");
  }

  const [{ episodes, candidateIncidents }, auditResult] = await Promise.all([
    getAdminEpisodesAndCandidatesBridge(),
    getAuditLedgerEntries({ targetType: "episode", limit: 25 }),
  ]);

  const workerAudioUploadUrl = `${getEffectiveWorkerUrl()}/api/admin/episodes/upload-audio`;

  return (
    <AdminEpisodesClient
      actor={actor}
      initialEpisodes={episodes}
      candidateIncidents={candidateIncidents}
      initialAuditEntries={auditResult.entries}
      chainIntegrity={auditResult.chainIntegrity}
      workerAudioUploadUrl={workerAudioUploadUrl}
      sessionToken={sessionToken}
    />
  );
}
