import { redirect } from "next/navigation";
import { AdminFeedsClient } from "@/components/AdminFeedsClient";
import { getAuditLedgerEntries } from "@/lib/audit";
import { getCurrentAdminSession } from "@/lib/auth";
import { getIngestFeedsBridge } from "@/lib/feeds-filters";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inbound RSS & Atom Feeds Studio — The CAB Call Admin",
};

export default async function AdminFeedsPage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin/feeds");
  }

  const [feeds, auditResult] = await Promise.all([
    getIngestFeedsBridge(),
    getAuditLedgerEntries({ targetType: "ingest_feed", limit: 25 }),
  ]);

  return (
    <AdminFeedsClient
      actor={actor}
      initialFeeds={feeds}
      initialAuditEntries={auditResult.entries}
      chainIntegrity={auditResult.chainIntegrity}
    />
  );
}
