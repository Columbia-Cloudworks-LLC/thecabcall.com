import React from "react";
import { AdminShellNav } from "@/components/AdminShellNav";
import { verifyAuditLedgerChain } from "@/lib/audit";
import { getCurrentAdminSession } from "@/lib/auth";
import { loadLocalEnvVars } from "@/lib/d1-bridge";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const envVars = loadLocalEnvVars();
  const [actor, chainIntegrity] = await Promise.all([
    getCurrentAdminSession(),
    verifyAuditLedgerChain(),
  ]);

  return (
    <AdminShellNav
      actor={actor}
      ownerEmail={envVars.OWNER_ADMIN_EMAIL}
      chainIntegrity={chainIntegrity}
    >
      {children}
    </AdminShellNav>
  );
}
