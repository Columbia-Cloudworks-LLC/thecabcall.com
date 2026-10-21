"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FailureModeEngraving } from "./MasonicEngravings";
import {
  HeroCornerBrackets,
  InteractiveCardLink,
  SectionHeader,
} from "./ui/BroadsheetPrimitives";
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

      {/* Hero Masthead (.tracing-board-frame — Max 1 Border Depth) */}
      <section className="tracing-board-frame relative p-6 sm:p-8 lg:p-10">
        <HeroCornerBrackets />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-4 flex flex-col items-center justify-center lg:border-r lg:border-[#8A6D3B]/30 lg:pr-8">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#C5A059] mb-3">
              Axis II · Structural Fault Schematic
            </div>
            <FailureModeEngraving
              failureMode={spec.id}
              size={148}
              className="w-52 h-32"
            />
            <div className="mt-4 text-center space-y-1">
              <div className="text-xs font-mono uppercase tracking-widest text-[#F59E0B]">
                {spec.engravingCaption}
              </div>
              <div className="text-xs text-[#94A3B8]">
                Formal SRE Classification: {spec.id}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-wider">
              <span className="text-[#F59E0B] font-semibold">
                Axis II · Structural Failure Mode
              </span>
              <span className="text-[#8A6D3B]">·</span>
              <span className="text-[#94A3B8]">
                Severity Posture: {spec.severity.toUpperCase()}
              </span>
              <span className="text-[#8A6D3B]">·</span>
              <Link
                href={getWorkingToolHref(pairedToolSpec.id)}
                className="text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
              >
                Primary Corrective Tool: {pairedToolSpec.id} →
              </Link>
            </div>

            <div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F3EFE6] tracking-tight">
                {spec.craftTitle}
              </h1>
              <p className="text-sm sm:text-base text-[#C5A059] font-mono uppercase tracking-wider mt-2">
                Formal SRE Classification: {spec.id}
              </p>
            </div>

            <p className="font-serif text-sm sm:text-base text-[#F3EFE6]/90 leading-relaxed">
              {spec.summary}
            </p>

            {/* Corrective Remediation Pattern (hairline separated, no nested box border) */}
            <div className="py-4 border-y border-[#8A6D3B]/30 space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#C5A059]">
                Primary Corrective Lens ({pairedToolSpec.id})
              </div>
              <p className="font-serif text-sm sm:text-base text-[#F3EFE6] leading-relaxed">
                &ldquo;{pairedToolSpec.diagnosticQuestionPattern}&rdquo; — {pairedToolSpec.sreDefinition}
              </p>
            </div>

            {/* Primary CTA + Secondary Text Link */}
            <div className="flex flex-wrap items-center gap-5 pt-1">
              <Link
                href={`/archive?failure=${spec.slug}`}
                className="px-4 py-2 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#d6b36a] transition-colors"
              >
                Filter Master Ledger by {spec.craftShortLabel} ({initialTelemetry.totalTagged}) →
              </Link>
              <Link
                href={getWorkingToolHref(pairedToolSpec.id)}
                className="font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] hover:underline transition-colors"
              >
                Inspect Paired Working Tool: {pairedToolSpec.id} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Cross-Axis Telemetry Breakdown (Flattened with hairline dividers — Max 1 Border Depth) */}
      <section
        aria-label="Live Cross-Axis Telemetry Breakdown"
        className="tracing-board-frame p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#8A6D3B]/35 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#C5A059] block">
              Live Corpus Telemetry · Axis II × Axis I × Axis III
            </span>
            <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
              Intersecting Working Tools &amp; Sector Footprint ({initialTelemetry.totalTagged} Verified Dispatches)
            </h2>
          </div>
          <Link
            href={`/archive?failure=${spec.slug}#matrix`}
            className="text-xs font-mono uppercase tracking-wider text-[#C5A059] hover:underline"
          >
            View in 6×6 Diagnostic Matrix →
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:divide-x lg:divide-[#8A6D3B]/30">
          {/* Intersecting Working Tools (Axis I) */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                Intersecting Working Tools (Axis I)
              </h3>
              <span className="text-[11px] font-mono text-[#94A3B8]">
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
                          className="font-medium text-[#F3EFE6] hover:text-[#C5A059] transition-colors truncate"
                        >
                          {toolSpec.id}
                        </Link>
                        {isPaired && (
                          <span className="text-[10px] font-mono uppercase text-[#C5A059] shrink-0">
                            · Primary Corrective Tool
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/archive?tool=${toolSpec.slug}&failure=${spec.slug}`}
                        className="font-mono text-[#94A3B8] hover:text-[#C5A059] shrink-0 ml-2"
                      >
                        {entry.totalCount} ({entry.primaryCount}P / {entry.secondaryCount}S)
                      </Link>
                    </div>
                    <div className="w-full h-1.5 bg-[#0B0E14] overflow-hidden">
                      <div
                        className="h-full bg-[#C5A059]"
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
          <div className="lg:pl-8 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                Domain Sector Footprint (Axis III)
              </h3>
              <span className="text-[11px] font-mono text-[#94A3B8]">
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
                        className="font-medium text-[#F3EFE6] hover:text-[#C5A059] transition-colors"
                      >
                        {entry.sector}
                      </Link>
                      <span className="font-mono text-[#94A3B8]">
                        {entry.count} ({entry.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#0B0E14] overflow-hidden">
                      <div
                        className="h-full bg-[#F59E0B]/80"
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

      {/* 3-Part Deep-Dive Mechanics Essay (Clean hairline subtitles inside cards — Max 1 Border Depth) */}
      <section
        aria-label="Three-Part Failure Mode Mechanics Essay"
        className="space-y-6"
      >
        <SectionHeader
          eyebrow={`Post-Incident Architecture Monograph · ${spec.id}`}
          title="Failure Mechanics & Institutional Anatomy"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Part I: Shop-Floor & Distributed Systems Mechanics */}
          <article className="tracing-board-frame p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                I. Shop-Floor &amp; Distributed Systems Mechanics
              </div>
              <h3 className="font-display text-xl text-[#F3EFE6]">
                Physical &amp; Production Fault Physics
              </h3>
              <p className="font-serif italic text-sm text-[#C5A059] pb-3 border-b border-[#8A6D3B]/30">
                {spec.systemsDefinition}
              </p>
              <div className="space-y-3 font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                {spec.shopFloorMechanicsEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-[#8A6D3B]/30 text-xs text-[#94A3B8] font-serif">
              Primary Diagnostic Instrument: {pairedToolSpec.id}
            </div>
          </article>

          {/* Part II: Civic & Institutional Manifestation */}
          <article className="tracing-board-frame p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                II. Civic &amp; Institutional Manifestation
              </div>
              <h3 className="font-display text-xl text-[#F3EFE6]">
                Public Governance &amp; Market Propagation
              </h3>
              <p className="font-serif italic text-sm text-[#C5A059] pb-3 border-b border-[#8A6D3B]/30">
                {spec.civicManifestation}
              </p>
              <div className="space-y-3 font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                {spec.civicInstitutionalEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-[#8A6D3B]/30 text-xs text-[#94A3B8] font-serif">
              Observed across all five Axis III Civic &amp; Industrial Sectors.
            </div>
          </article>

          {/* Part III: Early Warning Telemetry Signals */}
          <article className="tracing-board-frame p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                III. Early Warning Telemetry Signals
              </div>
              <h3 className="font-display text-xl text-[#F3EFE6]">
                Pre-Outage Indicators &amp; Remediation
              </h3>
              <p className="font-serif italic text-sm text-[#C5A059] pb-3 border-b border-[#8A6D3B]/30">
                Paired Tool: {pairedToolSpec.id} — {pairedToolSpec.sreEquivalent}
              </p>
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#C5A059]">
                  Leading Indicators Before Incident Escalation
                </div>
                <ul className="space-y-2 text-xs text-[#F3EFE6]/85 font-serif">
                  {spec.earlyWarningSignals.map((signal, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-[#C5A059] font-mono">▪</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-[#8A6D3B]/30">
              <Link
                href={getWorkingToolHref(pairedToolSpec.id)}
                className="text-xs font-mono uppercase tracking-wider text-[#C5A059] hover:underline"
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
        <SectionHeader
          eyebrow={`Verified Case Ledger · ${spec.craftShortLabel}`}
          title={`Post-Incident Dispatches Exhibiting ${spec.craftShortLabel}`}
          subtitle={`Showing ${startIndex}–${endIndex} of ${matchingIncidents.length} matching dispatches`}
          action={
            <Link
              href={`/archive?failure=${spec.slug}`}
              className="text-xs font-mono uppercase tracking-wider text-[#C5A059] hover:underline"
            >
              Open in Full Archive Ledger →
            </Link>
          }
        />

        {paginatedItems.length === 0 ? (
          <div className="tracing-board-frame p-8 text-center">
            <p className="font-serif text-lg text-[#F3EFE6]">
              No verified dispatches are currently indexed under {spec.id}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paginatedItems.map((inc) => (
              <article
                key={inc.id}
                className="tracing-board-frame p-5 flex flex-col justify-between gap-4 hover:border-[#C5A059] transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-[#C5A059] font-semibold">
                        {formatCompactCaseId(inc.incidentCode, inc.id)}
                      </span>
                      <span className="text-[#8A6D3B]">·</span>
                      <span className="text-[#F3EFE6]">
                        {formatFriendlySourceName(inc.sourceFeed)}
                      </span>
                    </div>
                    <span className="text-[#94A3B8]">
                      {formatFriendlyDate(inc.publishedAt)}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-[#F3EFE6] leading-snug">
                    <Link
                      href={`/incidents/${inc.slug}`}
                      className="hover:text-[#C5A059] transition-colors"
                    >
                      {inc.title}
                    </Link>
                  </h3>

                  <p className="font-serif text-xs sm:text-sm text-[#94A3B8] line-clamp-3 leading-relaxed">
                    {inc.executiveSummary}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#8A6D3B]/30 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <Link
                      href={getWorkingToolHref(inc.primaryTool)}
                      className="text-[#C5A059] hover:underline transition-colors"
                    >
                      1° {inc.primaryTool}
                    </Link>
                    <span className="text-[#8A6D3B]">·</span>
                    <Link
                      href={getWorkingToolHref(inc.secondaryTool)}
                      className="text-[#94A3B8] hover:text-[#C5A059] transition-colors"
                    >
                      2° {inc.secondaryTool}
                    </Link>
                  </div>

                  <Link
                    href={`/incidents/${inc.slug}`}
                    className="text-xs font-mono uppercase tracking-wider text-[#C5A059] hover:underline"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#8A6D3B]/30">
            <div className="text-xs font-mono text-[#94A3B8]">
              Page {currentPage} of {totalPages} ({matchingIncidents.length} total dispatches)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => updatePageParam(currentPage - 1)}
                className="px-3 py-1.5 border border-[#8A6D3B]/50 bg-[#0B0E14] text-xs font-mono text-[#F3EFE6] disabled:opacity-40 hover:border-[#C5A059] cursor-pointer"
              >
                ← Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updatePageParam(p)}
                  className={`px-3 py-1.5 border text-xs font-mono cursor-pointer ${
                    p === currentPage
                      ? "border-[#C5A059] bg-[#C5A059] text-[#0B0E14] font-bold"
                      : "border-[#8A6D3B]/40 bg-[#0B0E14] text-[#94A3B8] hover:border-[#C5A059]/60"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => updatePageParam(currentPage + 1)}
                className="px-3 py-1.5 border border-[#8A6D3B]/50 bg-[#0B0E14] text-xs font-mono text-[#F3EFE6] disabled:opacity-40 hover:border-[#C5A059] cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Related CAB Call Podcast Episodes (Un-boxed outer section so episode cards sit at single border depth) */}
      {relatedEpisodes.length > 0 && (
        <section
          aria-label="Related CAB Call Podcast Episodes"
          className="space-y-5"
        >
          <SectionHeader
            eyebrow="Audio Rollup Synthesis"
            title={`CAB Call Podcast Episodes Analyzing ${spec.craftShortLabel}`}
            action={
              <Link
                href="/podcast"
                className="text-xs font-mono uppercase tracking-wider text-[#C5A059] hover:underline"
              >
                All Podcast Episodes →
              </Link>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {relatedEpisodes.slice(0, 4).map((ep) => (
              <InteractiveCardLink
                key={ep.id}
                href={`/podcast#${ep.slug}`}
                eyebrow={`Episode #${ep.episodeNumber}`}
                badge={`${ep.durationFormatted} · ${formatFriendlyDate(ep.publishedAt)}`}
                title={ep.title}
                subtitle={ep.summary}
                ctaLabel="Listen & Read Transcript"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
