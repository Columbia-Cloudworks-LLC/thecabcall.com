"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SquareAndCompassesCrest } from "./MasonicEngravings";
import type { AuthenticatedAdminActor } from "@/pipeline/auth";
import type { AuditChainVerificationResult } from "@/pipeline/audit";

interface AdminShellNavProps {
  actor: AuthenticatedAdminActor | null;
  ownerEmail: string;
  chainIntegrity: AuditChainVerificationResult;
  children: React.ReactNode;
}

export interface AdminNavTabItem {
  id: "overview" | "editorial" | "podcast" | "settings";
  href: string;
  label: string;
  matchPrefixes: string[];
  exact?: boolean;
}

export const ADMIN_NAV_TABS: AdminNavTabItem[] = [
  {
    id: "overview",
    href: "/admin",
    label: "Overview",
    matchPrefixes: ["/admin"],
    exact: true,
  },
  {
    id: "editorial",
    href: "/admin/incidents",
    label: "Editorial & Feeds",
    matchPrefixes: [
      "/admin/incidents",
      "/admin/feeds",
      "/admin/filters",
      "/admin/transforms",
    ],
  },
  {
    id: "podcast",
    href: "/admin/episodes",
    label: "Podcast Studio",
    matchPrefixes: ["/admin/episodes"],
  },
  {
    id: "settings",
    href: "/admin/audit",
    label: "Settings & Audit",
    matchPrefixes: ["/admin/audit", "/admin/users", "/admin/publishing"],
  },
];

export const SETTINGS_SUB_NAV_ITEMS = [
  {
    href: "/admin/audit",
    label: "Audit Ledger",
    description: "Immutable history & state recovery",
  },
  {
    href: "/admin/users",
    label: "Team & Access",
    description: "Authorized editors & invitations",
  },
  {
    href: "/admin/publishing",
    label: "Syndication & Outbound Feeds",
    description: "Public RSS, Podcast XML & JSON feeds",
  },
];

function getRoleBadgeStyle(role: string): string {
  switch (role.toLowerCase()) {
    case "owner":
      return "bg-[#C5A059]/15 border-[#C5A059]/60 text-[#C5A059]";
    case "admin":
      return "bg-emerald-950/60 border-emerald-500/40 text-emerald-300";
    case "editor":
      return "bg-[#111726] border-[#8A6D3B]/60 text-[#F3EFE6]";
    default:
      return "bg-[#111726] border-[#8A6D3B]/40 text-[#94A3B8]";
  }
}

export function isAdminTabActive(
  tab: AdminNavTabItem,
  normalizedAdminPath: string
): boolean {
  if (tab.exact) {
    return normalizedAdminPath === tab.href;
  }
  return tab.matchPrefixes.some(
    (prefix) =>
      normalizedAdminPath === prefix ||
      normalizedAdminPath.startsWith(`${prefix}/`)
  );
}

