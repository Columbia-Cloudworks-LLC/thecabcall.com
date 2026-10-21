"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WorkingToolEngraving } from "./MasonicEngravings";
import {
  HeroCornerBrackets,
  InteractiveCardLink,
  SectionHeader,
} from "./ui/BroadsheetPrimitives";
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

      {/* Hero Masthead (.tracing-board-frame — Max 1 Border Depth) */}
      <section className="tracing-board-frame relative p-6 sm:p-8 lg:p-10">
        <HeroCornerBrackets />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-4 flex flex-col items-center justify-center lg:border-r lg:border-[#8A6D3B]/30 lg:pr-8">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#C5A059] mb-3">
              Axis I · Tool {spec.numeral} of VI
            </div>
            <WorkingToolEngraving
              tool={spec.id}
              className="w-52 h-32"
            />
            <div className="mt-4 text-center">
              <div className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                {spec.engravingCaption}
              </div>
              <div className="text-xs text-[#94A3B8] mt-1">
                {spec.sreEquivalent}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-wider">
              <span className="text-[#C5A059] font-semibold">
                Axis I · Masonic Working Tool {spec.numeral}
              </span>
              <span className="text-[#8A6D3B]">·</span>
              <Link
                href={getFailureModeHref(pairedFailureSpec.id)}
                className="text-[#F59E0B] hover:text-[#C5A059] transition-colors"
              >
                Primary Paired Failure Mode: {pairedFailureSpec.craftShortLabel} →
              </Link>
            </div>

            <div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F3EFE6] tracking-tight">
                {spec.id}
              </h1>
              <p className="text-base sm:text-lg text-[#C5A059] font-serif italic mt-1.5">
                {spec.moralLens} — {spec.sreEquivalent}
              </p>
            </div>

            {/* Core Diagnostic Question (hairline separated, no nested box border) */}
            <div className="py-4 border-y border-[#8A6D3B]/30 space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#C5A059]">
                Core Socratic Diagnostic Question
              </div>
              <p className="font-serif text-lg sm:text-xl text-[#F3EFE6] leading-relaxed">
                &ldquo;{spec.diagnosticQuestionPattern}&rdquo;
              </p>
            </div>

            <p className="font-serif text-sm sm:text-base text-[#F3EFE6]/90 leading-relaxed">
              {spec.sreDefinition}
            </p>

            {/* Primary CTA + Secondary Text Link */}
            <div className="flex flex-wrap items-center gap-5 pt-1">
              <Link
                href={`/archive?tool=${spec.slug}`}
                className="px-4 py-2 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#d6b36a] transition-colors"
              >
                Filter Master Ledger by {spec.shortName} ({initialTelemetry.totalTagged}) →
              </Link>
              <Link
                href={getFailureModeHref(pairedFailureSpec.id)}
                className="font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] hover:underline transition-colors"
              >
                Inspect Paired Failure Hub: {pairedFailureSpec.craftShortLabel} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Cross-Axis Telemetry Bar (Flattened with hairline dividers — Max 1 Border Depth) */}
      <section
        aria-label="Live Cross-Axis Telemetry Breakdown"
        className="tracing-board-frame p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#8A6D3B]/35 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-[#C5A059] block">
              Live Corpus Telemetry · Axis I × Axis II × Axis III
            </span>
            <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
              Operational Incidence &amp; Cross-Axis Distribution
            </h2>
          </div>
          <Link
            href={`/archive?tool=${spec.slug}#matrix`}
            className="text-xs font-mono uppercase tracking-wider text-[#C5A059] hover:underline"
          >
            View in 6×6 Diagnostic Matrix →
          </Link>
        </div>

        {/* 3 Primary Metric Counters (separated by hairlines, zero nested boxes) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x divide-[#8A6D3B]/30 border-b border-[#8A6D3B]/30 pb-6">
          <div className="sm:pr-6">
            <div className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
              Total Tagged Dispatches
            </div>
            <div className="font-display text-3xl font-bold text-[#C5A059] mt-1">
              {initialTelemetry.totalTagged}
            </div>
            <div className="font-serif text-xs text-[#94A3B8] mt-1">
              Active post-incident reviews invoking {spec.id}
            </div>
          </div>

          <div className="sm:px-6">
            <div className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
              Primary Diagnostic Lens
            </div>
            <div className="font-display text-3xl font-bold text-[#F3EFE6] mt-1">
              {initialTelemetry.primaryCount}
            </div>
            <div className="font-serif text-xs text-[#94A3B8] mt-1">
              Dispatches where {spec.shortName} is the dominant Working Tool
            </div>
          </div>

          <div className="sm:pl-6">
            <div className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
              Secondary Corroborating Lens
            </div>
            <div className="font-display text-3xl font-bold text-[#F3EFE6]/85 mt-1">
              {initialTelemetry.secondaryCount}
            </div>
            <div className="font-serif text-xs text-[#94A3B8] mt-1">
              Dispatches where {spec.shortName} serves as secondary corrective check
            </div>
          </div>
        </div>

        {/* Co-Occurring Failure Modes & Axis 3 Sector Distribution (hairline divided, zero nested boxes) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:divide-x lg:divide-[#8A6D3B]/30">
          {/* Co-Occurring SRE Failure Modes */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                Co-Occurring Failure Modes (Axis II)
              </h3>
              <span className="text-[11px] font-mono text-[#94A3B8]">
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
                          className="font-medium text-[#F3EFE6] hover:text-[#C5A059] transition-colors truncate"
                        >
                          {fmSpec.craftShortLabel}
                        </Link>
                        {isPaired && (
                          <span className="text-[10px] font-mono uppercase text-[#C5A059] shrink-0">
                            · Primary Pairing
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/archive?tool=${spec.slug}&failure=${fmSpec.slug}`}
                        className="font-mono text-[#94A3B8] hover:text-[#C5A059] shrink-0 ml-2"
                      >
                        {entry.count} ({entry.percentage}%)
                      </Link>
                    </div>
                    <div className="w-full h-1.5 bg-[#0B0E14] overflow-hidden">
                      <div
                        className="h-full bg-[#C5A059]"
                        style={{ width: `${Math.max(entry.count > 0 ? 6 : 0, entry.percentage)}%` }}
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
                Domain Sector Breakdown (Axis III)
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
                            ? `/archive?tool=${spec.slug}&sector=${secSpec.slug}`
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

      {/* 3-Part Editorial Essay Section (Clean hairline subtitles inside cards — Max 1 Border Depth) */}
      <section
        aria-label="Three-Part Working Tool Editorial Essay"
        className="space-y-6"
      >
        <SectionHeader
          eyebrow="Editorial Monograph · Operative & Systems Architecture"
          title={`The Craft & Systems Lineage of ${spec.id}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Part I: Operative Stonecraft Origin */}
          <article className="tracing-board-frame p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                I. Operative Stonecraft Origin
              </div>
              <h3 className="font-display text-xl text-[#F3EFE6]">
                Physical Geometry in the Lodge Quarry
              </h3>
              <p className="font-serif italic text-sm text-[#C5A059] pb-3 border-b border-[#8A6D3B]/30">
                {spec.moralDefinition}
              </p>
              <div className="space-y-3 font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                {spec.operativeOriginEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-[#8A6D3B]/30 text-xs text-[#94A3B8] italic font-serif">
              Engraving Plate: {spec.engravingCaption}
            </div>
          </article>

          {/* Part II: Moral & Civic Application */}
          <article className="tracing-board-frame p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                II. Moral &amp; Civic Application
              </div>
              <h3 className="font-display text-xl text-[#F3EFE6]">
                Speculative Ethics &amp; Institutional Duty
              </h3>
              <p className="font-serif italic text-sm text-[#C5A059] pb-3 border-b border-[#8A6D3B]/30">
                {spec.moralLens}
              </p>
              <div className="space-y-3 font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                {spec.moralCivicApplicationEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-[#8A6D3B]/30 text-xs text-[#94A3B8] font-serif">
              Diagnostic Focus: {spec.jevClassifierCriteria}
            </div>
          </article>

          {/* Part III: Shop-Floor & Systems Engineering Equivalent */}
          <article className="tracing-board-frame p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-widest text-[#C5A059]">
                III. Shop-Floor &amp; Systems Engineering Equivalent
              </div>
              <h3 className="font-display text-xl text-[#F3EFE6]">
                High-Reliability Production Telemetry
              </h3>
              <p className="font-serif italic text-sm text-[#C5A059] pb-3 border-b border-[#8A6D3B]/30">
                {spec.sreEquivalent}
              </p>
              <div className="space-y-3 font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                {spec.systemsEngineeringEquivalentEssay.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#8A6D3B]/30 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#C5A059]">
                Operational Verification Checklist
              </div>
              <ul className="space-y-1.5 text-xs text-[#F3EFE6]/85 font-serif">
                {spec.operationalPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#C5A059] font-mono">▪</span>
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
        <SectionHeader
          eyebrow={`Verified Case Ledger · ${spec.id}`}
          title={`Post-Incident Dispatches Invoking ${spec.id}`}
          subtitle={`Showing ${startIndex}–${endIndex} of ${matchingIncidents.length} matching dispatches`}
          action={
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => updateUrlParams({ role: "all", page: 1 })}
                className={`px-3 py-1.5 border uppercase tracking-wider transition-colors cursor-pointer ${
                  activeRole === "all"
                    ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                    : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/50 hover:text-[#F3EFE6]"
                }`}
              >
                All ({initialTelemetry.totalTagged})
              </button>
              <button
                type="button"
                onClick={() => updateUrlParams({ role: "primary", page: 1 })}
                className={`px-3 py-1.5 border uppercase tracking-wider transition-colors cursor-pointer ${
                  activeRole === "primary"
                    ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                    : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/50 hover:text-[#F3EFE6]"
                }`}
              >
                Primary Only ({initialTelemetry.primaryCount})
              </button>
              <button
                type="button"
                onClick={() => updateUrlParams({ role: "secondary", page: 1 })}
                className={`px-3 py-1.5 border uppercase tracking-wider transition-colors cursor-pointer ${
                  activeRole === "secondary"
                    ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                    : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/50 hover:text-[#F3EFE6]"
                }`}
              >
                Secondary Only ({initialTelemetry.secondaryCount})
              </button>
            </div>
          }
        />

        {paginatedItems.length === 0 ? (
          <div className="tracing-board-frame p-8 text-center space-y-3">
            <p className="font-serif text-lg text-[#F3EFE6]">
              No dispatches match the selected {activeRole} role filter for {spec.id}.
            </p>
            <button
              type="button"
              onClick={() => updateUrlParams({ role: "all", page: 1 })}
              className="px-4 py-2 bg-[#C5A059] text-[#0B0E14] text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
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
                      <span className="text-[#C5A059]">
                        {isPrimary ? `Primary: ${inc.primaryTool}` : `Secondary: ${inc.secondaryTool}`}
                      </span>
                      <span className="text-[#8A6D3B]">·</span>
                      <Link
                        href={getFailureModeHref(inc.sreFailureMode)}
                        className="text-[#F59E0B] hover:underline transition-colors"
                      >
                        {fmSpec.craftShortLabel}
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
              );
            })}
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
                onClick={() => updateUrlParams({ page: currentPage - 1 })}
                className="px-3 py-1.5 border border-[#8A6D3B]/50 bg-[#0B0E14] text-xs font-mono text-[#F3EFE6] disabled:opacity-40 hover:border-[#C5A059] cursor-pointer"
              >
                ← Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateUrlParams({ page: p })}
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
                onClick={() => updateUrlParams({ page: currentPage + 1 })}
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
            title={`CAB Call Podcast Episodes Featuring ${spec.id}`}
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
