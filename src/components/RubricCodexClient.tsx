"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  DOMAIN_SECTOR_SPECS,
  DomainSectorId,
  getDomainSectorHref,
  getFailureModeHref,
  getSreFailureModeSpec,
  getWorkingToolHref,
  SRE_FAILURE_MODES,
  SreFailureModeId,
  WORKING_TOOLS,
  WorkingToolId,
} from "@/lib/taxonomy";
import {
  FailureModeEngraving,
  WorkingToolEngraving,
} from "./MasonicEngravings";
import {
  HeroCornerBrackets,
  SectionHeader,
} from "./ui/BroadsheetPrimitives";

export interface RubricCodexCounts {
  toolCounts?: Partial<Record<WorkingToolId, number>>;
  failureCounts?: Partial<Record<SreFailureModeId, number>>;
  sectorCounts?: Partial<Record<DomainSectorId, number>>;
}

const LEGACY_FAILURE_ANCHOR_ALIASES: Partial<Record<SreFailureModeId, string>> = {
  "Alert Fatigue & Signal Loss": "silent-data-corruption",
  "Single Point of Failure (SPOF) / Untested Failover": "untested-failover",
};

export function RubricCodexClient({
  sectorCounts = {},
}: RubricCodexCounts) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Masthead & Three-Axis Methodology Overview */}
      <section className="tracing-board-frame p-6 sm:p-8 lg:p-10 relative">
        <HeroCornerBrackets size="md" />
        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-[#C5A059] block">
            The Rubric &amp; Working Tools · Three-Axis Methodology Codex
          </span>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6]">
            Moral Craftsmanship Paired with Systems Engineering
          </h1>
          <p className="font-serif text-base sm:text-lg text-[#94A3B8] max-w-4xl leading-relaxed">
            Every incident on the Change Advisory Board is evaluated across a three-axis diagnostic architecture: the operative and moral lens of the Six Working Tools of Freemasonry (Axis I), the structural mechanics of Site Reliability Engineering failure modes (Axis II), and the civic or industrial sector where the fault manifested (Axis III). While each Working Tool carries a Primary Diagnostic Pairing with its corresponding structural failure mode, real-world incidents frequently intersect across multiple cells of the 6×6 Diagnostic Matrix.
          </p>
        </div>
      </section>

      {/* AXIS I: THE SIX WORKING TOOLS VISUAL DIRECTORY */}
      <section id="axis-1" className="scroll-mt-24 space-y-6">
        <SectionHeader
          eyebrow="Axis I · The Six Working Tools of Freemasonry"
          title="Operative Craft Instruments & Socratic Inquiry"
          action={
            <Link
              href="/archive#matrix"
              className="font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:underline shrink-0"
            >
              Inspect 6×6 Diagnostic Matrix →
            </Link>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WORKING_TOOLS.map((tool) => {
            const pairedFailure = getSreFailureModeSpec(tool.pairedFailureMode);
            return (
              <Link
                key={tool.id}
                id={tool.slug}
                href={getWorkingToolHref(tool.id)}
                className="group tracing-board-frame bg-[#111726]/95 p-6 flex flex-col justify-between space-y-5 scroll-mt-24 hover:border-[#C5A059] transition-colors"
              >
                <div className="space-y-4">
                  {/* 1. Copperplate Engraving Illustration */}
                  <div className="flex justify-center py-2">
                    <WorkingToolEngraving
                      tool={tool.id}
                      className="w-44 h-28 group-hover:scale-105 transition-transform"
                    />
                  </div>

                  {/* 2. Tool Title & 3. 1-Line Green Plain-English Tagline */}
                  <div>
                    <h3 className="font-display text-2xl text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
                      {tool.id}
                    </h3>
                    <p className="font-mono text-xs text-[#10B981] mt-1">
                      {tool.sreEquivalent}
                    </p>
                  </div>

                  {/* 4. Brief 2-Sentence Summary */}
                  <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                    {tool.sreDefinition}
                  </p>
                </div>

                {/* Paired Counterpart Badge + Inline Explore Hub Cue */}
                <div className="pt-3 border-t border-[#8A6D3B]/30 flex items-center justify-between gap-2 text-xs font-mono">
                  <span
                    className="text-[#F59E0B] truncate"
                    title={`Paired Failure Axis: ${pairedFailure.id}`}
                  >
                    Paired Failure Axis: {pairedFailure.id}
                  </span>
                  <span className="inline-flex items-center gap-1 uppercase tracking-wider text-[#C5A059] group-hover:text-[#F3EFE6] shrink-0 transition-colors">
                    <span>Explore Hub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* AXIS II: THE SIX STRUCTURAL FAILURE MODES VISUAL DIRECTORY */}
      <section id="axis-2" className="scroll-mt-24 space-y-6">
        <SectionHeader
          eyebrow="Axis II · The Six Structural Failure Modes"
          title="Site Reliability Engineering Fault Taxonomy"
          action={
            <Link
              href="/archive"
              className="font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:underline shrink-0"
            >
              Browse Master Case Ledger →
            </Link>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SRE_FAILURE_MODES.map((mode) => {
            const legacyAlias = LEGACY_FAILURE_ANCHOR_ALIASES[mode.id];
            return (
              <Link
                key={mode.id}
                id={mode.slug}
                href={getFailureModeHref(mode.id)}
                className="group tracing-board-frame bg-[#111726]/95 p-6 flex flex-col justify-between space-y-5 scroll-mt-24 hover:border-[#C5A059] transition-colors relative"
              >
                {legacyAlias && (
                  <span id={legacyAlias} className="absolute -top-24" aria-hidden="true" />
                )}

                <div className="space-y-4">
                  {/* 1. Schematic Illustration */}
                  <div className="flex justify-center py-2">
                    <FailureModeEngraving
                      failureMode={mode.id}
                      size={112}
                      className="w-44 h-28 group-hover:scale-105 transition-transform"
                    />
                  </div>

                  {/* 2. Failure Mode Title & 3. 1-Line Gold Tagline */}
                  <div>
                    <h3 className="font-display text-xl text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
                      {mode.craftTitle}
                    </h3>
                    <p className="font-mono text-xs text-[#C5A059] mt-1">
                      {mode.id}
                    </p>
                  </div>

                  {/* 4. Brief Summary */}
                  <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                    {mode.summary}
                  </p>
                </div>

                {/* Paired Counterpart Badge + Inline Explore Hub Cue */}
                <div className="pt-3 border-t border-[#8A6D3B]/30 flex items-center justify-between gap-2 text-xs font-mono">
                  <span
                    className="text-[#C5A059] truncate"
                    title={`Primary Corrective Tool: ${mode.defaultPairedTool}`}
                  >
                    Paired: {mode.defaultPairedTool}
                  </span>
                  <span className="inline-flex items-center gap-1 uppercase tracking-wider text-[#C5A059] group-hover:text-[#F3EFE6] shrink-0 transition-colors">
                    <span>Explore Hub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* UNIFIED DUAL-AXIS REFERENCE MATRIX TABLE */}
      <section id="reference-matrix" className="scroll-mt-24 space-y-6">
        <SectionHeader
          eyebrow="Cross-Axis Concordance"
          title="Primary Diagnostic Pairing Reference Table"
        />

        <div className="tracing-board-frame overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#0B0E14] border-b border-[#C5A059]/50 font-mono text-xs uppercase text-[#C5A059]">
                <th className="p-4">Working Tool (Axis I)</th>
                <th className="p-4">Moral / Governance Lens</th>
                <th className="p-4">Primary Paired Failure Mode (Axis II)</th>
                <th className="p-4">Core Diagnostic Inquiry Pattern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8A6D3B]/35 text-sm">
              {WORKING_TOOLS.map((t) => {
                const fm = getSreFailureModeSpec(t.pairedFailureMode);
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-[#0B0E14]/75 transition-colors"
                  >
                    <td className="p-4 font-display text-[#C5A059] font-semibold whitespace-nowrap">
                      <Link
                        href={getWorkingToolHref(t.id)}
                        className="hover:underline"
                      >
                        {t.numeral}. {t.id} →
                      </Link>
                    </td>
                    <td className="p-4 text-[#F3EFE6]">{t.moralLens}</td>
                    <td className="p-4 font-mono text-xs text-[#F59E0B]">
                      <Link
                        href={getFailureModeHref(fm.id)}
                        className="hover:underline"
                      >
                        {fm.craftShortLabel} ({fm.id}) →
                      </Link>
                    </td>
                    <td className="p-4 font-serif italic text-[#F3EFE6]/90">
                      &ldquo;{t.diagnosticQuestionPattern}&rdquo;
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* AXIS III: THE FIVE CIVIC & INDUSTRIAL SECTORS */}
      <section id="axis-3" className="scroll-mt-24 space-y-6">
        <SectionHeader
          eyebrow="Axis III · Operational Arena"
          title="Monitored Civic & Industrial Sectors"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {DOMAIN_SECTOR_SPECS.map((sector) => {
            const count = sectorCounts[sector.id];
            return (
              <Link
                key={sector.id}
                href={getDomainSectorHref(sector.id)}
                className="group tracing-board-frame bg-[#111726] p-5 hover:border-[#C5A059] transition-colors flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-[#C5A059]">
                    <span>Axis III Sector</span>
                    {typeof count === "number" && <span>{count} Cases</span>}
                  </div>
                  <h3 className="font-display text-base text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
                    {sector.id}
                  </h3>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {sector.description}
                  </p>
                </div>
                <span className="font-mono text-xs text-[#C5A059] group-hover:text-[#F3EFE6] inline-flex items-center gap-1 pt-2 transition-colors">
                  <span>Filter Ledger</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
