import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuditLedgerEntries } from "@/lib/audit";
import { getAdminUsersBridge, getCurrentAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Console — Change Advisory Board",
};

export default async function AdminHomePage() {
  const actor = await getCurrentAdminSession();
  if (!actor) {
    redirect("/admin/login?next=/admin");
  }

  const [{ users, ownerEmail }, auditData] = await Promise.all([
    getAdminUsersBridge(),
    getAuditLedgerEntries({ limit: 15 }),
  ]);

  const activeUsers = users.filter((u) => u.status === "active").length;
  const invitedUsers = users.filter((u) => u.status === "invited").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[#C5A059]">
            THE CAB CALL // SRE GOVERNANCE &amp; EDITORIAL CONSOLE
          </div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-[#F3EFE6] mt-1">
            Change Advisory Board Command Center
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Signed in as{" "}
            <span className="font-mono text-[#F3EFE6]">{actor.email}</span> (
            <span className="font-mono uppercase text-[#C5A059]">
              {actor.role}
            </span>{" "}
            via <span className="font-mono">{actor.authMethod}</span>) • Initial
            Owner Lock: <span className="font-mono">{ownerEmail}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/users"
            className="bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-mono text-xs font-semibold uppercase px-4 py-2.5 rounded transition-colors"
          >
            Manage Users &amp; Invites →
          </Link>
          <a
            href="/api/auth/logout"
            className="px-3.5 py-2.5 rounded border border-red-500/40 text-red-200 font-mono text-xs hover:bg-red-950/40 transition-colors"
          >
            Sign Out
          </a>
        </div>
      </div>

      {/* Telemetry & Governance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5">
          <div className="font-mono text-xs uppercase text-[#8E9BAE]">
            Authorized Accounts
          </div>
          <div className="font-cinzel text-3xl font-bold text-[#F3EFE6] mt-2">
            {activeUsers} Active / {invitedUsers} Invited
          </div>
          <Link
            href="/admin/users"
            className="inline-block mt-3 font-mono text-xs text-[#C5A059] hover:underline"
          >
            Open User Access Studio →
          </Link>
        </div>

        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5">
          <div className="font-mono text-xs uppercase text-[#8E9BAE]">
            Immutable Audit Ledger
          </div>
          <div className="font-cinzel text-3xl font-bold text-emerald-300 mt-2">
            {auditData.chainIntegrity?.valid !== false
              ? "VERIFIED"
              : "INTEGRITY ALERT"}
          </div>
          <div className="font-mono text-xs text-[#8E9BAE] mt-2">
            {auditData.total} Hash-Chained Events
          </div>
        </div>

        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5">
          <div className="font-mono text-xs uppercase text-[#8E9BAE]">
            Public Disclosure Bundle
          </div>
          <div className="font-cinzel text-xl font-bold text-[#F3EFE6] mt-2">
            SHA-256 Signed Export
          </div>
          <div className="flex items-center gap-3 mt-3 font-mono text-xs">
            <a
              href="/api/admin/audit/export?format=md"
              className="text-[#C5A059] hover:underline"
            >
              Download .MD
            </a>
            <span className="text-[#263147]">|</span>
            <a
              href="/api/admin/audit/export?format=json"
              className="text-[#C5A059] hover:underline"
            >
              Download .JSON
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
