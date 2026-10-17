"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Scale,
  Compass,
  Cpu,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  getSreFailureModeSpec,
  getWorkingToolSpec,
  WORKING_TOOLS,
} from "@/lib/taxonomy";
import { IncidentArticle } from "@/lib/types";
import { useTelemetry } from "./TelemetryContext";
import {
  BrassSectionDivider,
  ToolRadarChart,
  WorkingToolEngraving,
} from "./MasonicEngravings";

export function IncidentBriefClient({
  incident,
  relatedIncidents,
}: {
  incident: IncidentArticle;
  relatedIncidents: IncidentArticle[];
}) {
  const { openRubricInspector } = useTelemetry();

  const primaryToolSpec = getWorkingToolSpec(incident.primaryTool);
  const failureSpec = getSreFailureModeSpec(incident.sreFailureMode);

  const sortedProbabilities = WORKING_TOOLS.map((t) => ({
    tool: t.id,
    numeral: t.numeral,
    prob: incident.toolProbabilities[t.id] || 0,
  })).sort((a, b) => b.prob - a.prob);

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
        <div className="flex items-center gap-3 text-[#94A3B8]">
          <span>INCIDENT ID: {incident.incidentCode}</span>
          <span>|</span>
          <span>SHA-HASH: {incident.urlHash.slice(0, 12)}</span>
        </div>
      </div>

      {/* Main Two-Column Post-Incident Review Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN (4 cols): Fixed Telemetry Spec Sheet Sidebar */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          <div className="tracing-board-frame p-5 sm:p-6 space-y-5">
            <div className="border-b border-[#8A6D3B]/40 pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059]">
                TELEMETRY SPEC SHEET // SYSTEM-1 JEV GATE
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <h2 className="font-mono text-lg font-bold text-[#F3EFE6]">
                  {incident.incidentCode}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 bg-[#10B981]/15 border border-[#10B981]/45 text-[#10B981]">
                  CONFIDENCE: {Math.round(incident.jevConfidence * 100)}%
                </span>
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
                    {incident.primaryTool} (
                    {(
                      incident.toolProbabilities[incident.primaryTool] || 0
                    ).toFixed(2)}
                    )
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
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block mb-1">
                  SRE Failure Mode (Systems Axis):
                </span>
                <div className="flex items-center justify-between bg-[#0B0E14] border border-[#F59E0B]/60 px-3 py-2 font-mono text-xs text-[#F59E0B]">
                  <Link
                    href={`/knowledge-graph?failure=${encodeURIComponent(
                      incident.sreFailureMode
                    )}`}
                    className="hover:underline"
                  >
                    {incident.sreFailureMode}
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
              </div>
            </div>

            {/* Full Probability Distribution Bar Chart across all 6 Working Tools */}
            <div className="pt-2 border-t border-[#8A6D3B]/35">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] block mb-2.5">
                Jev 6-Tool Probability Vector
              </span>
              <div className="space-y-2">
                {sortedProbabilities.map((item, idx) => {
                  const pct = Math.round(item.prob * 100);
                  return (
                    <div key={item.tool}>
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            openRubricInspector({ tool: item.tool })
                          }
                          className="text-[#F3EFE6] hover:text-[#C5A059] cursor-pointer"
                        >
                          {item.numeral}. {item.tool} [?]
                        </button>
                        <span
                          className={
                            idx === 0 ? "text-[#C5A059] font-bold" : "text-[#94A3B8]"
                          }
                        >
                          {item.prob.toFixed(2)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#0B0E14] border border-[#8A6D3B]/40 mt-0.5">
                        <div
                          className={
                            idx === 0
                              ? "h-full bg-[#C5A059]"
                              : idx === 1
                              ? "h-full bg-[#8A6D3B]"
                              : "h-full bg-[#94A3B8]/40"
                          }
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Radar Chart */}
            <div className="pt-3 border-t border-[#8A6D3B]/35">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block text-center mb-1">
                Hexagonal Rubric Geometry
              </span>
              <ToolRadarChart probabilities={incident.toolProbabilities} />
            </div>

            {/* Source & Ingestion Metadata */}
            <div className="pt-3 border-t border-[#8A6D3B]/35 space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">SOURCE FEED:</span>
                <span className="text-[#F3EFE6]">{incident.sourceFeed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">DOMAIN SECTOR:</span>
                <Link
                  href={`/knowledge-graph?sector=${encodeURIComponent(
                    incident.domainSector
                  )}`}
                  className="text-[#C5A059] hover:underline text-right"
                >
                  {incident.domainSector}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">PUBLISHED AT:</span>
                <span className="text-[#F3EFE6]">
                  {new Date(incident.publishedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">CLASSIFIER LATENCY:</span>
                <span className="text-[#10B981]">
                  {incident.classifierLatencyMs}ms (1-Pass)
                </span>
              </div>
              <div className="pt-2">
                <a
                  href={incident.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#0B0E14] border border-[#C5A059]/60 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0B0E14] transition-colors"
                >
                  <span>Inspect Primary RSS Source</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN (8 cols): Socratic Brief, Diagnostic Lens, & The Trestleboard Inquiry */}
        <div className="lg:col-span-8 space-y-8">
          {/* Article Title Header */}
          <div className="tracing-board-frame p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#C5A059] mb-3">
              <span>POST-INCIDENT REVIEW (PIR)</span>
              <span>•</span>
              <span>{incident.domainSector.toUpperCase()}</span>
              <span>•</span>
              <span>SECONDARY TOOL: {incident.secondaryTool.toUpperCase()}</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6] leading-tight">
              {incident.title}
            </h1>

            <p className="font-serif italic text-base sm:text-lg text-[#C5A059]/95 mt-4 border-l-2 border-[#C5A059] pl-4">
              {incident.executiveSummary}
            </p>
          </div>

          {/* Section I: Facts of the Incident (The Socratic Brief) */}
          <section className="bg-[#111726] border border-[#8A6D3B]/45 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#C5A059]" />
                <h2 className="font-display text-xl text-[#F3EFE6] uppercase tracking-wider">
                  I. Facts of the Incident (The Socratic Brief)
                </h2>
              </div>
              <span className="font-mono text-[11px] text-[#94A3B8]">
                ZERO PUNDITRY // SOURCED TELEMETRY
              </span>
            </div>

            <div className="font-serif text-base sm:text-[17px] text-[#F3EFE6]/90 leading-relaxed space-y-4">
              {incident.socraticBrief.split("\n\n").map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          </section>

          {/* Section II: The Diagnostic Lens (Working Tool + SRE Principle Application) */}
          <section className="bg-[#111726] border border-[#8A6D3B]/45 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#C5A059]" />
                <h2 className="font-display text-xl text-[#F3EFE6] uppercase tracking-wider">
                  II. The Diagnostic Lens: {incident.primaryTool} &amp;{" "}
                  {incident.sreFailureMode}
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

            <p className="font-serif text-base sm:text-[17px] text-[#F3EFE6]/90 leading-relaxed">
              {incident.diagnosticApplication}
            </p>

            {/* Proportionality Check: Noise/Jitter vs. Signal/Capacity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div className="p-4 bg-[#0B0E14] border border-[#EF4444]/40">
                <div className="flex items-center gap-2 font-mono text-xs uppercase text-[#EF4444] mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Overblown Media Jitter (Noise)</span>
                </div>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  {incident.proportionalityCheck.noiseOverblown}
                </p>
              </div>

              <div className="p-4 bg-[#0B0E14] border border-[#10B981]/45">
                <div className="flex items-center gap-2 font-mono text-xs uppercase text-[#10B981] mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Underlying Structural Constraint (Signal)</span>
                </div>
                <p className="text-sm text-[#F3EFE6]/90 leading-relaxed">
                  {incident.proportionalityCheck.structuralSignal}
                </p>
              </div>
            </div>

            {/* Dual-Axis Reference Strip */}
            <div className="p-4 bg-[#0B0E14]/80 border border-[#8A6D3B]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
              <div>
                <span className="text-[#C5A059] block">
                  {primaryToolSpec.id} — {primaryToolSpec.moralLens}
                </span>
                <span className="text-[#94A3B8]">
                  SRE Equivalent: {primaryToolSpec.sreEquivalent} ({failureSpec.shortCode})
                </span>
              </div>
              <Link
                href={`/knowledge-graph?tool=${encodeURIComponent(
                  incident.primaryTool
                )}&failure=${encodeURIComponent(incident.sreFailureMode)}`}
                className="px-3 py-1.5 border border-[#C5A059]/60 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0B0E14] transition-colors shrink-0"
              >
                Cross-Filter Signature →
              </Link>
            </div>
          </section>

          {/* Section III: The Trestleboard Inquiry (Socratic Questions inside Ornate Brass Box) */}
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
                  The pipeline does not propose a partisan verdict. Apply{" "}
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
                {incident.questions.map((q, index) => (
                  <li
                    key={index}
                    className="p-4 bg-[#111726] border border-[#8A6D3B]/50 flex items-start gap-4"
                  >
                    <span className="font-mono text-sm font-bold px-2.5 py-1 bg-[#0B0E14] border border-[#C5A059] text-[#C5A059] shrink-0">
                      Q{index + 1}
                    </span>
                    <p className="font-display text-base sm:text-lg text-[#F3EFE6] leading-relaxed">
                      {q}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <BrassSectionDivider label="RELATED TELEMETRY IN THE ARCHIVE" />

          {/* Related Incidents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedIncidents.map((rel) => (
              <Link
                key={rel.id}
                href={`/incidents/${rel.slug}`}
                className="p-4 bg-[#111726] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-colors block"
              >
                <div className="flex items-center justify-between font-mono text-xs text-[#C5A059] mb-1">
                  <span>{rel.incidentCode}</span>
                  <span>{rel.primaryTool}</span>
                </div>
                <h3 className="font-display text-base text-[#F3EFE6] line-clamp-2">
                  {rel.title}
                </h3>
                <span className="font-mono text-[11px] text-[#94A3B8] mt-2 block">
                  Failure Mode: {rel.sreFailureMode}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
