import { redirect } from "next/navigation";
import { AdminIncidentsClient } from "@/components/AdminIncidentsClient";
import { getAuditLedgerEntries } from "@/lib/audit";
import { getCurrentAdminSession } from "@/lib/auth";
import { getAdminIncidentsAndTransformsBridge } from "@/lib/incidents";

export const dynamic = "force-dynamic";

export const metadata = {
  title:
    "Incident Editorial Studio & Headline De-Escalation — The CAB Call Admin",
};

export default async function AdminIncidentsPage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin/incidents");
  }

  const [{ incidents, transforms, counts }, auditResult] = await Promise.all([
    getAdminIncidentsAndTransformsBridge({ limit: 100 }),
    getAuditLedgerEntries({ limit: 35 }),
  ]);

  return (
    <AdminIncidentsClient
      actor={actor}
      initialIncidents={incidents}
      initialTransforms={transforms}
      initialCounts={counts}
      initialAuditEntries={auditResult.entries}
      chainIntegrity={auditResult.chainIntegrity}
      defaultTab="incidents"
    />
  );
}
