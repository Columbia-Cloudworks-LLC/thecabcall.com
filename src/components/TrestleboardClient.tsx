"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  DomainSectorId,
  SreFailureModeId,
  WorkingToolId,
} from "@/lib/taxonomy";
import {
  IncidentArticle,
  PodcastEpisode,
  SystemPostureSummary,
} from "@/lib/types";
import { useTelemetry } from "./TelemetryContext";
import { IncidentCard } from "./IncidentCard";
import {
  BrassSectionDivider,
  MasonSquareWatermark,
} from "./MasonicEngravings";

interface TrestleboardClientProps {
  initialIncidents: IncidentArticle[];
  posture: SystemPostureSummary;
  pinnedEpisode: PodcastEpisode;
}

const WORKING_TOOL_OPTIONS: { value: WorkingToolId; label: string }[] = [
  { value: "The Square", label: "The Square" },
  { value: "The Plumb", label: "The Plumb" },
  { value: "The Level", label: "The Level" },
  { value: "Common Gavel", label: "Common Gavel" },
  { value: "24-Inch Gauge", label: "24-Inch Gauge" },
  { value: "The Trowel", label: "The Trowel" },
];

const FAILURE_MODE_OPTIONS: { value: SreFailureModeId; label: string }[] = [
  { value: "Configuration Drift", label: "Configuration Drift" },
  { value: "Cascading Failure", label: "Cascading Failure" },
  { value: "Alert Fatigue & Signal Loss", label: "Alert Fatigue" },
  {
    value: "Single Point of Failure (SPOF) / Untested Failover",
    label: "Single Point of Failure",
  },
  {
    value: "Blame Culture vs. Root-Cause Isolation",
    label: "Blame Culture",
  },
  {
    value: "Technical & Institutional Debt",
    label: "Institutional Debt",
  },
];

const SECTOR_OPTIONS: { value: DomainSectorId; label: string }[] = [
  { value: "Infrastructure & Supply Chain", label: "Infrastructure" },
  { value: "Technology & Cyber", label: "Technology" },
  { value: "Public Policy & Governance", label: "Governance" },
  { value: "Economics & Markets", label: "Markets" },
  { value: "Institutional Leadership", label: "Leadership" },
];

const SHORT_FAILURE_LABELS: Record<SreFailureModeId, string> = {
  "Configuration Drift": "Configuration Drift",
  "Cascading Failure": "Cascading Failure",
  "Alert Fatigue & Signal Loss": "Alert Fatigue",
  "Single Point of Failure (SPOF) / Untested Failover": "Untested Failover",
  "Blame Culture vs. Root-Cause Isolation": "Blame Culture",
  "Technical & Institutional Debt": "Institutional Debt",
};

