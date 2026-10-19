"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WorkingToolEngraving } from "./MasonicEngravings";
import { PublicEpisodeDto, PublicIncidentDto } from "@/lib/dto";
import { WorkingToolHubAggregationResult } from "@/lib/archive-pagination";
import {
  DOMAIN_SECTOR_SPECS,
  formatCompactCaseId,
  formatFriendlyDate,
  formatFriendlySourceName,
  getDomainSectorHref,
  getFailureModeHref,
  getSreFailureModeSpec,
  getWorkingToolHref,
  WORKING_TOOLS,
  WorkingToolSpec,
} from "@/lib/taxonomy";

interface WorkingToolHubClientProps {
  spec: WorkingToolSpec;
  corpus: PublicIncidentDto[];
  initialTelemetry: WorkingToolHubAggregationResult;
  relatedEpisodes: PublicEpisodeDto[];
}

const HUB_PAGE_SIZE = 12;

export function WorkingToolHubClient({
  spec,
  corpus,
  initialTelemetry,
  relatedEpisodes,
}: WorkingToolHubClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const roleParam = searchParams.get("role");
  const activeRole: "all" | "primary" | "secondary" =
    roleParam === "primary" || roleParam === "secondary" ? roleParam : "all";

  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const requestedPage = Math.max(1, Number.isNaN(pageParam) ? 1 : pageParam);

  const currentToolIndex = WORKING_TOOLS.findIndex((t) => t.id === spec.id);
  const prevTool =
    WORKING_TOOLS[(currentToolIndex - 1 + WORKING_TOOLS.length) % WORKING_TOOLS.length];
  const nextTool = WORKING_TOOLS[(currentToolIndex + 1) % WORKING_TOOLS.length];

  const pairedFailureSpec = useMemo(
    () => getSreFailureModeSpec(spec.pairedFailureMode),
    [spec.pairedFailureMode]
  );

  const matchingIncidents = useMemo(() => {
    return corpus.filter((inc) => {
      if (activeRole === "primary") return inc.primaryTool === spec.id;
      if (activeRole === "secondary") return inc.secondaryTool === spec.id;
      return inc.primaryTool === spec.id || inc.secondaryTool === spec.id;
    });
  }, [corpus, spec.id, activeRole]);

  const totalPages = Math.max(1, Math.ceil(matchingIncidents.length / HUB_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageOffset = (currentPage - 1) * HUB_PAGE_SIZE;
  const paginatedItems = matchingIncidents.slice(pageOffset, pageOffset + HUB_PAGE_SIZE);
  const startIndex = matchingIncidents.length === 0 ? 0 : pageOffset + 1;
  const endIndex =
    matchingIncidents.length === 0
      ? 0
      : Math.min(matchingIncidents.length, pageOffset + paginatedItems.length);

  const updateUrlParams = (updates: {
    role?: "all" | "primary" | "secondary";
    page?: number;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextRole = updates.role ?? activeRole;
    const nextPage = updates.page ?? 1;

    if (nextRole === "all") {
      params.delete("role");
    } else {
      params.set("role", nextRole);
    }

    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Top Breadcrumb & Prev/Next Working Tool Bar */}
      <nav
        aria-label="Working Tool Breadcrumb & Navigation"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
          <Link href="/rubric" className="hover:text-[#D4AF37] transition-colors">
            The Working Tools &amp; Rubric
          </Link>
          <span className="text-slate-600">→</span>
          <Link href="/rubric#axis-1" className="hover:text-[#D4AF37] transition-colors">
            Axis I: Working Tools
          </Link>
          <span className="text-slate-600">→</span>
          <span className="text-[#D4AF37] font-semibold">{spec.id}</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <Link
            href={getWorkingToolHref(prevTool.id)}
            className="px-2.5 py-1 rounded border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-colors"
            title={`Previous Tool: ${prevTool.id}`}
          >
            ← {prevTool.shortName}
          </Link>
          <Link
            href="/rubric"
            className="px-2.5 py-1 rounded border border-slate-800 bg-slate-950/80 text-slate-400 hover:text-[#F4EFE6] transition-colors"
          >
            Codex Index
          </Link>
          <Link
            href={getWorkingToolHref(nextTool.id)}
            className="px-2.5 py-1 rounded border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-colors"
            title={`Next Tool: ${nextTool.id}`}
          >
            {nextTool.shortName} →
          </Link>
        </div>
      </nav>

      {/* Hero Masthead (.tracing-board-frame) */}
      <section className="tracing-board-frame rounded-lg bg-[#111827]/95 p-6 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-lg border border-[#D4AF37]/30 bg-slate-950/90 relative overflow-hidden">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/80 mb-3">
              Axis I · Tool {spec.numeral} of VI
            </div>
            <WorkingToolEngraving
              tool={spec.id}
              className="w-52 h-32 border border-[#D4AF37]/40 bg-slate-950/90 p-2 shadow-inner"
            />
            <div className="mt-4 text-center">
              <div className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                {spec.engravingCaption}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {spec.sreEquivalent}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-1 rounded text-xs font-mono uppercase tracking-widest bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 font-semibold">
                Axis I · Masonic Working Tool {spec.numeral}
              </span>
              <Link
                href={getFailureModeHref(pairedFailureSpec.id)}
                className="px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider bg-amber-950/40 text-amber-200 border border-amber-500/40 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
              >
                Primary Paired Failure Mode: {pairedFailureSpec.craftShortLabel} →
              </Link>
            </div>

            <div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F4EFE6] tracking-tight">
                {spec.id}
              </h1>
              <p className="text-base sm:text-lg text-[#D4AF37] font-serif italic mt-1.5">
                {spec.moralLens} — {spec.sreEquivalent}
              </p>
            </div>

            {/* Core Diagnostic Question Callout */}
            <div className="p-4 sm:p-5 rounded-md border-l-4 border-[#D4AF37] bg-slate-950/85 space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#D4AF37]">
                Core Socratic Diagnostic Question
              </div>
              <p className="font-serif text-lg sm:text-xl text-[#F4EFE6] leading-relaxed">
                &ldquo;{spec.diagnosticQuestionPattern}&rdquo;
              </p>
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {spec.sreDefinition}
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={`/archive?tool=${spec.slug}`}
                className="px-4 py-2 rounded bg-[#D4AF37] text-slate-950 font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#e3be42] transition-colors"
              >
                Filter Master Ledger by {spec.shortName} ({initialTelemetry.totalTagged}) →
              </Link>
              <Link
                href={getFailureModeHref(pairedFailureSpec.id)}
                className="px-4 py-2 rounded border border-slate-700 bg-slate-900/80 text-slate-200 hover:border-[#D4AF37]/60 hover:text-[#D4AF37] font-mono text-xs uppercase tracking-wider transition-colors"
              >
                Inspect Paired Failure Hub: {pairedFailureSpec.craftShortLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Cross-Axis Telemetry Bar */}
      <section
        aria-label="Live Cross-Axis Telemetry Breakdown"
        className="rounded-lg border border-slate-800 bg-[#111827]/85 p-6 sm:p-7 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37] block">
              Live Corpus Telemetry · Axis I × Axis II × Axis III
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#F4EFE6] mt-0.5">
              Operational Incidence &amp; Cross-Axis Distribution
            </h2>
          </div>
          <Link
            href={`/archive?tool=${spec.slug}#matrix`}
            className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:underline"
          >
            View in 6×6 Diagnostic Matrix →
          </Link>
        </div>

        {/* 3 Primary Metric Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded border border-[#D4AF37]/30 bg-slate-950/75">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Total Tagged Dispatches
            </div>
            <div className="font-serif text-3xl font-bold text-[#D4AF37] mt-1">
              {initialTelemetry.totalTagged}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Active post-incident reviews invoking {spec.id}
            </div>
          </div>

          <div className="p-4 rounded border border-slate-800 bg-slate-950/75">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Primary Diagnostic Lens
            </div>
            <div className="font-serif text-3xl font-bold text-[#F4EFE6] mt-1">
              {initialTelemetry.primaryCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Dispatches where {spec.shortName} is the dominant Working Tool
            </div>
          </div>

          <div className="p-4 rounded border border-slate-800 bg-slate-950/75">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Secondary Corroborating Lens
            </div>
            <div className="font-serif text-3xl font-bold text-slate-200 mt-1">
              {initialTelemetry.secondaryCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Dispatches where {spec.shortName} serves as secondary corrective check
            </div>
          </div>
        </div>

        {/* Co-Occurring Failure Modes & Axis 3 Sector Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Co-Occurring SRE Failure Modes */}
          <div className="p-5 rounded border border-slate-800/90 bg-slate-950/60 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                Co-Occurring Failure Modes (Axis II)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Click label to inspect Failure Hub
              </span>
            </div>
            <div className="space-y-3">
              {initialTelemetry.coOccurringFailureModes.map((entry) => {
                const fmSpec = getSreFailureModeSpec(entry.failureMode);
                const isPaired = entry.failureMode === spec.pairedFailureMode;
                return (
                  <div key={entry.failureMode} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={getFailureModeHref(entry.failureMode)}
                          className="font-medium text-[#F4EFE6] hover:text-[#D4AF37] transition-colors truncate"
                        >
                          {fmSpec.craftShortLabel}
                        </Link>
                        {isPaired && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 shrink-0">
                            Primary Pairing
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/archive?tool=${spec.slug}&failure=${fmSpec.slug}`}
                        className="font-mono text-slate-300 hover:text-[#D4AF37] shrink-0 ml-2"
                      >
                        {entry.count} ({entry.percentage}%)
                      </Link>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D4AF37]/70 to-[#D4AF37]"
                        style={{ width: `${Math.max(entry.count > 0 ? 6 : 0, entry.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Domain Sector Breakdown (Axis III) */}
          <div className="p-5 rounded border border-slate-800/90 bg-slate-950/60 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                Domain Sector Breakdown (Axis III)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Click sector to filter Archive
              </span>
            </div>
            <div className="space-y-3">
              {initialTelemetry.sectorBreakdown.map((entry) => {
                const secSpec = DOMAIN_SECTOR_SPECS.find((s) => s.id === entry.sector);
                return (
                  <div key={entry.sector} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Link
                        href={
                          secSpec
                            ? `/archive?tool=${spec.slug}&sector=${secSpec.slug}`
                            : getDomainSectorHref(entry.sector)
                        }
                        className="font-medium text-[#F4EFE6] hover:text-[#D4AF37] transition-colors"
                      >
                        {entry.sector}
                      </Link>
                      <span className="font-mono text-slate-300">
                        {entry.count} ({entry.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800/80">
                      <div
                        className="h-full rounded-full bg-amber-500/75"
                        style={{ width: `${Math.max(entry.count > 0 ? 6 : 0, entry.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 3-Part Editorial Essay Section */}
      <section
        aria-label="Three-Part Working Tool Editorial Essay"
        className="space-y-6"
      >
        <div className="border-b border-slate-800 pb-3">
          <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37] block">
            Editorial Monograph · Operative &amp; Systems Architecture
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#F4EFE6] mt-1">
            The Craft &amp; Systems Lineage of {spec.id}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Part I: Operative Stonecraft Origin */}
          <article className="rounded-lg border border-slate-800 bg-[#111827]/90 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                I. Operative Stonecraft Origin
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F4EFE6]">
                Physical Geometry in the Lodge Quarry
              </h3>
              <p className="text-xs font-mono text-amber-200/90 bg-amber-950/30 border border-amber-500/20 rounded px-3 py-2">
                {spec.moralDefinition}
              </p>
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                {spec.operativeOriginEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400 italic font-serif">
              Engraving Plate: {spec.engravingCaption}
            </div>
          </article>

          {/* Part II: Moral & Civic Application */}
          <article className="rounded-lg border border-slate-800 bg-[#111827]/90 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                II. Moral &amp; Civic Application
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F4EFE6]">
                Speculative Ethics &amp; Institutional Duty
              </h3>
              <p className="text-xs font-mono text-amber-200/90 bg-amber-950/30 border border-amber-500/20 rounded px-3 py-2">
                {spec.moralLens}
              </p>
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                {spec.moralCivicApplicationEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400">
              Diagnostic Focus: {spec.jevClassifierCriteria}
            </div>
          </article>

          {/* Part III: Shop-Floor & Systems Engineering Equivalent */}
          <article className="rounded-lg border border-[#D4AF37]/35 bg-[#111827]/95 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                III. Shop-Floor &amp; Systems Engineering Equivalent
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F4EFE6]">
                High-Reliability Production Telemetry
              </h3>
              <p className="text-xs font-mono text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded px-3 py-2">
                {spec.sreEquivalent}
              </p>
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                {spec.systemsEngineeringEquivalentEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#D4AF37]">
                Operational Verification Checklist
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {spec.operationalPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#D4AF37] font-mono">▪</span>
                    <span>{practice}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>

      {/* Paginated Dispatch Ledger for this Working Tool */}
      <section
        id="dispatches"
        aria-label={`Dispatches Tagged with ${spec.id}`}
        className="space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37] block">
              Verified Case Ledger · {spec.id}
            </span>
            <h2 className="font-serif text-2xl font-bold text-[#F4EFE6] mt-0.5">
              Post-Incident Dispatches Invoking {spec.id}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Showing {startIndex}–{endIndex} of {matchingIncidents.length} matching dispatches
            </p>
          </div>

          {/* Role Filter Toggle (All / Primary Only / Secondary Only) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => updateUrlParams({ role: "all", page: 1 })}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                activeRole === "all"
                  ? "bg-[#D4AF37] text-slate-950 font-bold"
                  : "text-slate-300 hover:text-[#F4EFE6]"
              }`}
            >
              All ({initialTelemetry.totalTagged})
            </button>
            <button
              type="button"
              onClick={() => updateUrlParams({ role: "primary", page: 1 })}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                activeRole === "primary"
                  ? "bg-[#D4AF37] text-slate-950 font-bold"
                  : "text-slate-300 hover:text-[#F4EFE6]"
              }`}
            >
              Primary Only ({initialTelemetry.primaryCount})
            </button>
            <button
              type="button"
              onClick={() => updateUrlParams({ role: "secondary", page: 1 })}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                activeRole === "secondary"
                  ? "bg-[#D4AF37] text-slate-950 font-bold"
                  : "text-slate-300 hover:text-[#F4EFE6]"
              }`}
            >
              Secondary Only ({initialTelemetry.secondaryCount})
            </button>
          </div>
        </div>

        {paginatedItems.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-8 text-center space-y-3">
            <p className="font-serif text-lg text-slate-300">
              No dispatches match the selected {activeRole} role filter for {spec.id}.
            </p>
            <button
              type="button"
              onClick={() => updateUrlParams({ role: "all", page: 1 })}
              className="px-4 py-2 rounded border border-[#D4AF37]/50 text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:bg-[#D4AF37]/10 cursor-pointer"
            >
              Show All {spec.id} Dispatches
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paginatedItems.map((inc) => {
              const fmSpec = getSreFailureModeSpec(inc.sreFailureMode);
              const isPrimary = inc.primaryTool === spec.id;
              return (
                <article
                  key={inc.id}
                  className="rounded-lg border border-slate-800/90 bg-[#111827]/90 p-5 flex flex-col justify-between gap-4 hover:border-[#D4AF37]/50 transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-[#D4AF37] font-semibold">
                          {formatCompactCaseId(inc.incidentCode, inc.id)}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-300">
                          {formatFriendlySourceName(inc.sourceFeed)}
                        </span>
                      </div>
                      <span className="text-slate-400">
                        {formatFriendlyDate(inc.publishedAt)}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg font-bold text-[#F4EFE6] leading-snug">
                      <Link
                        href={`/incidents/${inc.slug}`}
                        className="hover:text-[#D4AF37] transition-colors"
                      >
                        {inc.title}
                      </Link>
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-300 line-clamp-3 leading-relaxed">
                      {inc.executiveSummary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                      <span
                        className={`px-2 py-0.5 rounded border ${
                          isPrimary
                            ? "bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40"
                            : "bg-slate-900 text-slate-300 border-slate-700"
                        }`}
                      >
                        {isPrimary ? `Primary: ${inc.primaryTool}` : `Secondary: ${inc.secondaryTool}`}
                      </span>
                      <Link
                        href={getFailureModeHref(inc.sreFailureMode)}
                        className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-950/30 text-amber-200 hover:border-[#D4AF37] transition-colors"
                      >
                        {fmSpec.craftShortLabel}
                      </Link>
                    </div>

                    <Link
                      href={`/incidents/${inc.slug}`}
                      className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:underline"
                    >
                      Read Dispatch →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="text-xs font-mono text-slate-400">
              Page {currentPage} of {totalPages} ({matchingIncidents.length} total dispatches)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => updateUrlParams({ page: currentPage - 1 })}
                className="px-3 py-1.5 rounded border border-slate-800 bg-slate-900/80 text-xs font-mono text-slate-200 disabled:opacity-40 hover:border-[#D4AF37]/50 cursor-pointer"
              >
                ← Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateUrlParams({ page: p })}
                  className={`px-3 py-1.5 rounded border text-xs font-mono cursor-pointer ${
                    p === currentPage
                      ? "border-[#D4AF37] bg-[#D4AF37] text-slate-950 font-bold"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => updateUrlParams({ page: currentPage + 1 })}
                className="px-3 py-1.5 rounded border border-slate-800 bg-slate-900/80 text-xs font-mono text-slate-200 disabled:opacity-40 hover:border-[#D4AF37]/50 cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Related CAB Call Podcast Episodes */}
      {relatedEpisodes.length > 0 && (
        <section
          aria-label="Related CAB Call Podcast Episodes"
          className="rounded-lg border border-slate-800 bg-[#111827]/85 p-6 sm:p-7 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37] block">
                Audio Rollup Synthesis
              </span>
              <h2 className="font-serif text-xl font-bold text-[#F4EFE6]">
                CAB Call Podcast Episodes Featuring {spec.id}
              </h2>
            </div>
            <Link
              href="/podcast"
              className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:underline"
            >
              All Podcast Episodes →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedEpisodes.slice(0, 4).map((ep) => (
              <div
                key={ep.id}
                className="p-4 rounded border border-slate-800 bg-slate-950/75 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="text-[#D4AF37]">Episode #{ep.episodeNumber}</span>
                    <span>{ep.durationFormatted}</span>
                  </div>
                  <h3 className="font-serif text-base font-bold text-[#F4EFE6]">
                    <Link
                      href={`/podcast#${ep.slug}`}
                      className="hover:text-[#D4AF37] transition-colors"
                    >
                      {ep.title}
                    </Link>
                  </h3>
                  <p className="text-xs text-slate-300 line-clamp-2">{ep.summary}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono">
                  <span className="text-slate-400">{formatFriendlyDate(ep.publishedAt)}</span>
                  <Link
                    href={`/podcast#${ep.slug}`}
                    className="text-[#D4AF37] hover:underline"
                  >
                    Listen &amp; Read Transcript →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
