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
} from "lucide-react";
import {
  formatCraftLedgerEntry,
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  PublicIncidentDto,
} from "@/lib/dto";
import {
  getSreFailureModeSpec,
  getWorkingToolSpec,
} from "@/lib/taxonomy";
import {
  normalizeQuestionSentenceCase,
  sanitizeStringConcatenation,
} from "@/lib/sanitize";
import { IncidentArticle } from "@/lib/types";
import { useTelemetry } from "./TelemetryContext";
import {
  BrassSectionDivider,
  WorkingToolEngraving,
} from "./MasonicEngravings";

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

  // Section I: Strictly 1 concise paragraph of unvarnished factual summary
  const singleFactualParagraph = sanitizeStringConcatenation(
    incident.socraticBrief
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)[0] || incident.executiveSummary
  );

  // Section III: Strictly 2 highest-impact Socratic questions in standard sentence case
  const topTwoQuestions = incident.questions
    .slice(0, 2)
    .map(normalizeQuestionSentenceCase);

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
        {/* LEFT COLUMN (4 cols): Fixed Craftsman's Brief / Case Ledger Sidebar */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          <div className="tracing-board-frame p-5 sm:p-6 space-y-5">
            <div className="border-b border-[#8A6D3B]/40 pb-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059]">
                  THE CRAFTSMAN&apos;S BRIEF
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8]">
                  CASE LEDGER
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <h2 className="font-display text-lg font-bold text-[#F3EFE6]">
                  {incident.primaryTool}
                </h2>
                <span className="font-mono text-[11px] text-[#94A3B8]">
                  {incident.domainSector}
                </span>
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8]/70 mt-1">
                {ledgerEntryLabel}
              </div>
            </div>

            {/* Primary Working Tool Copperplate Engraving */}
            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/40 flex flex-col items-center">
              <WorkingToolEngraving
                tool={incident.primaryTool}
                className="w-44 h-28"
              />
              <span className="font-mono text-[10px] text-[#94A3B8] mt-1">
                {primaryToolSpec.engravingCaption}
              </span>
            </div>

            {/* Diagnostic Badges with [?] Inspection Triggers */}
            <div className="space-y-2.5">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block mb-1">
                  Primary Working Tool (Moral Axis):
                </span>
                <div className="flex items-center justify-between bg-[#0B0E14] border border-[#C5A059] px-3 py-2 font-mono text-xs text-[#C5A059]">
                  <Link
                    href={`/knowledge-graph?tool=${encodeURIComponent(
                      incident.primaryTool
                    )}`}
                    className="hover:underline font-semibold"
                  >
                    {incident.primaryTool}
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      openRubricInspector({ tool: incident.primaryTool })
                    }
                    className="px-1.5 py-0.5 bg-[#C5A059]/15 text-[#F3EFE6] hover:bg-[#C5A059] hover:text-[#0B0E14] transition-colors cursor-pointer"
                  >
                    Inspect [?]
                  </button>
                </div>
                <p className="font-serif text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                  {primaryToolSpec.moralLens} — {primaryToolSpec.sreEquivalent}
                </p>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block mb-1">
                  Secondary Working Tool:
                </span>
                <div className="flex items-center justify-between bg-[#0B0E14] border border-[#8A6D3B]/60 px-3 py-2 font-mono text-xs text-[#F3EFE6]">
                  <Link
                    href={`/knowledge-graph?tool=${encodeURIComponent(
                      incident.secondaryTool
                    )}`}
                    className="hover:underline"
                  >
                    {secondaryToolSpec.numeral}. {incident.secondaryTool}
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      openRubricInspector({ tool: incident.secondaryTool })
                    }
                    className="px-1.5 py-0.5 bg-[#8A6D3B]/20 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0B0E14] transition-colors cursor-pointer"
                  >
                    [?]
                  </button>
                </div>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block mb-1">
                  Structural Failure Mode:
                </span>
                <div className="flex items-center justify-between bg-[#0B0E14] border border-[#F59E0B]/60 px-3 py-2 font-mono text-xs text-[#F59E0B]">
                  <Link
                    href={`/knowledge-graph?failure=${encodeURIComponent(
                      incident.sreFailureMode
                    )}`}
                    className="hover:underline"
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
                    className="px-1.5 py-0.5 bg-[#F59E0B]/15 text-[#F3EFE6] hover:bg-[#F59E0B] hover:text-[#0B0E14] transition-colors cursor-pointer"
                  >
                    [?]
                  </button>
                </div>
                <p className="font-serif text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                  {failureSpec.summary}
                </p>
              </div>
            </div>

            {/* Source & Published Metadata */}
            <div className="pt-3 border-t border-[#8A6D3B]/35 space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">SOURCE DISPATCH:</span>
                <span className="text-[#F3EFE6]">{incident.sourceFeed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">PUBLISHED AT:</span>
                <span className="text-[#F3EFE6]">
                  {new Date(incident.publishedAt)
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}{" "}
                  UTC
                </span>
              </div>
              <div className="pt-2 space-y-2">
                <a
                  href={incident.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#0B0E14] border border-[#C5A059]/60 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0B0E14] transition-colors"
                >
                  <span>Inspect Primary Source Dispatch</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Link
                  href={`/knowledge-graph?tool=${encodeURIComponent(
                    incident.primaryTool
                  )}&failure=${encodeURIComponent(incident.sreFailureMode)}`}
                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-[#8A6D3B]/50 text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
                >
                  Cross-Filter Diagnostic Signature →
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN (8 cols): Structural Inspection Main Column */}
        <div className="lg:col-span-8 space-y-8">
          {/* Article Title Header (flows directly into Section I without introductory blockquote) */}
          <div className="tracing-board-frame p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-[#C5A059]">
              <div className="flex flex-wrap items-center gap-2">
                <span>STRUCTURAL INSPECTION</span>
                <span>•</span>
                <span>{incident.sourceFeed}</span>
                <span>•</span>
                <span>SECONDARY TOOL: {incident.secondaryTool.toUpperCase()}</span>
              </div>
              {incident.isPinned && (
                <span className="px-2 py-0.5 bg-[#C5A059]/15 border border-[#C5A059]/60 text-[#C5A059] text-[10px] tracking-widest">
                  PINNED DISPATCH
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6] leading-tight">
              {incident.title}
            </h1>

            {incident.titleRewritten && (
              <div className="p-3.5 bg-[#0B0E14] border border-[#10B981]/50 space-y-1.5 font-mono text-xs">
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
              <figure className="pt-2">
                <div className="overflow-hidden border border-[#8A6D3B]/50 bg-[#0B0E14]">
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

          {/* Section I: What Happened (The Plain Facts) (Strictly 1 concise factual paragraph) */}
          <section className="bg-[#111726] border border-[#8A6D3B]/45 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#C5A059]" />
                <h2 className="font-display text-xl text-[#F3EFE6] uppercase tracking-wider">
                  I. WHAT HAPPENED (THE PLAIN FACTS)
                </h2>
              </div>
              <span className="font-mono text-[11px] text-[#94A3B8]">
                SOURCED DISPATCH
              </span>
            </div>

            <div className="font-serif text-base sm:text-[17px] text-[#F3EFE6]/90 leading-relaxed">
              <p>{singleFactualParagraph}</p>
            </div>
          </section>

          {/* Section II: The Diagnostic Lens (Opens directly with Red/Green contrast cards + footer box) */}
          <section className="bg-[#111726] border border-[#8A6D3B]/45 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#C5A059]" />
                <h2 className="font-display text-xl text-[#F3EFE6] uppercase tracking-wider">
                  II. The Diagnostic Lens: {incident.primaryTool} &amp;{" "}
                  {failureSpec.craftTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  openRubricInspector({
                    tool: incident.primaryTool,
                    failureMode: incident.sreFailureMode,
                  })
                }
                className="font-mono text-xs text-[#C5A059] hover:underline cursor-pointer"
              >
                Open Rubric Codex [?]
              </button>
            </div>

            {/* Proportionality Check: Partisan Heat & Spin vs. The Actual Foundation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#0B0E14] border border-[#EF4444]/40">
                <div className="flex items-center gap-2 font-mono text-xs uppercase text-[#EF4444] mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>PARTISAN HEAT &amp; SPIN (THE NOISE)</span>
                </div>
                <p className="font-serif text-sm sm:text-[15px] text-[#94A3B8] leading-relaxed">
                  {incident.proportionalityCheck.noiseOverblown}
                </p>
              </div>

              <div className="p-4 bg-[#0B0E14] border border-[#10B981]/45">
                <div className="flex items-center gap-2 font-mono text-xs uppercase text-[#10B981] mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>THE ACTUAL FOUNDATION (THE SIGNAL)</span>
                </div>
                <p className="font-serif text-sm sm:text-[15px] text-[#F3EFE6]/90 leading-relaxed">
                  {incident.proportionalityCheck.structuralSignal}
                </p>
              </div>
            </div>
          </section>

          {/* Section III: The Trestleboard Inquiry (2 Highest-Impact Questions in Standard Sentence Case) */}
          <section className="relative bg-[#0B0E14] border-2 border-[#C5A059] p-6 sm:p-8 shadow-[0_0_45px_rgba(197,160,89,0.12)]">
            <div className="pointer-events-none absolute inset-2 border border-[#8A6D3B]/60" />

            <div className="relative z-10 space-y-5">
              <div className="border-b border-[#C5A059]/40 pb-4">
                <span className="font-mono text-xs uppercase tracking-[0.22em] text-[#C5A059]">
                  III. THE TRESTLEBOARD INQUIRY // SOCRATIC VERIFICATION
                </span>
                <h2 className="font-display text-2xl text-[#F3EFE6] mt-1">
                  Questions for Fair &amp; Consistent Judgment
                </h2>
                <p className="font-mono text-xs text-[#94A3B8] mt-1">
                  This review does not propose a partisan verdict. Apply{" "}
                  <strong className="text-[#C5A059]">
                    {incident.primaryTool}
                  </strong>{" "}
                  and{" "}
                  <strong className="text-[#C5A059]">
                    {incident.secondaryTool}
                  </strong>{" "}
                  by weighing these diagnostic questions:
                </p>
              </div>

              <ol className="space-y-4">
                {topTwoQuestions.map((q, index) => (
                  <li
                    key={index}
                    className="p-4 bg-[#111726] border border-[#8A6D3B]/50 flex items-start gap-4"
                  >
                    <span className="font-mono text-sm font-bold px-2.5 py-1 bg-[#0B0E14] border border-[#C5A059] text-[#C5A059] shrink-0">
                      Q{index + 1}
                    </span>
                    <p className="font-serif text-base sm:text-lg text-[#F3EFE6] leading-relaxed normal-case">
                      {q}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {validRelatedIncidents.length > 0 && (
            <>
              <BrassSectionDivider label="RELATED CASES ON THE TRESTLEBOARD" />

              {/* Related Incidents */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {validRelatedIncidents.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/incidents/${rel.slug}`}
                    className="p-4 bg-[#111726] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-colors block"
                  >
                    <div className="flex items-center justify-between font-mono text-xs text-[#C5A059] mb-1">
                      <span>{rel.primaryTool}</span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {formatCraftLedgerEntry(rel.incidentCode)}
                      </span>
                    </div>
                    <h3 className="font-display text-base text-[#F3EFE6] line-clamp-2">
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

