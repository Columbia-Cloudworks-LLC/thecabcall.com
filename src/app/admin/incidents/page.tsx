import { redirect } from "next/navigation";
import { AdminIncidentsClient } from "@/components/AdminIncidentsClient";
import { getAuditLedgerEntries } from "@/lib/audit";
import { getCurrentAdminSession } from "@/lib/auth";
import { getIngestFiltersAndThresholdsBridge } from "@/lib/feeds-filters";
import { getAdminIncidentsAndTransformsBridge } from "@/lib/incidents";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editorial & Feeds — The Editor's Study | The CAB Call",
};

export default async function AdminIncidentsPage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin/incidents");
  }

  const [
    { incidents, transforms, counts },
    { filters, thresholds, feeds },
    auditResult,
  ] = await Promise.all([
    getAdminIncidentsAndTransformsBridge({ limit: 100 }),
    getIngestFiltersAndThresholdsBridge(),
    getAuditLedgerEntries({ limit: 35 }),
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
      defaultView="stories"
    />
  );
}
