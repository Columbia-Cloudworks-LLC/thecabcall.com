import { redirect } from "next/navigation";
import { AdminFiltersClient } from "@/components/AdminFiltersClient";
import { getAuditLedgerEntries } from "@/lib/audit";
import { getCurrentAdminSession } from "@/lib/auth";
import { getIngestFiltersAndThresholdsBridge } from "@/lib/feeds-filters";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Triage Filters & Jev Thresholds Studio — The CAB Call Admin",
};

export default async function AdminFiltersPage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin/filters");
  }

  const [{ filters, thresholds, feeds }, auditResult] = await Promise.all([
    getIngestFiltersAndThresholdsBridge(),
    getAuditLedgerEntries({ limit: 35 }),
  ]);

  const filterAndThresholdAuditEntries = auditResult.entries.filter(
    (e) =>
      e.targetType === "ingest_filter" || e.targetType === "system_settings"
  );

  return (
    <AdminFiltersClient
      actor={actor}
      initialFilters={filters}
      initialThresholds={thresholds}
      initialFeeds={feeds}
      initialAuditEntries={filterAndThresholdAuditEntries}
      chainIntegrity={auditResult.chainIntegrity}
    />
  );
}
