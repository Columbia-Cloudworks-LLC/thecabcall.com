import { redirect } from "next/navigation";
import { AdminUsersClient } from "@/components/AdminUsersClient";
import { getAuditLedgerEntries } from "@/lib/audit";
import { getAdminUsersBridge, getCurrentAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin User Access Control & Invites — The CAB Call",
};

export default async function AdminUsersPage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin/users");
  }

  const [{ users, ownerEmail }, auditResult] = await Promise.all([
    getAdminUsersBridge(),
    getAuditLedgerEntries({ targetType: "user", limit: 25 }),
  ]);

  return (
    <AdminUsersClient
      actor={actor}
      ownerEmail={ownerEmail}
      initialUsers={users}
      initialAuditEntries={auditResult.entries}
      chainIntegrity={auditResult.chainIntegrity}
    />
  );
}
