"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Scale,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Info,
  BookOpen,
} from "lucide-react";
import {
  formatCraftLedgerEntry,
  formatFriendlySourceName,
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  PublicIncidentDto,
} from "@/lib/dto";
import {
  getFailureModeHref,
  getSreFailureModeSpec,
  getWorkingToolHref,
  getWorkingToolSpec,
} from "@/lib/taxonomy";
import {
  deduplicateSignalAgainstFacts,
  normalizeQuestionSentenceCase,
  sanitizeStringConcatenation,
} from "@/lib/sanitize";
import { IncidentArticle } from "@/lib/types";
import { useTelemetry } from "./TelemetryContext";
import {
  BrassSectionDivider,
  WorkingToolEngraving,
} from "./MasonicEngravings";
import { HeroCornerBrackets } from "./ui/BroadsheetPrimitives";

export function IncidentBriefClient({
  incident: rawIncident,
  relatedIncidents,
}: {
  incident: PublicIncidentDto | IncidentArticle;
  relatedIncidents: Array<PublicIncidentDto | IncidentArticle>;
}) {
  const { openRubricInspector } = useTelemetry();

  const incident = mapDtoToCraftLexicon(rawIncident);

  // Defensive rendering gate: never render incomplete or malformed incident briefs
  if (!isRenderablePublicIncident(incident)) {
    return null;
  }

  const validRelatedIncidents = relatedIncidents
    .map((rel) => mapDtoToCraftLexicon(rel))
    .filter((rel) => isRenderablePublicIncident(rel));

  const primaryToolSpec = getWorkingToolSpec(incident.primaryTool);
  const secondaryToolSpec = getWorkingToolSpec(incident.secondaryTool);
  const failureSpec = getSreFailureModeSpec(incident.sreFailureMode);
  const ledgerEntryLabel = formatCraftLedgerEntry(incident.incidentCode);
  const friendlySourceName = formatFriendlySourceName(incident.sourceFeed);

  // Section I: Strictly 1 concise paragraph of unvarnished factual summary
  const singleFactualParagraph = sanitizeStringConcatenation(
    incident.socraticBrief
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)[0] || incident.executiveSummary
  );

  // Section II: View-boundary deduplication gate ensuring Signal never repeats a sentence from Section I
  const deduplicatedStructuralSignal = deduplicateSignalAgainstFacts(
    [singleFactualParagraph, incident.socraticBrief, incident.executiveSummary],
    incident.proportionalityCheck.structuralSignal,
    incident.primaryTool,
    incident.sreFailureMode,
    incident.secondaryTool
  );

  // Section III: Strictly 2 highest-impact Socratic questions in standard sentence case
  const topTwoQuestions = incident.questions
    .slice(0, 2)
    .map((q) => normalizeQuestionSentenceCase(q, incident.title));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb & Back Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[#8A6D3B]/35 font-mono text-xs">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to The Trestleboard</span>
        </Link>
        <div className="flex items-center gap-3 text-[#94A3B8]/80 text-[11px]">
          <span>{ledgerEntryLabel}</span>
        </div>
      </div>

      {/* Main Two-Column Structural Inspection Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN (4 cols): Fixed Craftsman's Brief / Case Ledger Sidebar (Max 1 Border Depth) */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          <div className="tracing-board-frame p-5 sm:p-6 space-y-4">
            {/* Primary Visual Anchor: Working Tool + Moral Lens + Craft Failure Mode */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059]">
                  THE CRAFTSMAN&apos;S BRIEF
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8]">
                  CASE LEDGER
                </span>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-[#F3EFE6] leading-snug">
                  {incident.primaryTool}
                </h2>
                <p className="font-serif italic text-xs text-[#C5A059] mt-0.5 leading-snug">
                  {primaryToolSpec.moralLens} — {primaryToolSpec.sreEquivalent}
                </p>
              </div>
              <div className="pt-2 border-t border-[#8A6D3B]/30 flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#F59E0B] shrink-0">
                  Craft Failure Mode:
                </span>
                <span className="font-mono text-xs font-semibold text-[#F59E0B] text-right">
                  {failureSpec.craftTitle}
                </span>
              </div>
            </div>

            {/* Primary Working Tool Copperplate Engraving (flat hairline section, no inner border box) */}
            <div className="border-t border-[#8A6D3B]/30 pt-4 flex flex-col items-center">
              <WorkingToolEngraving
                tool={incident.primaryTool}
                className="w-44 h-28"
              />
              <span className="font-mono text-[10px] text-[#94A3B8] mt-1">
                {primaryToolSpec.engravingCaption}
              </span>
            </div>

            {/* Flat Diagnostic Sections Separated by Hairlines (Max 1 Border Depth) */}
            <div className="border-t border-[#8A6D3B]/30 pt-4 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block">
                Primary Working Tool (Moral Axis)
              </span>
              <div className="flex items-center justify-between gap-2 font-mono text-xs text-[#C5A059]">
                <Link
                  href={getWorkingToolHref(incident.primaryTool)}
                  className="hover:underline font-semibold"
                >
                  {incident.primaryTool}
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    openRubricInspector({ tool: incident.primaryTool })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#C5A059] transition-colors cursor-pointer"
                >
                  <Info className="w-3 h-3" />
                  <span>Tool Guide</span>
                </button>
              </div>
            </div>

            <div className="border-t border-[#8A6D3B]/30 pt-4 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block">
                Structural Failure Mode
              </span>
              <div className="flex items-center justify-between gap-2 font-mono text-xs text-[#F59E0B]">
                <Link
                  href={getFailureModeHref(incident.sreFailureMode)}
                  className="hover:underline font-medium"
                >
                  {failureSpec.craftTitle}
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    openRubricInspector({
                      failureMode: incident.sreFailureMode,
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#F59E0B] transition-colors cursor-pointer shrink-0"
                >
                  <Info className="w-3 h-3" />
                  <span>Tool Guide</span>
                </button>
              </div>
              <p className="font-serif text-xs text-[#94A3B8] pt-1 leading-relaxed">
                {failureSpec.summary}
              </p>
            </div>

            <div className="border-t border-[#8A6D3B]/30 pt-4 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block">
                Secondary Working Tool
              </span>
              <div className="flex items-center justify-between gap-2 font-mono text-xs text-[#F3EFE6]">
                <Link
                  href={getWorkingToolHref(incident.secondaryTool)}
                  className="hover:underline"
                >
                  {secondaryToolSpec.numeral}. {incident.secondaryTool}
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    openRubricInspector({ tool: incident.secondaryTool })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#C5A059] transition-colors cursor-pointer"
                >
                  <Info className="w-3 h-3" />
                  <span>Tool Guide</span>
                </button>
              </div>
            </div>

            {/* Lower Colophon: Source, Sector, Published Timestamp & Demoted Ledger ID */}
            <div className="border-t border-[#8A6D3B]/30 pt-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">SOURCE DISPATCH:</span>
                <span className="text-[#F3EFE6] text-right">
                  {incident.sourceFeed}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">DOMAIN SECTOR:</span>
                <span className="text-[#F3EFE6] text-right">
                  {incident.domainSector}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#94A3B8]">PUBLISHED AT:</span>
                <span className="text-[#F3EFE6] text-right">
                  {new Date(incident.publishedAt)
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}{" "}
                  UTC
                </span>
              </div>
              <div className="flex justify-between gap-2 text-[11px] text-[#94A3B8]/75 pt-0.5">
                <span>RECORD ID:</span>
                <span className="text-right">{ledgerEntryLabel}</span>
              </div>
              <div className="pt-3 space-y-2.5">
                <a
                  href={incident.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#C5A059] text-[#0B0E14] font-bold hover:bg-[#d6b36a] transition-colors"
                >
                  <span>Read Original {friendlySourceName} Article</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <div className="text-center">
                  <Link
                    href={`/archive?tool=${encodeURIComponent(
                      primaryToolSpec.slug
                    )}&failure=${encodeURIComponent(failureSpec.slug)}`}
                    className="inline-block text-[11px] text-[#C5A059] hover:text-[#F3EFE6] hover:underline transition-colors"
                  >
                    {incident.primaryTool
                      ? `More '${incident.primaryTool}' Cases →`
                      : "See Similar Cases →"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN (8 cols): Structural Inspection Main Column */}
        <div className="lg:col-span-8 space-y-8">
          {/* Article Title Header (Max 1 Border Depth — no nested boxes inside hero) */}
          <div className="tracing-board-frame relative p-6 sm:p-8 space-y-4">
            <HeroCornerBrackets />
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-[#C5A059]">
              <div className="flex flex-wrap items-center gap-2">
                <span>STRUCTURAL INSPECTION</span>
                <span>•</span>
                <span>{friendlySourceName}</span>
              </div>
              {incident.isPinned && (
                <span className="text-[#C5A059] text-[10px] tracking-widest font-semibold">
                  PINNED DISPATCH
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6] leading-tight">
              {incident.title}
            </h1>

            {incident.titleRewritten && (
              <div className="pt-3.5 border-t border-[#8A6D3B]/30 space-y-1.5 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[#10B981] font-semibold uppercase tracking-wider">
                    Title Neutralized · View Original in Audit Log
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">
                    EPISTEMIC DE-ESCALATION RECORDED
                  </span>
                </div>
                {incident.originalTitle && (
                  <p className="font-serif text-sm text-[#F3EFE6]/85">
                    <span className="font-mono text-[11px] uppercase text-[#94A3B8] mr-1.5">
                      Original Source Headline:
                    </span>
                    <span className="italic">&ldquo;{incident.originalTitle}&rdquo;</span>
                  </p>
                )}
                {incident.titleRewriteReason && (
                  <p className="font-mono text-[11px] text-[#94A3B8]">
                    Rationale: {incident.titleRewriteReason}
                  </p>
                )}
              </div>
            )}

            {incident.imageUrl && incident.imageSourceType !== "none" && (
              <figure className="pt-3 border-t border-[#8A6D3B]/30">
                <div className="overflow-hidden bg-[#0B0E14]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={incident.imageUrl}
                    alt={incident.imageAlt || incident.title}
                    className="w-full max-h-[380px] object-cover"
                  />
                </div>
                {incident.imageCaption && (
                  <figcaption className="mt-2 font-mono text-[11px] text-[#94A3B8] flex items-center justify-between gap-2">
                    <span>{incident.imageCaption}</span>
                    <span className="uppercase text-[10px] text-[#C5A059]/80">
                      [{incident.imageSourceType || "card"}]
                    </span>
                  </figcaption>
                )}
              </figure>
            )}
          </div>

          {/* Section I: What Happened (The Plain Facts) (Strictly 1 concise factual paragraph, Max 1 Border Depth) */}
          <section className="tracing-board-frame p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059] block">
                  I. Plain Facts &amp; Context
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Scale className="w-4 h-4 text-[#C5A059]" />
                  <h2 className="font-display text-xl text-[#F3EFE6] uppercase tracking-wider">
                    I. WHAT HAPPENED (THE PLAIN FACTS)
                  </h2>
                </div>
              </div>
              <span className="font-mono text-[11px] text-[#94A3B8]">
                SOURCED DISPATCH
              </span>
            </div>

            <div className="font-serif text-base sm:text-lg text-[#F3EFE6]/95 leading-relaxed">
              <p>{singleFactualParagraph}</p>
            </div>
          </section>

          {/* Section II: Noise vs. Structural Signal (De-nested hairline-divided columns — Max 1 Border Depth) */}
          <section className="tracing-board-frame p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#8A6D3B]/35 pb-3">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059] block">
                  II. Noise vs. Structural Signal
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Compass className="w-4 h-4 text-[#C5A059]" />
                  <h2 className="font-display text-xl text-[#F3EFE6] uppercase tracking-wider">
                    II. The Diagnostic Lens: {incident.primaryTool} &amp;{" "}
                    {failureSpec.craftTitle}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  openRubricInspector({
                    tool: incident.primaryTool,
                    failureMode: incident.sreFailureMode,
                  })
                }
                className="inline-flex items-center gap-1.5 font-mono text-xs text-[#C5A059] hover:underline cursor-pointer shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>View Tool Guide</span>
              </button>
            </div>

            {/* Proportionality Check: Partisan Heat & Spin vs. The Actual Foundation (Hairline separated, zero nested boxes) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1 divide-y md:divide-y-0 md:divide-x divide-[#8A6D3B]/30">
              <div className="pt-4 first:pt-0 md:pr-6 space-y-2">
                <div className="flex items-center gap-2 font-mono text-xs uppercase text-[#EF4444]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>PARTISAN HEAT &amp; SPIN (THE NOISE)</span>
                </div>
                <p className="font-serif text-base text-[#94A3B8] leading-relaxed">
                  {incident.proportionalityCheck.noiseOverblown}
                </p>
              </div>

              <div className="pt-4 md:pt-0 md:pl-6 space-y-2">
                <div className="flex items-center gap-2 font-mono text-xs uppercase text-[#10B981]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>THE ACTUAL FOUNDATION (THE SIGNAL)</span>
                </div>
                <p className="font-serif text-base text-[#F3EFE6]/95 leading-relaxed">
                  {deduplicatedStructuralSignal}
                </p>
              </div>
            </div>
          </section>

          {/* Section III: Socratic Verification (De-nested from 4 border levels to Max 1 Border Depth, zero // subtitles) */}
          <section className="tracing-board-frame p-6 sm:p-8 space-y-5">
            <div className="border-b border-[#8A6D3B]/35 pb-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059] block">
                III. Socratic Verification
              </span>
              <h2 className="font-display text-2xl text-[#F3EFE6] mt-1">
                Questions for Fair &amp; Consistent Judgment
              </h2>
              <p className="font-serif text-sm text-[#94A3B8] mt-1">
                This review does not propose a partisan verdict. Apply{" "}
                <strong className="text-[#C5A059] font-normal">
                  {incident.primaryTool}
                </strong>{" "}
                and{" "}
                <strong className="text-[#C5A059] font-normal">
                  {incident.secondaryTool}
                </strong>{" "}
                by weighing these diagnostic questions:
              </p>
            </div>

            <ol className="divide-y divide-[#8A6D3B]/30">
              {topTwoQuestions.map((q, index) => (
                <li
                  key={index}
                  className="py-4 first:pt-1 last:pb-0 flex items-baseline gap-4"
                >
                  <span className="font-mono text-sm font-bold text-[#C5A059] shrink-0">
                    Q{index + 1}.
                  </span>
                  <p className="font-serif text-base sm:text-lg text-[#F3EFE6] leading-relaxed normal-case">
                    {q}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {validRelatedIncidents.length > 0 && (
            <>
              <BrassSectionDivider label="RELATED CASES ON THE TRESTLEBOARD" />

              {/* Related Incidents (Single border depth per card) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {validRelatedIncidents.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/incidents/${rel.slug}`}
                    className="tracing-board-frame p-5 hover:border-[#C5A059] transition-colors block"
                  >
                    <div className="flex items-center justify-between font-mono text-xs text-[#C5A059] mb-1.5">
                      <span>{rel.primaryTool}</span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {formatCraftLedgerEntry(rel.incidentCode)}
                      </span>
                    </div>
                    <h3 className="font-serif font-semibold text-base text-[#F3EFE6] leading-snug normal-case line-clamp-2">
                      {rel.title}
                    </h3>
                    <span className="font-mono text-[11px] text-[#94A3B8] mt-2 block">
                      Failure Mode:{" "}
                      {getSreFailureModeSpec(rel.sreFailureMode).craftTitle}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

