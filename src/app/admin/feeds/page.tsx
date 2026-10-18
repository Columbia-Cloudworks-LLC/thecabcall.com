import { redirect } from "next/navigation";
import { AdminIncidentsClient } from "@/components/AdminIncidentsClient";
import { getAuditLedgerEntries } from "@/lib/audit";
import { getCurrentAdminSession } from "@/lib/auth";
import { getIngestFiltersAndThresholdsBridge } from "@/lib/feeds-filters";
import { getAdminIncidentsAndTransformsBridge } from "@/lib/incidents";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "RSS Sources — Editorial & Feeds | The CAB Call",
};

export default async function AdminFeedsPage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin/feeds");
  }

  const [
    { incidents, transforms, counts },
    { filters, thresholds, feeds },
    auditResult,
  ] = await Promise.all([
    getAdminIncidentsAndTransformsBridge({ limit: 100 }),
    getIngestFiltersAndThresholdsBridge(),
    getAuditLedgerEntries({ targetType: "ingest_feed", limit: 25 }),
  ]);

  return (
    <AdminIncidentsClient
      actor={actor}
      initialIncidents={incidents}
      initialTransforms={transforms}
      initialCounts={counts}
      initialFeeds={feeds}
      initialFilters={filters}
      initialThresholds={thresholds}
      initialAuditEntries={auditResult.entries}
      chainIntegrity={auditResult.chainIntegrity}
      defaultView="feeds"
    />
  );
}