function formatLeadDateline(isoDate: string): string {
  const date = new Date(isoDate);
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const month = months[date.getUTCMonth()] || "OCT";
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

export function TrestleboardClient({
  initialIncidents,
  posture,
  pinnedEpisode,
}: TrestleboardClientProps) {
  const {
    activeEpisode,
    isPlaying,
    playEpisode,
    togglePlayPause,
    openRubricInspector,
  } = useTelemetry();

  const [selectedTool, setSelectedTool] = useState<string>("ALL");
  const [selectedFailure, setSelectedFailure] = useState<string>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");

  const isPinnedActive = activeEpisode.id === pinnedEpisode.id;

  const heroDominantTool = pinnedEpisode.dominantTool || posture.dominantTool;
  const heroDominantToolPct =
    pinnedEpisode.dominantToolPercentage ?? posture.dominantToolPercentage;
  const heroTopFailureMode =
    pinnedEpisode.dominantFailureMode || posture.topFailureMode;
  const heroWeeklyNarrative =
    pinnedEpisode.transcriptSections?.weeklyTelemetry || pinnedEpisode.summary;

  const filteredIncidents = initialIncidents.filter((inc) => {
    if (selectedTool !== "ALL" && inc.primaryTool !== selectedTool) return false;
    if (selectedFailure !== "ALL" && inc.sreFailureMode !== selectedFailure)
      return false;
    if (selectedSector !== "ALL" && inc.domainSector !== selectedSector)
      return false;
    return true;
  });

  const leadIncident = filteredIncidents[0] || null;
  const secondaryIncidents = filteredIncidents.slice(1, 7);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* B. THE WEEKLY TRESTLEBOARD & PODCAST FEATURE (SPLIT ASYMMETRIC HERO) */}
      <section
        aria-label="The Weekly Trestleboard & Podcast Feature"
        className="relative bg-[#111726] border border-[#C5A059]/65 shadow-[0_16px_48px_rgba(0,0,0,0.65)]"
      >
        {/* Double-line brass hairline inner border */}
        <div className="pointer-events-none absolute inset-1.5 border border-[#8A6D3B]/55" />

        {/* Four Burnished Brass Corner Brackets */}
        <span className="pointer-events-none absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#C5A059]" />
        <span className="pointer-events-none absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#C5A059]" />
        <span className="pointer-events-none absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#C5A059]" />
        <span className="pointer-events-none absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#C5A059]" />

        <div className="relative z-10 flex flex-col lg:flex-row">
          {/* Left Column (65% Width) — Pattern of the Week */}
          <div className="relative lg:w-[65%] p-6 sm:p-8 lg:p-10 overflow-hidden">
            {/* Subtle 10% opacity copperplate vector engraving of a Mason's Square */}
            <div className="pointer-events-none select-none absolute -bottom-6 -right-4 opacity-10">
              <MasonSquareWatermark className="w-64 h-64 sm:w-72 sm:h-72" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                WEEK OF {formatLeadDateline(pinnedEpisode.publishedAt)} // WEEKLY SYSTEMS RETROSPECTIVE
              </div>

              <h2 className="font-display italic text-2xl sm:text-3xl lg:text-[32px] text-[#F3EFE6] leading-tight">
                {pinnedEpisode.title}
              </h2>

              {/* Live D1 Posture Badges: Dominant Working Tool %, Top SRE Failure Mode, and Gate Metrics */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => openRubricInspector({ tool: heroDominantTool })}
                  className="px-2.5 py-1 bg-[#0B0E14] border border-[#C5A059]/75 text-[#C5A059] hover:bg-[#C5A059]/15 transition-colors cursor-pointer"
                >
                  DOMINANT TOOL: {heroDominantTool.toUpperCase()} ({heroDominantToolPct}%)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openRubricInspector({ failureMode: heroTopFailureMode })
                  }
                  className="px-2.5 py-1 bg-[#0B0E14] border border-[#8A6D3B]/75 text-[#F3EFE6] hover:border-[#C5A059] transition-colors cursor-pointer"
                >
                  TOP FAILURE MODE:{" "}
                  {(
                    SHORT_FAILURE_LABELS[heroTopFailureMode] ||
                    heroTopFailureMode
                  ).toUpperCase()}
                </button>
                <span className="px-2.5 py-1 bg-[#0B0E14]/80 border border-[#10B981]/45 text-[#10B981]">
                  {posture.totalIncidentsWindow} INCIDENTS · {posture.noiseRejectionRate}% NOISE REJECTED
                </span>
              </div>

              <p className="font-serif text-base sm:text-[17px] text-[#F3EFE6]/90 leading-relaxed pt-1">
                {heroWeeklyNarrative}
              </p>
            </div>
          </div>

          {/* Right Column (35% Width) — The Friday CAB Call (Audio Feature) */}
          <div className="lg:w-[35%] p-6 sm:p-8 lg:p-10 border-t lg:border-t-0 lg:border-l border-[#C5A059]/35 bg-[#0B0E14]/35 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#C5A059]">
                THE CAB CALL // EPISODE #{pinnedEpisode.episodeNumber} (5 MIN)
              </div>

              <p className="font-serif italic text-base sm:text-[17px] text-[#F3EFE6]/90 leading-relaxed">
                {pinnedEpisode.summary ||
                  "A five-minute Friday reflection for those who already know the headlines—separating cable-news panic from structural reality."}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-[#8A6D3B]/35 space-y-3.5">
              <button
                type="button"
                onClick={() => {
                  if (isPinnedActive) {
                    togglePlayPause();
                  } else {
                    playEpisode(pinnedEpisode, 0);
                  }
                }}
                className="w-full py-3.5 px-5 bg-[#C5A059] text-[#0B0E14] font-display text-xs sm:text-sm font-bold tracking-wider uppercase hover:bg-[#d4b26a] transition-colors cursor-pointer shadow-[0_4px_20px_rgba(197,160,89,0.25)]"
              >
                {isPinnedActive && isPlaying ? (
                  <span>
                    ⏸ Pause Weekly Brief (
                    <span className="font-mono font-semibold">
                      {pinnedEpisode.durationFormatted}
                    </span>
                    )
                  </span>
                ) : (
                  <span>
                    ▶ Listen to Weekly Brief (
                    <span className="font-mono font-semibold">
                      {pinnedEpisode.durationFormatted}
                    </span>
                    )
                  </span>
                )}
              </button>

              <div className="flex items-center justify-between gap-3 pt-1 text-xs">
                <Link
                  href="/archive"
                  className="font-serif text-sm text-[#F3EFE6] hover:text-[#C5A059] transition-colors"
                >
                  Read Full Transcript →
                </Link>
                <a
                  href="/feed.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-[#94A3B8] hover:text-[#C5A059] transition-colors"
                >
                  Podcast RSS (/feed.xml)
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. EDITORIAL FILTER RIBBON (Separated by ornate brass horizontal divider with centered compass-point diamond) */}
      <BrassSectionDivider />

      <section
        aria-label="Editorial Filter Ribbon"
        className="mb-9 pb-6 border-b border-[#8A6D3B]/40"
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-center gap-3.5 sm:gap-5">
          {/* 1. Working Tool Selector */}
          <div className="flex items-center gap-2.5 bg-[#111726]/80 border border-[#8A6D3B]/50 px-3.5 py-2">
            <label
              htmlFor="filter-working-tool"
              className="font-display text-[11px] uppercase tracking-wider text-[#C5A059] whitespace-nowrap"
            >
              Working Tool:
            </label>
            <select
              id="filter-working-tool"
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="bg-transparent font-serif text-sm text-[#F3EFE6] focus:outline-none cursor-pointer pr-2 w-full"
            >
              <option value="ALL" className="bg-[#0B0E14] text-[#F3EFE6]">
                All Working Tools
              </option>
              {WORKING_TOOL_OPTIONS.map((tool) => (
                <option
                  key={tool.value}
                  value={tool.value}
                  className="bg-[#0B0E14] text-[#F3EFE6]"
                >
                  {tool.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. System Failure Mode Selector */}
          <div className="flex items-center gap-2.5 bg-[#111726]/80 border border-[#8A6D3B]/50 px-3.5 py-2">
            <label
              htmlFor="filter-failure-mode"
              className="font-display text-[11px] uppercase tracking-wider text-[#C5A059] whitespace-nowrap"
            >
              System Failure Mode:
            </label>
            <select
              id="filter-failure-mode"
              value={selectedFailure}
              onChange={(e) => setSelectedFailure(e.target.value)}
              className="bg-transparent font-serif text-sm text-[#F3EFE6] focus:outline-none cursor-pointer pr-2 w-full"
            >
              <option value="ALL" className="bg-[#0B0E14] text-[#F3EFE6]">
                All Failure Modes
              </option>
              {FAILURE_MODE_OPTIONS.map((mode) => (
                <option
                  key={mode.value}
                  value={mode.value}
                  className="bg-[#0B0E14] text-[#F3EFE6]"
                >
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Sector Selector */}
          <div className="flex items-center gap-2.5 bg-[#111726]/80 border border-[#8A6D3B]/50 px-3.5 py-2">
            <label
              htmlFor="filter-sector"
              className="font-display text-[11px] uppercase tracking-wider text-[#C5A059] whitespace-nowrap"
            >
              Sector:
            </label>
            <select
              id="filter-sector"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-transparent font-serif text-sm text-[#F3EFE6] focus:outline-none cursor-pointer pr-2 w-full"
            >
              <option value="ALL" className="bg-[#0B0E14] text-[#F3EFE6]">
                All Sectors
              </option>
              {SECTOR_OPTIONS.map((sec) => (
                <option
                  key={sec.value}
                  value={sec.value}
                  className="bg-[#0B0E14] text-[#F3EFE6]"
                >
                  {sec.label}
                </option>
              ))}
            </select>
          </div>

          {(selectedTool !== "ALL" ||
            selectedFailure !== "ALL" ||
            selectedSector !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSelectedTool("ALL");
                setSelectedFailure("ALL");
                setSelectedSector("ALL");
              }}
              className="font-serif text-xs text-[#C5A059] hover:text-[#F3EFE6] underline cursor-pointer whitespace-nowrap px-2 py-1"
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

      {/* D. THE BROADSHEET STORY LAYOUT (1 Lead Story + 6 Two-Column Stories) */}
      {!leadIncident ? (
        <div className="tracing-board-frame p-10 text-center space-y-3">
          <p className="font-display text-lg text-[#F3EFE6]">
            No Broadsheet Dispatches Match the Selected Criteria
          </p>
          <p className="font-serif text-sm text-[#94A3B8]">
            Restore all Working Tools, Failure Modes, and Sectors to view the full weekly Trestleboard.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedTool("ALL");
              setSelectedFailure("ALL");
              setSelectedSector("ALL");
            }}
            className="px-4 py-2 bg-[#C5A059] text-[#0B0E14] font-display text-xs font-semibold uppercase tracking-wider cursor-pointer"
          >
            Restore All Dispatches
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* 1. The Lead Analysis (Full-Width 2-Column Span at Top of Feed) */}
          <article
            aria-label="Lead Broadsheet Analysis"
            className="relative bg-[#111726] border border-[#C5A059]/60 p-6 sm:p-8 lg:p-10 shadow-[0_14px_40px_rgba(0,0,0,0.6)]"
          >
            {/* Inset double-line hairline border */}
            <div className="pointer-events-none absolute inset-1.5 border border-[#8A6D3B]/45" />

            {/* Burnished Brass Corner Brackets */}
            <span className="pointer-events-none absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#C5A059]" />
            <span className="pointer-events-none absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#C5A059]" />
            <span className="pointer-events-none absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#C5A059]" />
            <span className="pointer-events-none absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#C5A059]" />

            <div className="relative z-10">
              {/* Dateline */}
              <div className="pb-3.5 mb-4 border-b border-[#8A6D3B]/45 font-mono text-xs uppercase tracking-[0.16em] text-[#94A3B8]">
                <span className="text-[#C5A059]">
                  {formatLeadDateline(leadIncident.publishedAt)}
                </span>
                <span className="mx-2.5 text-[#8A6D3B]">·</span>
                <span className="text-[#F3EFE6]">
                  SOURCE: {leadIncident.sourceFeed}
                </span>
                <span className="mx-2.5 text-[#8A6D3B]">·</span>
                <span>{leadIncident.domainSector.toUpperCase()}</span>
              </div>

              {/* Large Serif Headline */}
              <Link
                href={`/incidents/${leadIncident.slug}`}
                className="block group/lead"
              >
                <h2 className="font-display italic text-2xl sm:text-3xl lg:text-[32px] text-[#F3EFE6] group-hover/lead:text-[#C5A059] transition-colors leading-tight">
                  {leadIncident.title}
                </h2>
              </Link>

              {/* Two-Column Internal Split */}
              <div className="mt-6 pt-6 border-t border-[#8A6D3B]/35 grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-9 items-stretch">
                {/* Left (The Facts & Systems Lens) */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="font-display text-xs uppercase tracking-[0.18em] text-[#C5A059]">
                      The Facts &amp; Systems Lens
                    </div>
                    <p className="font-serif text-base sm:text-[17px] text-[#F3EFE6]/90 leading-relaxed">
                      {leadIncident.executiveSummary}
                    </p>
                  </div>

                  {/* Two clean, non-numerical diagnostic stamps */}
                  <div className="pt-4 border-t border-[#8A6D3B]/30 flex flex-wrap items-center gap-3 font-serif text-xs sm:text-sm">
                    <button
                      type="button"
                      onClick={() =>
                        openRubricInspector({ tool: leadIncident.primaryTool })
                      }
                      className="px-3 py-1.5 bg-[#0B0E14] border border-[#C5A059]/75 text-[#C5A059] hover:bg-[#C5A059]/15 transition-colors cursor-pointer"
                    >
                      [Working Tool: {leadIncident.primaryTool}]
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openRubricInspector({
                          failureMode: leadIncident.sreFailureMode,
                        })
                      }
                      className="px-3 py-1.5 bg-[#0B0E14] border border-[#8A6D3B]/75 text-[#F3EFE6] hover:border-[#C5A059] transition-colors cursor-pointer"
                    >
                      [Failure Mode:{" "}
                      {SHORT_FAILURE_LABELS[leadIncident.sreFailureMode] ||
                        leadIncident.sreFailureMode}
                      ]
                    </button>
                  </div>
                </div>

                {/* Right (The Trestleboard Inquiry) */}
                <div className="lg:col-span-6 flex flex-col justify-between bg-[#0B0E14]/75 border border-[#C5A059]/55 p-5 sm:p-6 relative">
                  <div className="pointer-events-none absolute inset-1 border border-[#8A6D3B]/30" />

                  <div className="relative z-10 space-y-4">
                    <div className="font-display text-xs uppercase tracking-[0.18em] text-[#C5A059] border-b border-[#8A6D3B]/35 pb-2">
                      The Trestleboard Inquiry
                    </div>

                    <div className="space-y-3.5">
                      {leadIncident.questions.slice(0, 2).map((q, idx) => (
                        <blockquote
                          key={idx}
                          className="pl-3.5 border-l-2 border-[#C5A059]/75 font-serif italic text-[15px] sm:text-base text-[#F3EFE6] leading-relaxed"
                        >
                          &ldquo;{q}&rdquo;
                        </blockquote>
                      ))}
                    </div>
                  </div>

                  <div className="relative z-10 pt-5 mt-5 border-t border-[#8A6D3B]/35 flex justify-end">
                    <Link
                      href={`/incidents/${leadIncident.slug}`}
                      className="font-serif text-sm sm:text-[15px] text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
                    >
                      Read Full Brief &amp; Inquiries →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* 2. The Secondary Broadsheet Grid (6 Stories in a Balanced 2-Column × 3-Row Grid) */}
          {secondaryIncidents.length > 0 && (
            <section aria-label="Secondary Broadsheet Dispatches">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">
                {secondaryIncidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            </section>
          )}

          {/* E. PAGINATION BUTTON */}
          <div className="pt-6 flex justify-center">
            <Link
              href="/knowledge-graph"
              className="relative inline-flex items-center justify-center px-8 py-4 bg-[#111726] border border-[#C5A059] text-[#F3EFE6] hover:bg-[#C5A059] hover:text-[#0B0E14] font-display text-xs sm:text-sm uppercase tracking-[0.15em] transition-all shadow-[inset_0_0_0_3px_#0B0E14,0_8px_24px_rgba(0,0,0,0.5)]"
            >
              Explore the Full Archive &amp; Knowledge Graph →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