export function AdminShellNav({
  actor,
  chainIntegrity,
  children,
}: AdminShellNavProps) {
  const pathname = usePathname() || "/admin";
  const router = useRouter();

  // Do not wrap /admin/login with the authenticated shell header
  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/")
  ) {
    return <>{children}</>;
  }

  if (!actor) {
    return <>{children}</>;
  }

  const normalizedAdminPath =
    pathname === "/"
      ? "/admin"
      : pathname.startsWith("/admin")
      ? pathname
      : `/admin${pathname}`;

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
  const activePrimaryTab =
    ADMIN_NAV_TABS.find((t) => isAdminTabActive(t, normalizedAdminPath)) ||
    ADMIN_NAV_TABS[0];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3EFE6]">
      {/* Conditional Alert Banner — ONLY rendered when cryptographic ledger verification fails */}
      {!isChainValid && (
        <div
          role="alert"
          className="bg-red-950/90 border-b border-red-500/70 px-4 sm:px-6 py-3 text-red-100"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-serif">
              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-red-900 border border-red-400 font-display text-[10px] uppercase tracking-widest text-red-100 font-bold">
                Ledger Integrity Alert
              </span>
              <span>
                Cryptographic verification detected a hash discrepancy in the
                editorial audit ledger
                {chainIntegrity?.brokenAtEventId
                  ? ` at event ${chainIntegrity.brokenAtEventId}`
                  : ""}
                .
              </span>
            </div>
            <Link
              href="/admin/audit"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-900/80 hover:bg-red-800 border border-red-400/60 text-xs font-display uppercase tracking-wider text-red-100 transition-all duration-200 ease-out shrink-0"
            >
              Inspect Audit Ledger →
            </Link>
          </div>
        </div>
      )}

      {/* Persistent Editor's Study Masthead & 4-Tab Ledger Bar */}
      <header className="sticky top-0 z-40 border-b border-[#8A6D3B]/55 bg-[#0B0E14]/95 backdrop-blur-md checkered-pavement shadow-[0_8px_28px_rgba(0,0,0,0.55)]">
        {/* Top Burnished Brass Hairline Gradient */}
        <div className="h-[2px] w-full bg-gradient-to-r from-[#0B0E14] via-[#C5A059]/65 to-[#0B0E14]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar: Masthead Identity (Left) + Compact Status & User Controls (Right) */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-3.5 border-b border-[#8A6D3B]/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <Link
                href="/admin"
                className="inline-flex items-center gap-3.5 group min-w-0"
              >
                <SquareAndCompassesCrest className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 transition-transform duration-200 ease-out group-hover:scale-105" />
                <div
                  aria-hidden="true"
                  className="w-[1px] h-8 bg-gradient-to-b from-transparent via-[#C5A059]/65 to-transparent shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-display text-sm sm:text-base tracking-[0.08em] text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors font-semibold">
                      THE CAB CALL
                    </span>
                    <span className="text-[#8A6D3B] hidden sm:inline">•</span>
                    <span className="font-serif italic text-xs sm:text-sm text-[#C5A059]">
                      The Editor&apos;s Study
                    </span>
                  </div>
                  <p className="font-serif text-xs text-[#94A3B8] truncate hidden sm:block">
                    Editorial Trestleboard, Podcast Studio &amp; Governance Ledger
                  </p>
                </div>
              </Link>
            </div>

            {/* Right: Single Compact Ledger Status Badge + Actor Email/Role + Public Site + Sign Out */}
            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href="/admin/audit"
                title={`All ${
                  chainIntegrity?.totalEntries ?? 1
                } editorial records verified in the immutable ledger`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-xs transition-all duration-200 ease-out ${
                  isChainValid
                    ? "bg-[#111726]/90 border-emerald-500/40 text-emerald-300 hover:border-[#C5A059]"
                    : "bg-red-950/70 border-red-500/60 text-red-200 hover:border-red-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isChainValid ? "bg-emerald-400" : "bg-red-400"
                  }`}
                />
                <span className="font-sans text-[11px] font-medium tracking-wide">
                  {isChainValid ? "Ledger Verified" : "Ledger Alert"}
                </span>
              </Link>

              <div className="flex items-center gap-2 border-l border-[#8A6D3B]/35 pl-3">
                <span className="text-xs font-sans text-[#F3EFE6]">
                  {actor.email}
                </span>
                <span
                  className={`px-1.5 py-0.5 border font-display text-[10px] uppercase tracking-wider font-semibold ${getRoleBadgeStyle(
                    actor.role
                  )}`}
                >
                  {actor.role}
                </span>
              </div>

              <a
                href="https://thecabcall.com"
                className="text-xs font-display uppercase tracking-wider text-[#94A3B8] hover:text-[#C5A059] transition-colors"
              >
                Public Site ↗
              </a>

              <button
                type="button"
                onClick={handleSignOut}
                className="text-[#94A3B8] hover:text-red-300 text-xs font-display uppercase tracking-wider transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* 4 Primary Non-Scrolling Navigation Tabs */}
          <nav
            aria-label="Admin Console Navigation"
            className="grid grid-cols-2 sm:flex sm:items-center sm:gap-2 pt-1"
          >
            {ADMIN_NAV_TABS.map((tab) => {
              const isActive = isAdminTabActive(tab, normalizedAdminPath);

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative px-4 py-2.5 font-display text-xs sm:text-[13px] tracking-[0.08em] uppercase transition-all duration-200 ease-out border-b-2 ${
                    isActive
                      ? "border-[#C5A059] text-[#F3EFE6] bg-[#111726]/90 font-bold"
                      : "border-transparent text-[#94A3B8] hover:text-[#F3EFE6] hover:border-[#C5A059]/50 hover:bg-[#111726]/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        isActive
                          ? "bg-[#C5A059]"
                          : "bg-[#8A6D3B]/50 group-hover:bg-[#C5A059]/80"
                      }`}
                    />
                    <span>{tab.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Contextual Secondary Sub-Navigation Bar for Settings & Audit */}
        {activePrimaryTab.id === "settings" && (
          <div className="border-t border-[#8A6D3B]/35 bg-[#111726]/90">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2">
              <div
                role="navigation"
                aria-label="Settings & Audit Sub-Navigation"
                className="flex flex-wrap items-center gap-4"
              >
                {SETTINGS_SUB_NAV_ITEMS.map((sub) => {
                  const isSubActive =
                    normalizedAdminPath === sub.href ||
                    normalizedAdminPath.startsWith(`${sub.href}/`);
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      aria-current={isSubActive ? "page" : undefined}
                      className={`py-2.5 text-xs font-display tracking-wider uppercase border-b-2 transition-all duration-200 ease-out ${
                        isSubActive
                          ? "border-[#C5A059] text-[#F3EFE6] font-semibold"
                          : "border-transparent text-[#94A3B8] hover:text-[#F3EFE6] hover:border-[#C5A059]/60"
                      }`}
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
              <span className="font-serif italic text-xs text-[#94A3B8] hidden md:inline py-2">
                Governance, team invitations &amp; public syndication endpoints
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Active Admin Studio Page Content */}
      <div>{children}</div>
    </div>
  );
}
