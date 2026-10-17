import { redirect } from "next/navigation";
import { AdminAuditClient } from "@/components/AdminAuditClient";
import { getAuditLedgerEntries, verifyAuditLedgerChain } from "@/lib/audit";
import { getCurrentAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title:
    "Immutable Audit Trail Explorer & Replay Studio — Change Advisory Board",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin/audit");
  }

  const params = await searchParams;
  const actionType =
    typeof params.actionType === "string" ? params.actionType : undefined;
  const targetType =
    typeof params.targetType === "string" ? params.targetType : undefined;
  const targetId =
    typeof params.targetId === "string" ? params.targetId : undefined;
  const actorEmail =
    typeof params.actorEmail === "string" ? params.actorEmail : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const fromDate =
    typeof params.fromDate === "string" ? params.fromDate : undefined;
  const toDate = typeof params.toDate === "string" ? params.toDate : undefined;
  const selectedEventId =
    typeof params.eventId === "string" ? params.eventId : undefined;

  const [auditResult, chainVerification] = await Promise.all([
    getAuditLedgerEntries({
      actionType,
      targetType,
      targetId,
      actorEmail,
      search,
      fromDate,
      toDate,
      limit: 200,
    }),
    verifyAuditLedgerChain(),
  ]);

  return (
    <AdminAuditClient
      actor={actor}
      initialEntries={auditResult.entries}
      initialTotal={auditResult.total}
      initialChainIntegrity={
        auditResult.chainIntegrity || chainVerification
      }
      initialSelectedEventId={selectedEventId}
      initialFilters={{
        actionType,
        targetType,
        targetId,
        actorEmail,
        search,
        fromDate,
        toDate,
      }}
    />
  );
}
