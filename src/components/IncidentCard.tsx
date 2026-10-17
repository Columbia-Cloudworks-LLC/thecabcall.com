"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, HelpCircle } from "lucide-react";
import { IncidentArticle } from "@/lib/types";
import { WORKING_TOOLS, WorkingToolId } from "@/lib/taxonomy";
import { useTelemetry } from "./TelemetryContext";

export function IncidentCard({ incident }: { incident: IncidentArticle }) {
  const { openRubricInspector } = useTelemetry();

  const primaryProb = incident.toolProbabilities[incident.primaryTool] || 0.45;
  const sortedProbs = WORKING_TOOLS.map((t) => ({
    tool: t.id,
    prob: incident.toolProbabilities[t.id] || 0,
  })).sort((a, b) => b.prob - a.prob);

  const confidencePct = Math.round(incident.jevConfidence * 100);

  return (
    <article className="group relative bg-[#111726] border border-[#94A3B8]/30 p-5 sm:p-6 transition-all duration-300 hover:border-[#C5A059]/80 hover:shadow-[0_10px_35px_rgba(0,0,0,0.65)] flex flex-col justify-between">
      {/* Inset 1px Tracing-Board Border */}
      <div className="pointer-events-none absolute inset-1.5 border border-[#8A6D3B]/30 group-hover:border-[#C5A059]/55 transition-colors" />

      {/* Geometric Burnished Brass Corner Brackets (illuminate on hover) */}
      <span className="pointer-events-none absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-[#8A6D3B]/60 group-hover:border-[#C5A059] transition-colors" />
      <span className="pointer-events-none absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-[#8A6D3B]/60 group-hover:border-[#C5A059] transition-colors" />
      <span className="pointer-events-none absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-[#8A6D3B]/60 group-hover:border-[#C5A059] transition-colors" />
      <span className="pointer-events-none absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-[#8A6D3B]/60 group-hover:border-[#C5A059] transition-colors" />

      <div className="relative z-10">
        {/* Top Bar (Monospace): Incident ID, Source, and Signal Confidence */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#8A6D3B]/30 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#C5A059] font-semibold">
              {incident.incidentCode}
            </span>
            <span className="text-[#94A3B8]">•</span>
            <span className="px-1.5 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/40 text-[#F3EFE6] text-[11px]">
              {incident.sourceFeed}
            </span>
            <span className="text-[11px] text-[#94A3B8] hidden sm:inline">
              {incident.domainSector}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
              SIGNAL:
            </span>
            <span
              className={`px-1.5 py-0.5 text-[11px] font-semibold border ${
                confidencePct >= 88
                  ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/40"
                  : "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/40"
              }`}
            >
              {confidencePct}% ({incident.jevConfidence.toFixed(2)})
            </span>
          </div>
        </div>

        {/* Center: Neutral Headline & Two-Sentence Executive Summary */}
        <Link
          href={`/incidents/${incident.slug}`}
          className="block group/title"
        >
          <h3 className="font-display text-lg sm:text-xl text-[#F3EFE6] group-hover/title:text-[#C5A059] transition-colors leading-snug">
            {incident.title}
          </h3>
        </Link>

        <p className="font-serif text-sm sm:text-[15px] text-[#F3EFE6]/85 mt-3 leading-relaxed">
          {incident.executiveSummary}
        </p>
      </div>

      {/* Bottom Section: Diagnostic Badges + Hover Secondary Probability Bar */}
      <div className="relative z-10 mt-5 pt-4 border-t border-[#8A6D3B]/30 space-y-3">
        {/* Two Distinct Pill Badges + [?] Inspection Triggers */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Working Tool Badge in Burnished Brass */}
            <div className="inline-flex items-center bg-[#0B0E14] border border-[#C5A059]/75 text-[#C5A059] text-xs font-mono">
              <Link
                href={`/knowledge-graph?tool=${encodeURIComponent(
                  incident.primaryTool
                )}`}
                className="px-2.5 py-1 hover:bg-[#C5A059]/15 transition-colors"
                title={`Filter Knowledge Graph by ${incident.primaryTool}`}
              >
                {incident.primaryTool} — {primaryProb.toFixed(2)}
              </Link>
              <button
                type="button"
                onClick={() =>
                  openRubricInspector({ tool: incident.primaryTool })
                }
                className="px-1.5 py-1 border-l border-[#C5A059]/40 text-[#C5A059]/80 hover:text-[#F3EFE6] hover:bg-[#C5A059]/20 cursor-pointer"
                title={`Inspect ${incident.primaryTool} in The Rubric`}
              >
                [?]
              </button>
            </div>

            {/* SRE Failure Mode Badge in Slate/Amber */}
            <div className="inline-flex items-center bg-[#0B0E14] border border-[#F59E0B]/55 text-[#F59E0B] text-xs font-mono">
              <Link
                href={`/knowledge-graph?failure=${encodeURIComponent(
                  incident.sreFailureMode
                )}`}
                className="px-2.5 py-1 hover:bg-[#F59E0B]/15 transition-colors"
                title={`Filter Knowledge Graph by ${incident.sreFailureMode}`}
              >
                {incident.sreFailureMode}
              </Link>
              <button
                type="button"
                onClick={() =>
                  openRubricInspector({ failureMode: incident.sreFailureMode })
                }
                className="px-1.5 py-1 border-l border-[#F59E0B]/40 text-[#F59E0B]/80 hover:text-[#F3EFE6] hover:bg-[#F59E0B]/20 cursor-pointer"
                title={`Inspect ${incident.sreFailureMode} in The Rubric`}
              >
                <HelpCircle className="w-3 h-3 inline" />
              </button>
            </div>
          </div>

          <Link
            href={`/incidents/${incident.slug}`}
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors shrink-0"
          >
            <span>Inspect PIR</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Hover-Revealed Secondary Working Tool Probability Bar */}
        <div className="opacity-75 group-hover:opacity-100 transition-opacity pt-1">
          <div className="flex items-center justify-between font-mono text-[10px] text-[#94A3B8] mb-1">
            <span>
              JEV VECTOR // 2ND:{" "}
              <strong className="text-[#F3EFE6]">
                {incident.secondaryTool} (
                {(
                  incident.toolProbabilities[
                    incident.secondaryTool as WorkingToolId
                  ] || 0
                ).toFixed(2)}
                )
              </strong>
            </span>
            <span>{incident.questions.length} SOCRATIC INQUIRIES</span>
          </div>
          <div className="h-1.5 w-full bg-[#0B0E14] border border-[#8A6D3B]/35 flex overflow-hidden">
            {sortedProbs.map((entry, idx) => (
              <div
                key={entry.tool}
                style={{ width: `${Math.round(entry.prob * 100)}%` }}
                className={
                  idx === 0
                    ? "bg-[#C5A059]"
                    : idx === 1
                    ? "bg-[#8A6D3B]"
                    : "bg-[#94A3B8]/30"
                }
                title={`${entry.tool}: ${Math.round(entry.prob * 100)}%`}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
