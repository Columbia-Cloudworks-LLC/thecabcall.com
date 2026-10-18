"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AuthenticatedAdminActor } from "@/pipeline/auth";
import type { AuditChainVerificationResult } from "@/pipeline/audit";

interface AdminShellNavProps {
  actor: AuthenticatedAdminActor | null;
  ownerEmail: string;
  chainIntegrity: AuditChainVerificationResult;
  children: React.ReactNode;
}

interface NavTabItem {
  href: string;
  label: string;
  shortDesc: string;
  exact?: boolean;
}

const ADMIN_NAV_TABS: NavTabItem[] = [
  {
    href: "/admin",
    label: "Overview",
    shortDesc: "Telemetry & Quick Actions",
    exact: true,
  },
  {
    href: "/admin/episodes",
    label: "Episodes",
    shortDesc: "Podcast & R2 Audio Studio",
  },
  {
    href: "/admin/feeds",
    label: "Inbound Feeds",
    shortDesc: "RSS/Atom Sources",
  },
  {
    href: "/admin/filters",
    label: "Triage Filters",
    shortDesc: "Noise & Jev Gate Rules",
  },
  {
    href: "/admin/incidents",
    label: "Incidents & Transforms",
    shortDesc: "Headline De-Escalation & Media",
  },
  {
    href: "/admin/publishing",
    label: "Published Feeds",
    shortDesc: "Outbound RSS & JSON Syndication",
  },
  {
    href: "/admin/users",
    label: "Users & Invites",
    shortDesc: "OAuth & Magic Link Access",
  },
  {
    href: "/admin/audit",
    label: "Audit Ledger",
    shortDesc: "SHA-256 Diff, Replay & Disclosure",
  },
];

function formatAuthMethodLabel(method: string): string {
  switch (method) {
    case "google_oauth":
      return "Google OAuth";
    case "magic_link":
      return "Magic Link";
    case "admin_secret":
      return "Admin Secret";
    case "system_bootstrap":
      return "System Bootstrap";
    default:
      return method;
  }
}

function getRoleBadgeStyle(role: string): string {
  switch (role.toLowerCase()) {
    case "owner":
      return "bg-[#C5A059]/20 border-[#C5A059] text-[#E5C178]";
    case "admin":
      return "bg-emerald-950/70 border-emerald-500/50 text-emerald-300";
    case "editor":
      return "bg-sky-950/70 border-sky-500/50 text-sky-300";
    default:
      return "bg-slate-900 border-slate-600 text-slate-300";
  }
}

export function AdminShellNav({
  actor,
  ownerEmail,
  chainIntegrity,
  children,
}: AdminShellNavProps) {
  const pathname = usePathname() || "/admin";
  const router = useRouter();

  // Do not wrap /admin/login with the authenticated shell header
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return <>{children}</>;
  }

  if (!actor) {
    return <>{children}</>;
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/admin/login");
    router.refresh();
  }

  const isChainValid = chainIntegrity?.valid !== false;
  const headHashShort =
    chainIntegrity?.headHash && chainIntegrity.headHash !== "GENESIS"
      ? `${chainIntegrity.headHash.slice(0, 10)}…`
      : "GENESIS";

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3EFE6]">
      {/* Persistent SRE Command Center Shell Header */}
      <div className="border-b border-[#263147] bg-[#0E131D]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-3 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Left: Console Title & Cryptographic Chain Seal */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[11px] uppercase tracking-widest text-[#C5A059] font-semibold">
                  THE CAB CALL // SRE GOVERNANCE &amp; EDITORIAL COMMAND CENTER
                </span>

                <Link
                  href="/admin/audit"
                  title="Inspect Immutable SHA-256 Audit Chain & Replay Studio"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border font-mono text-[11px] transition-colors ${
                    isChainValid
                      ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:border-emerald-400"
                      : "bg-red-950/70 border-red-500/60 text-red-200 hover:border-red-400"
                  }`}
                >
                  <span>{isChainValid ? "●" : "▲"}</span>
                  <span className="font-semibold">
                    {isChainValid
                      ? "AUDIT CHAIN VERIFIED"
                      : "CHAIN INTEGRITY ALERT"}
                  </span>
                  <span className="text-[10px] opacity-80">
                    ({chainIntegrity?.totalEntries ?? 1} entries • HEAD{" "}
                    {headHashShort})
                  </span>
                </Link>
              </div>

              <div className="text-xs text-[#8E9BAE] font-mono">
                Owner Lock:{" "}
                <span className="text-[#D6D1C7]">{ownerEmail}</span> • All
                administrative &amp; editorial mutations are hash-chained in{" "}
                <code className="text-[#C5A059]">audit_ledger</code>
              </div>
            </div>

            {/* Right: Actor Identity, Role Badge, Auth Method Badge & Sign Out */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="bg-[#111622] border border-[#263147] rounded-md px-3 py-1.5 flex items-center gap-2.5">
                <div className="text-xs font-mono text-[#F3EFE6] font-medium">
                  {actor.email}
                </div>
                <span
                  className={`px-2 py-0.5 rounded border font-mono text-[10px] uppercase font-bold tracking-wider ${getRoleBadgeStyle(
                    actor.role
                  )}`}
                >
                  {actor.role.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#182032] border border-[#2E3C56] font-mono text-[10px] text-[#9CA3AF]">
                  {formatAuthMethodLabel(actor.authMethod)}
                </span>
              </div>

              <Link
                href="/"
                className="px-3 py-1.5 rounded border border-[#263147] hover:border-[#C5A059] text-xs font-mono text-[#D6D1C7] transition-colors"
              >
                Public Site ↗
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-200 text-xs font-mono transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* 8 Navigation Tabs */}
          <nav
            aria-label="Admin Console Navigation"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin"
          >
            {ADMIN_NAV_TABS.map((tab) => {
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname === tab.href ||
                  pathname.startsWith(`${tab.href}/`) ||
                  (tab.href === "/admin/incidents" &&
                    pathname.startsWith("/admin/transforms"));

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`group shrink-0 px-3.5 py-2 rounded-md border font-mono text-xs transition-all ${
                    isActive
                      ? "bg-[#C5A059]/15 border-[#C5A059] text-[#F3EFE6] shadow-sm"
                      : "bg-[#111622]/70 border-[#263147] text-[#9CA3AF] hover:text-[#F3EFE6] hover:border-[#3A4A6B]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive
                          ? "bg-[#C5A059]"
                          : "bg-[#3A4A6B] group-hover:bg-[#8E9BAE]"
                      }`}
                    />
                    <span className="font-semibold">{tab.label}</span>
                  </div>
                  <div className="text-[10px] text-[#8E9BAE] mt-0.5 hidden xl:block">
                    {tab.shortDesc}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Active Admin Studio Page Content */}
      <div>{children}</div>
    </div>
  );
}
