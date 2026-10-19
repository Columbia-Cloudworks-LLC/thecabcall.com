"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FailureModeEngraving } from "./MasonicEngravings";
import { PublicEpisodeDto, PublicIncidentDto } from "@/lib/dto";
import { FailureModeHubAggregationResult } from "@/lib/archive-pagination";
import {
  DOMAIN_SECTOR_SPECS,
  formatCompactCaseId,
  formatFriendlyDate,
  formatFriendlySourceName,
  getDomainSectorHref,
  getFailureModeHref,
  getWorkingToolHref,
  getWorkingToolSpec,
  SRE_FAILURE_MODES,
  SreFailureModeSpec,
} from "@/lib/taxonomy";

interface FailureModeHubClientProps {
  spec: SreFailureModeSpec;
  corpus: PublicIncidentDto[];
  initialTelemetry: FailureModeHubAggregationResult;
  relatedEpisodes: PublicEpisodeDto[];
}

const HUB_PAGE_SIZE = 12;

export function FailureModeHubClient({
  spec,
  corpus,
  initialTelemetry,
  relatedEpisodes,
}: FailureModeHubClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const requestedPage = Math.max(1, Number.isNaN(pageParam) ? 1 : pageParam);

  const currentModeIndex = SRE_FAILURE_MODES.findIndex((m) => m.id === spec.id);
  const prevMode =
    SRE_FAILURE_MODES[
      (currentModeIndex - 1 + SRE_FAILURE_MODES.length) % SRE_FAILURE_MODES.length
    ];
  const nextMode =
    SRE_FAILURE_MODES[(currentModeIndex + 1) % SRE_FAILURE_MODES.length];

  const pairedToolSpec = useMemo(
    () => getWorkingToolSpec(spec.defaultPairedTool),
    [spec.defaultPairedTool]
  );

  const matchingIncidents = useMemo(
    () => corpus.filter((inc) => inc.sreFailureMode === spec.id),
    [corpus, spec.id]
  );

  const totalPages = Math.max(1, Math.ceil(matchingIncidents.length / HUB_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageOffset = (currentPage - 1) * HUB_PAGE_SIZE;
  const paginatedItems = matchingIncidents.slice(pageOffset, pageOffset + HUB_PAGE_SIZE);
  const startIndex = matchingIncidents.length === 0 ? 0 : pageOffset + 1;
  const endIndex =
    matchingIncidents.length === 0
      ? 0
      : Math.min(matchingIncidents.length, pageOffset + paginatedItems.length);

  const updatePageParam = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
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
      {/* Top Breadcrumb & Prev/Next Failure Mode Bar */}
      <nav
        aria-label="Failure Mode Breadcrumb & Navigation"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
          <Link href="/rubric" className="hover:text-[#D4AF37] transition-colors">
            The Working Tools &amp; Rubric
          </Link>
          <span className="text-slate-600">→</span>
          <Link href="/rubric#axis-2" className="hover:text-[#D4AF37] transition-colors">
            Axis II: Failure Modes
          </Link>
          <span className="text-slate-600">→</span>
          <span className="text-[#D4AF37] font-semibold">{spec.craftShortLabel}</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <Link
            href={getFailureModeHref(prevMode.id)}
            className="px-2.5 py-1 rounded border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-colors"
            title={`Previous Failure Mode: ${prevMode.craftShortLabel}`}
          >
            ← {prevMode.craftShortLabel}
          </Link>
          <Link
            href="/rubric"
            className="px-2.5 py-1 rounded border border-slate-800 bg-slate-950/80 text-slate-400 hover:text-[#F4EFE6] transition-colors"
          >
            Codex Index
          </Link>
          <Link
            href={getFailureModeHref(nextMode.id)}
            className="px-2.5 py-1 rounded border border-slate-800 bg-slate-900/60 text-slate-300 hover:border-[#D4AF37]/50 hover:text-[#D4AF37] transition-colors"
            title={`Next Failure Mode: ${nextMode.craftShortLabel}`}
          >
            {nextMode.craftShortLabel} →
          </Link>
        </div>
      </nav>

      {/* Hero Masthead (.tracing-board-frame) */}
      <section className="tracing-board-frame rounded-lg bg-[#111827]/95 p-6 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-lg border border-amber-500/30 bg-slate-950/90 relative overflow-hidden">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]/80 mb-3">
              Axis II · Structural Fault Schematic
            </div>
            <FailureModeEngraving
              failureMode={spec.id}
              size={148}
              className="border-amber-500/40 bg-slate-950/90 p-3 shadow-inner"
            />
            <div className="mt-4 text-center space-y-1">
              <div className="text-xs font-mono uppercase tracking-widest text-amber-300">
                {spec.engravingCaption}
              </div>
              <div className="text-xs text-slate-400">
                Formal SRE Classification: {spec.id}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-1 rounded text-xs font-mono uppercase tracking-widest bg-amber-950/60 text-amber-200 border border-amber-500/40 font-semibold">
                Axis II · Structural Failure Mode
              </span>
              <span className="px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-700">
                Severity Posture: {spec.severity.toUpperCase()}
              </span>
              <Link
                href={getWorkingToolHref(pairedToolSpec.id)}
                className="px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/25 transition-colors"
              >
                Primary Corrective Tool: {pairedToolSpec.id} →
              </Link>
            </div>

            <div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F4EFE6] tracking-tight">
                {spec.craftTitle}
              </h1>
              <p className="text-base sm:text-lg text-[#D4AF37] font-mono uppercase tracking-wider mt-2">
                Formal SRE Classification: {spec.id}
              </p>
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {spec.summary}
            </p>

            {/* Corrective Remediation Pattern Callout */}
            <div className="p-4 sm:p-5 rounded-md border-l-4 border-[#D4AF37] bg-slate-950/85 space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#D4AF37]">
                Primary Corrective Lens ({pairedToolSpec.id})
              </div>
              <p className="text-sm text-[#F4EFE6] leading-relaxed">
                &ldquo;{pairedToolSpec.diagnosticQuestionPattern}&rdquo; — {pairedToolSpec.sreDefinition}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={`/archive?failure=${spec.slug}`}
                className="px-4 py-2 rounded bg-[#D4AF37] text-slate-950 font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#e3be42] transition-colors"
              >
                Filter Master Ledger by {spec.craftShortLabel} ({initialTelemetry.totalTagged}) →
              </Link>
              <Link
                href={getWorkingToolHref(pairedToolSpec.id)}
                className="px-4 py-2 rounded border border-slate-700 bg-slate-900/80 text-slate-200 hover:border-[#D4AF37]/60 hover:text-[#D4AF37] font-mono text-xs uppercase tracking-wider transition-colors"
              >
                Inspect Paired Working Tool: {pairedToolSpec.id}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Cross-Axis Telemetry Breakdown */}
      <section
        aria-label="Live Cross-Axis Telemetry Breakdown"
        className="rounded-lg border border-slate-800 bg-[#111827]/85 p-6 sm:p-7 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37] block">
              Live Corpus Telemetry · Axis II × Axis I × Axis III
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#F4EFE6] mt-0.5">
              Intersecting Working Tools &amp; Sector Footprint ({initialTelemetry.totalTagged} Verified Dispatches)
            </h2>
          </div>
          <Link
            href={`/archive?failure=${spec.slug}#matrix`}
            className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:underline"
          >
            View in 6×6 Diagnostic Matrix →
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Intersecting Working Tools (Axis I) */}
          <div className="p-5 rounded border border-slate-800/90 bg-slate-950/60 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                Intersecting Working Tools (Axis I)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Primary + Secondary Invocations
              </span>
            </div>
            <div className="space-y-3">
              {initialTelemetry.intersectingTools.map((entry) => {
                const toolSpec = getWorkingToolSpec(entry.tool);
                const isPaired = entry.tool === spec.defaultPairedTool;
                return (
                  <div key={entry.tool} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={getWorkingToolHref(entry.tool)}
                          className="font-medium text-[#F4EFE6] hover:text-[#D4AF37] transition-colors truncate"
                        >
                          {toolSpec.id}
                        </Link>
                        {isPaired && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 shrink-0">
                            Primary Corrective Tool
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/archive?tool=${toolSpec.slug}&failure=${spec.slug}`}
                        className="font-mono text-slate-300 hover:text-[#D4AF37] shrink-0 ml-2"
                      >
                        {entry.totalCount} ({entry.primaryCount}P / {entry.secondaryCount}S)
                      </Link>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D4AF37]/70 to-[#D4AF37]"
                        style={{
                          width: `${Math.max(entry.totalCount > 0 ? 6 : 0, entry.percentage)}%`,
                        }}
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
                Domain Sector Footprint (Axis III)
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
                            ? `/archive?failure=${spec.slug}&sector=${secSpec.slug}`
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

      {/* 3-Part Deep-Dive Mechanics Essay */}
      <section
        aria-label="Three-Part Failure Mode Mechanics Essay"
        className="space-y-6"
      >
        <div className="border-b border-slate-800 pb-3">
          <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37] block">
            Post-Incident Architecture Monograph · {spec.id}
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#F4EFE6] mt-1">
            Failure Mechanics &amp; Institutional Anatomy
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Part I: Shop-Floor & Distributed Systems Mechanics */}
          <article className="rounded-lg border border-slate-800 bg-[#111827]/90 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                I. Shop-Floor &amp; Distributed Systems Mechanics
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F4EFE6]">
                Physical &amp; Production Fault Physics
              </h3>
              <p className="text-xs font-mono text-amber-200/90 bg-amber-950/30 border border-amber-500/20 rounded px-3 py-2">
                {spec.systemsDefinition}
              </p>
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                {spec.shopFloorMechanicsEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400">
              Primary Diagnostic Instrument: {pairedToolSpec.id}
            </div>
          </article>

          {/* Part II: Civic & Institutional Manifestation */}
          <article className="rounded-lg border border-slate-800 bg-[#111827]/90 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                II. Civic &amp; Institutional Manifestation
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F4EFE6]">
                Public Governance &amp; Market Propagation
              </h3>
              <p className="text-xs font-mono text-amber-200/90 bg-amber-950/30 border border-amber-500/20 rounded px-3 py-2">
                {spec.civicManifestation}
              </p>
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                {spec.civicInstitutionalEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400">
              Observed across all five Axis III Civic &amp; Industrial Sectors.
            </div>
          </article>

          {/* Part III: Early Warning Telemetry Signals */}
          <article className="rounded-lg border border-[#D4AF37]/35 bg-[#111827]/95 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
                III. Early Warning Telemetry Signals
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F4EFE6]">
                Pre-Outage Indicators &amp; Remediation
              </h3>
              <p className="text-xs font-mono text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded px-3 py-2">
                Paired Tool: {pairedToolSpec.id} — {pairedToolSpec.sreEquivalent}
              </p>
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#D4AF37]">
                  Leading Indicators Before Incident Escalation
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  {spec.earlyWarningSignals.map((signal, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-[#D4AF37] font-mono">▪</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80">
              <Link
                href={getWorkingToolHref(pairedToolSpec.id)}
                className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:underline"
              >
                Apply {pairedToolSpec.id} Remediation →
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* Paginated Dispatch Ledger for this Failure Mode */}
      <section
        id="dispatches"
        aria-label={`Dispatches Tagged with ${spec.id}`}
        className="space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37] block">
              Verified Case Ledger · {spec.craftShortLabel}
            </span>
            <h2 className="font-serif text-2xl font-bold text-[#F4EFE6] mt-0.5">
              Post-Incident Dispatches Exhibiting {spec.craftShortLabel}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Showing {startIndex}–{endIndex} of {matchingIncidents.length} matching dispatches
            </p>
          </div>

          <Link
            href={`/archive?failure=${spec.slug}`}
            className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] hover:underline"
          >
            Open in Full Archive Ledger →
          </Link>
        </div>

        {paginatedItems.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-8 text-center">
            <p className="font-serif text-lg text-slate-300">
              No verified dispatches are currently indexed under {spec.id}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paginatedItems.map((inc) => (
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
                    <Link
                      href={getWorkingToolHref(inc.primaryTool)}
                      className="px-2 py-0.5 rounded border border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37] hover:bg-[#D4AF37]/25 transition-colors"
                    >
                      1° {inc.primaryTool}
                    </Link>
                    <Link
                      href={getWorkingToolHref(inc.secondaryTool)}
                      className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300 hover:border-[#D4AF37]/50 transition-colors"
                    >
                      2° {inc.secondaryTool}
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
            ))}
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
                onClick={() => updatePageParam(currentPage - 1)}
                className="px-3 py-1.5 rounded border border-slate-800 bg-slate-900/80 text-xs font-mono text-slate-200 disabled:opacity-40 hover:border-[#D4AF37]/50 cursor-pointer"
              >
                ← Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updatePageParam(p)}
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
                onClick={() => updatePageParam(currentPage + 1)}
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
                CAB Call Podcast Episodes Analyzing {spec.craftShortLabel}
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
