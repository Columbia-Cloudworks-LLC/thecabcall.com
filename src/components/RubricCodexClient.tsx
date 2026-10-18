"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Compass,
  Cpu,
  HelpCircle,
  ArrowRight,
  Terminal,
  BookOpen,
} from "lucide-react";
import {
  getSreFailureModeSpec,
  SRE_FAILURE_MODES,
  WORKING_TOOLS,
  WorkingToolId,
} from "@/lib/taxonomy";
import {
  BrassSectionDivider,
  WorkingToolEngraving,
} from "./MasonicEngravings";

export function RubricCodexClient() {
  const [activeToolId, setActiveToolId] =
    useState<WorkingToolId>("The Square");

  const activeTool =
    WORKING_TOOLS.find((t) => t.id === activeToolId) || WORKING_TOOLS[3];
  const pairedFailure = getSreFailureModeSpec(activeTool.pairedFailureMode);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Masthead */}
      <div className="tracing-board-frame p-6 sm:p-8 mb-8">
        <span className="font-mono text-xs uppercase tracking-[0.22em] text-[#C5A059]">
          THE RUBRIC &amp; WORKING TOOLS // METHODOLOGY &amp; REFERENCE CODEX
        </span>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6] mt-1">
          Moral Craftsmanship Paired with Systems Engineering
        </h1>
        <p className="font-serif text-base text-[#94A3B8] mt-2 max-w-4xl leading-relaxed">
          To keep diagnostic evaluations sharp and prevent overlapping analytical lenses, each of the Six Working Tools of Freemasonry is mapped to a mutually exclusive Site Reliability Engineering lens and diagnostic inquiry pattern.
        </p>
      </div>

      {/* Interactive Split-Screen Reference Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
        {/* Left Selector Column (4 cols) */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="font-mono text-xs uppercase tracking-wider text-[#C5A059] mb-2">
            Select a Working Tool to Inspect Pairings:
          </div>
          {WORKING_TOOLS.map((tool) => {
            const isSelected = tool.id === activeToolId;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveToolId(tool.id)}
                className={`w-full text-left p-4 border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? "bg-[#111726] border-[#C5A059] shadow-[inset_0_0_0_1px_rgba(197,160,89,0.5)]"
                    : "bg-[#0B0E14] border-[#8A6D3B]/40 hover:border-[#C5A059]/60"
                }`}
              >
                <div>
                  <span className="font-mono text-xs text-[#C5A059]">
                    TOOL {tool.numeral}
                  </span>
                  <h2 className="font-display text-lg text-[#F3EFE6]">
                    {tool.id}
                  </h2>
                  <p className="font-mono text-[11px] text-[#94A3B8] mt-0.5">
                    {tool.sreEquivalent}
                  </p>
                </div>
                <ArrowRight
                  className={`w-4 h-4 transition-transform ${
                    isSelected
                      ? "text-[#C5A059] translate-x-1"
                      : "text-[#94A3B8]/50"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right Split-Screen Detail Panel (8 cols) */}
        <div className="lg:col-span-8 tracing-board-frame p-6 sm:p-8 space-y-6">
          {/* Top Plate & Engraving */}
          <div className="flex flex-col md:flex-row items-center gap-6 pb-6 border-b border-[#8A6D3B]/40">
            <div className="p-4 bg-[#0B0E14] border border-[#C5A059]/50 shrink-0 flex flex-col items-center">
              <WorkingToolEngraving
                tool={activeTool.id}
                className="w-48 h-28"
              />
              <span className="font-mono text-[10px] text-[#94A3B8] mt-1">
                {activeTool.engravingCaption}
              </span>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                WORKING TOOL {activeTool.numeral} OF VI
              </span>
              <h2 className="font-display text-3xl text-[#F3EFE6]">
                {activeTool.id}
              </h2>
              <p className="font-serif italic text-base text-[#C5A059]">
                &ldquo;{activeTool.diagnosticQuestionPattern}&rdquo;
              </p>
              <div className="pt-2">
                <Link
                  href={`/knowledge-graph?tool=${encodeURIComponent(
                    activeTool.id
                  )}`}
                  className="inline-flex items-center gap-2 font-mono text-xs uppercase px-3.5 py-1.5 bg-[#C5A059] text-[#0B0E14] font-bold hover:bg-[#d6b36a] transition-colors"
                >
                  <span>Explore {activeTool.id} Incidents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Split-Screen Comparison: Moral Lens vs. SRE Systems Lens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Side: Moral & Philosophical Monitor */}
            <div className="p-5 bg-[#0B0E14] border border-[#C5A059]/50 space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#C5A059]">
                <Compass className="w-4 h-4" />
                <span>Moral &amp; Philosophical Lens</span>
              </div>
              <h3 className="font-display text-base text-[#F3EFE6]">
                {activeTool.moralLens}
              </h3>
              <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
                {activeTool.moralDefinition}
              </p>
            </div>

            {/* Right Side: Site Reliability Engineering Equivalent */}
            <div className="p-5 bg-[#0B0E14] border border-[#10B981]/45 space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#10B981]">
                <Cpu className="w-4 h-4" />
                <span>SRE / Systems Equivalent</span>
              </div>
              <h3 className="font-display text-base text-[#F3EFE6]">
                {activeTool.sreEquivalent}
              </h3>
              <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
                {activeTool.sreDefinition}
              </p>
            </div>
          </div>

          {/* Paired Failure Mode & Editorial Inquiry Standard */}
          <div className="p-5 bg-[#0B0E14] border border-[#8A6D3B]/50 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs text-[#C5A059]">
              <span className="inline-flex items-center gap-2 uppercase">
                <HelpCircle className="w-4 h-4" />
                <span>Paired Diagnostic Standard &amp; Failure Axis</span>
              </span>
              <span className="text-[#C5A059]">MUTUALLY EXCLUSIVE RUBRIC</span>
            </div>
            <div className="p-4 bg-[#111726] border border-[#8A6D3B]/40 space-y-2.5">
              <div className="font-display text-sm text-[#F3EFE6]">
                Paired Failure Axis: {pairedFailure.id}
              </div>
              <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
                {activeTool.jevClassifierCriteria}
              </p>
            </div>
          </div>
        </div>
      </div>

      <BrassSectionDivider label="COMPLETE DUAL-AXIS REFERENCE TABLE" />

      {/* Complete Reference Table matching Automated SRE Freemasonry News Pipeline.md Section 2 */}
      <div className="tracing-board-frame overflow-x-auto mb-12">
        <table className="w-full border-collapse text-left min-w-[820px]">
          <thead>
            <tr className="bg-[#0B0E14] border-b border-[#C5A059]/50 font-mono text-xs uppercase text-[#C5A059]">
              <th className="p-4">Working Tool</th>
              <th className="p-4">Moral / Philosophical Lens</th>
              <th className="p-4">SRE / Systems Equivalent</th>
              <th className="p-4">Diagnostic Question Pattern</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#8A6D3B]/35 text-sm">
            {WORKING_TOOLS.map((t) => (
              <tr
                key={t.id}
                onClick={() => setActiveToolId(t.id)}
                className="hover:bg-[#0B0E14]/75 cursor-pointer transition-colors"
              >
                <td className="p-4 font-display text-[#C5A059] font-semibold whitespace-nowrap">
                  {t.numeral}. {t.id}
                </td>
                <td className="p-4 text-[#F3EFE6]">{t.moralLens}</td>
                <td className="p-4 font-mono text-xs text-[#10B981]">
                  {t.sreEquivalent}
                </td>
                <td className="p-4 font-serif italic text-[#F3EFE6]/90">
                  &ldquo;{t.diagnosticQuestionPattern}&rdquo;
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BrassSectionDivider label="AXIS 2 // THE SIX STRUCTURAL FAILURE MODES" />

      {/* SRE Failure Modes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SRE_FAILURE_MODES.map((mode) => (
          <div
            key={mode.id}
            className="p-5 bg-[#111726] border border-[#8A6D3B]/45 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#F59E0B] font-semibold uppercase">
                  Structural Failure Mode
                </span>
                <span className="text-[#94A3B8]">
                  Paired: {mode.defaultPairedTool}
                </span>
              </div>
              <h3 className="font-display text-lg text-[#F3EFE6]">
                {mode.id}
              </h3>
              <p className="text-xs text-[#F3EFE6]/90 leading-relaxed">
                {mode.summary}
              </p>
              <p className="text-xs text-[#94A3B8] leading-relaxed pt-2 border-t border-[#8A6D3B]/30">
                <strong className="font-mono text-[#C5A059] uppercase">
                  Civic Manifestation:{" "}
                </strong>
                {mode.civicManifestation}
              </p>
            </div>

            <Link
              href={`/knowledge-graph?failure=${encodeURIComponent(mode.id)}`}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-[#C5A059] hover:underline pt-2"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Filter Archive by {mode.id} →</span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
