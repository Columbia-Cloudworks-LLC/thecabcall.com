"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Compass, Cpu, Layers } from "lucide-react";
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
  BrassSectionDivider,
  FailureModeEngraving,
  WorkingToolEngraving,
} from "./MasonicEngravings";

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
  toolCounts = {},
  failureCounts = {},
  sectorCounts = {},
}: RubricCodexCounts) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Masthead & Three-Axis Methodology Overview */}
      <section className="tracing-board-frame p-6 sm:p-8 lg:p-10 space-y-6">
        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-[#C5A059] block">
            THE RUBRIC &amp; WORKING TOOLS // METHODOLOGY &amp; VISUAL DIRECTORY
          </span>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6]">
            Moral Craftsmanship Paired with Systems Engineering
          </h1>
          <p className="font-serif text-base sm:text-lg text-[#94A3B8] max-w-4xl leading-relaxed">
            Every incident on the Change Advisory Board is evaluated across a three-axis diagnostic architecture: the operative and moral lens of the Six Working Tools of Freemasonry (Axis I), the structural mechanics of Site Reliability Engineering failure modes (Axis II), and the civic or industrial sector where the fault manifested (Axis III). While each Working Tool carries a Primary Diagnostic Pairing with its corresponding structural failure mode, real-world incidents frequently intersect across multiple cells of the 6×6 Diagnostic Matrix.
          </p>
        </div>

        {/* Three-Axis Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          <a
            href="#axis-1"
            className="p-5 bg-[#0B0E14] border border-[#C5A059]/45 hover:border-[#C5A059] transition-colors space-y-2 block"
          >
            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-[#C5A059]">
              <span className="inline-flex items-center gap-2">
                <Compass className="w-4 h-4" />
                <span>Axis I · Diagnostic Lens</span>
              </span>
              <span>6 Tools</span>
            </div>
            <h2 className="font-display text-lg text-[#F3EFE6]">
              The Six Working Tools
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Operative stonecraft instruments translated into Socratic governance and shop-floor reliability checks. Every dispatch is assigned a Primary and Secondary Working Tool.
            </p>
          </a>

          <a
            href="#axis-2"
            className="p-5 bg-[#0B0E14] border border-[#10B981]/40 hover:border-[#C5A059] transition-colors space-y-2 block"
          >
            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-[#10B981]">
              <span className="inline-flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                <span>Axis II · Fault Mechanics</span>
              </span>
              <span>6 Failure Modes</span>
            </div>
            <h2 className="font-display text-lg text-[#F3EFE6]">
              Structural Failure Modes
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Formal Site Reliability Engineering failure patterns that explain how systems degrade under load, drift from specification, or mask early warning telemetry.
            </p>
          </a>

          <a
            href="#axis-3"
            className="p-5 bg-[#0B0E14] border border-[#8A6D3B]/50 hover:border-[#C5A059] transition-colors space-y-2 block"
          >
            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-[#C5A059]">
              <span className="inline-flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <span>Axis III · Operational Arena</span>
              </span>
              <span>5 Sectors</span>
            </div>
            <h2 className="font-display text-lg text-[#F3EFE6]">
              Civic &amp; Industrial Sectors
            </h2>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              The five public and industrial domains monitored by the Change Advisory Board to track cross-sector propagation of structural failures.
            </p>
          </a>
        </div>
      </section>

      {/* AXIS I: THE SIX WORKING TOOLS VISUAL DIRECTORY */}
      <section id="axis-1" className="scroll-mt-24 space-y-6">
        <BrassSectionDivider label="AXIS I // THE SIX WORKING TOOLS OF FREEMASONRY" />

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#F3EFE6]">
              Operative Craft Instruments &amp; Socratic Inquiry
            </h2>
            <p className="text-sm text-[#94A3B8] mt-1">
              Select any Working Tool to open its dedicated Hub Monograph, live cross-axis telemetry, and filtered post-incident ledger.
            </p>
          </div>
          <Link
            href="/archive#matrix"
            className="font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:underline shrink-0"
          >
            Inspect 6×6 Diagnostic Matrix →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WORKING_TOOLS.map((tool) => {
            const pairedFailure = getSreFailureModeSpec(tool.pairedFailureMode);
            const dispatchCount = toolCounts[tool.id];
            return (
              <article
                key={tool.id}
                id={tool.slug}
                className="tracing-board-frame bg-[#111726]/95 p-6 flex flex-col justify-between space-y-5 scroll-mt-24 hover:border-[#C5A059] transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-[#C5A059] uppercase tracking-widest font-semibold">
                      TOOL {tool.numeral} OF VI
                    </span>
                    {typeof dispatchCount === "number" && (
                      <Link
                        href={`/archive?tool=${tool.slug}`}
                        className="px-2 py-0.5 rounded bg-[#0B0E14] border border-[#8A6D3B]/40 text-[#C5A059] hover:border-[#C5A059]"
                      >
                        {dispatchCount} Dispatches
                      </Link>
                    )}
                  </div>

                  <Link
                    href={getWorkingToolHref(tool.id)}
                    className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45 flex flex-col items-center group"
                  >
                    <WorkingToolEngraving
                      tool={tool.id}
                      className="w-44 h-28 group-hover:scale-105 transition-transform"
                    />
                    <span className="font-mono text-[10px] text-[#94A3B8] mt-2 text-center">
                      {tool.engravingCaption}
                    </span>
                  </Link>

                  <div>
                    <h3 className="font-display text-2xl text-[#F3EFE6]">
                      <Link
                        href={getWorkingToolHref(tool.id)}
                        className="hover:text-[#C5A059] transition-colors"
                      >
                        {tool.id}
                      </Link>
                    </h3>
                    <p className="font-mono text-xs text-[#10B981] mt-1">
                      {tool.sreEquivalent}
                    </p>
                  </div>

                  <p className="font-serif italic text-sm text-[#F3EFE6] bg-[#0B0E14]/90 border-l-2 border-[#C5A059] pl-3 py-2">
                    &ldquo;{tool.diagnosticQuestionPattern}&rdquo;
                  </p>

                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {tool.sreDefinition}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#8A6D3B]/35 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#94A3B8]">Primary Pairing:</span>
                    <Link
                      href={getFailureModeHref(pairedFailure.id)}
                      className="text-[#F59E0B] hover:underline text-right"
                      title={`Paired Failure Axis: ${pairedFailure.id}`}
                    >
                      Paired Failure Axis: {pairedFailure.id}
                    </Link>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      href={getWorkingToolHref(tool.id)}
                      className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-3.5 py-2 bg-[#C5A059] text-[#0B0E14] font-bold hover:bg-[#d6b36a] transition-colors"
                    >
                      <span>Explore {tool.shortName} Hub</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/archive?tool=${tool.slug}`}
                      className="font-mono text-xs text-[#C5A059] hover:underline"
                    >
                      Archive →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* AXIS II: THE SIX STRUCTURAL FAILURE MODES VISUAL DIRECTORY */}
      <section id="axis-2" className="scroll-mt-24 space-y-6">
        <BrassSectionDivider label="AXIS II // THE SIX STRUCTURAL FAILURE MODES" />

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#F3EFE6]">
              Site Reliability Engineering Fault Taxonomy
            </h2>
            <p className="text-sm text-[#94A3B8] mt-1">
              Select any Structural Failure Mode to inspect its copperplate fault schematic, early warning signals, and verified incident history.
            </p>
          </div>
          <Link
            href="/archive"
            className="font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:underline shrink-0"
          >
            Browse Master Case Ledger →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SRE_FAILURE_MODES.map((mode) => {
            const legacyAlias = LEGACY_FAILURE_ANCHOR_ALIASES[mode.id];
            const dispatchCount = failureCounts[mode.id];
            return (
              <article
                key={mode.id}
                id={mode.slug}
                className="tracing-board-frame bg-[#111726]/95 p-6 flex flex-col justify-between space-y-5 scroll-mt-24 hover:border-[#C5A059] transition-colors relative"
              >
                {legacyAlias && (
                  <span id={legacyAlias} className="absolute -top-24" aria-hidden="true" />
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-[#F59E0B] uppercase tracking-wider font-semibold">
                      Severity: {mode.severity}
                    </span>
                    {typeof dispatchCount === "number" && (
                      <Link
                        href={`/archive?failure=${mode.slug}`}
                        className="px-2 py-0.5 rounded bg-[#0B0E14] border border-[#8A6D3B]/40 text-[#C5A059] hover:border-[#C5A059]"
                      >
                        {dispatchCount} Dispatches
                      </Link>
                    )}
                  </div>

                  <Link
                    href={getFailureModeHref(mode.id)}
                    className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45 flex flex-col items-center group"
                  >
                    <FailureModeEngraving
                      failureMode={mode.id}
                      size={112}
                      className="group-hover:scale-105 transition-transform"
                    />
                    <span className="font-mono text-[10px] text-[#94A3B8] mt-2 text-center">
                      {mode.engravingCaption}
                    </span>
                  </Link>

                  <div>
                    <h3 className="font-display text-xl text-[#F3EFE6]">
                      <Link
                        href={getFailureModeHref(mode.id)}
                        className="hover:text-[#C5A059] transition-colors"
                      >
                        {mode.craftTitle}
                      </Link>
                    </h3>
                    <p className="font-mono text-xs text-[#C5A059] mt-1">
                      Formal SRE Taxonomy: {mode.id}
                    </p>
                  </div>

                  <p className="text-xs text-[#F3EFE6]/90 leading-relaxed">
                    {mode.summary}
                  </p>

                  <p className="text-xs text-[#94A3B8] leading-relaxed pt-2 border-t border-[#8A6D3B]/30">
                    <strong className="font-mono text-[#10B981] uppercase">
                      Shop-Floor Mechanics:{" "}
                    </strong>
                    {mode.systemsDefinition}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#8A6D3B]/35 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#94A3B8]">Primary Corrective Tool:</span>
                    <Link
                      href={getWorkingToolHref(mode.defaultPairedTool)}
                      className="text-[#C5A059] hover:underline"
                    >
                      {mode.defaultPairedTool}
                    </Link>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      href={getFailureModeHref(mode.id)}
                      className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-3.5 py-2 bg-[#C5A059] text-[#0B0E14] font-bold hover:bg-[#d6b36a] transition-colors"
                    >
                      <span>Explore {mode.craftShortLabel} Hub</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/archive?failure=${mode.slug}`}
                      className="font-mono text-xs text-[#C5A059] hover:underline"
                    >
                      Archive →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* UNIFIED DUAL-AXIS REFERENCE MATRIX TABLE */}
      <section id="reference-matrix" className="scroll-mt-24 space-y-6">
        <BrassSectionDivider label="PRIMARY DIAGNOSTIC PAIRING REFERENCE TABLE" />

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
        <BrassSectionDivider label="AXIS III // MONITORED CIVIC & INDUSTRIAL SECTORS" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {DOMAIN_SECTOR_SPECS.map((sector) => {
            const count = sectorCounts[sector.id];
            return (
              <Link
                key={sector.id}
                href={getDomainSectorHref(sector.id)}
                className="p-5 bg-[#111726] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-colors flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-[#C5A059]">
                    <span>Axis III Sector</span>
                    {typeof count === "number" && <span>{count} Cases</span>}
                  </div>
                  <h3 className="font-display text-base text-[#F3EFE6]">
                    {sector.id}
                  </h3>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {sector.description}
                  </p>
                </div>
                <span className="font-mono text-xs text-[#C5A059] inline-flex items-center gap-1 pt-2">
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
