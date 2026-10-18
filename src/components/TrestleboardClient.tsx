"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  SreFailureModeId,
  WorkingToolId,
} from "@/lib/taxonomy";
import {
  isRenderablePublicEpisode,
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  PublicEpisodeDto,
  PublicIncidentDto,
} from "@/lib/dto";
import {
  IncidentArticle,
  PodcastEpisode,
  WeeklyTrestleboardState,
} from "@/lib/types";
import { useTelemetry } from "./TelemetryContext";
import { IncidentCard } from "./IncidentCard";
import {
  BrassSectionDivider,
  MasonSquareWatermark,
} from "./MasonicEngravings";

interface TrestleboardClientProps {
  initialIncidents: Array<PublicIncidentDto | IncidentArticle>;
  weeklyState: WeeklyTrestleboardState;
  pinnedEpisode: PublicEpisodeDto | PodcastEpisode;
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
  {
    value: "Configuration Drift",
    label: "Drifting Off-Square (Configuration Drift)",
  },
  {
    value: "Cascading Failure",
    label: "Chain-Reaction Breakdown (Cascading Failure)",
  },
  {
    value: "Alert Fatigue & Signal Loss",
    label: "Crying Wolf / Drowning in Noise (Alert Fatigue)",
  },
  {
    value: "Single Point of Failure (SPOF) / Untested Failover",
    label: "One Weak Link / Untested Backup (Single Point of Failure)",
  },
  {
    value: "Blame Culture vs. Root-Cause Isolation",
    label: "Scapegoating vs. Fixing the Trap (Blame Culture)",
  },
  {
    value: "Technical & Institutional Debt",
    label: "Deferred Maintenance (Institutional Debt)",
  },
];

const SHORT_FAILURE_LABELS: Record<SreFailureModeId, string> = {
  "Configuration Drift": "Drifting Off-Square",
  "Cascading Failure": "Chain-Reaction Breakdown",
  "Alert Fatigue & Signal Loss": "Crying Wolf / Drowning in Noise",
  "Single Point of Failure (SPOF) / Untested Failover":
    "One Weak Link / Untested Backup",
  "Blame Culture vs. Root-Cause Isolation": "Scapegoating vs. Fixing the Trap",
  "Technical & Institutional Debt": "Deferred Maintenance",
  "Structural Friction": "Structural Friction",
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
  weeklyState,
  pinnedEpisode: rawPinnedEpisode,
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

  const pinnedEpisode = mapDtoToCraftLexicon(rawPinnedEpisode);
  const isPinnedActive = activeEpisode.id === pinnedEpisode.id;
  const isPinnedEpisodeRenderable = isRenderablePublicEpisode(pinnedEpisode);

  const validIncidents = initialIncidents
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  const filteredIncidents = validIncidents.filter((inc) => {
    if (selectedTool !== "ALL" && inc.primaryTool !== selectedTool) return false;
    if (selectedFailure !== "ALL" && inc.sreFailureMode !== selectedFailure)
      return false;
    return true;
  });

  // Only render a full-width Featured Incident card if a record is explicitly flagged
  // as the week's "Lead Post-Mortem" with bespoke multi-paragraph analysis.
  const leadPostMortemIncident =
    filteredIncidents.find(
      (inc) =>
        Boolean(inc.isLeadPostMortem) &&
        typeof inc.leadPostMortemAnalysis === "string" &&
        inc.leadPostMortemAnalysis.trim().split(/\n\s*\n/).length >= 2
    ) || null;

  const gridIncidents = leadPostMortemIncident
    ? filteredIncidents
        .filter((inc) => inc.id !== leadPostMortemIncident.id)
        .slice(0, 8)
    : filteredIncidents.slice(0, 8);

  const resetFilters = () => {
    setSelectedTool("ALL");
    setSelectedFailure("ALL");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* B. THE WEEKLY TRESTLEBOARD & PODCAST FEATURE (SPLIT ASYMMETRIC HERO) */}
      <section
        id="weekly-brief"
        aria-label="The Weekly Trestleboard & Podcast Feature"
        className="relative bg-[#111726] border border-[#C5A059]/65 shadow-[0_16px_48px_rgba(0,0,0,0.65)] scroll-mt-20"
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
          <div className="relative lg:w-[65%] p-6 sm:p-8 lg:p-10 overflow-hidden flex flex-col justify-between">
            {/* Subtle 10% opacity copperplate vector engraving of a Mason's Square */}
            <div className="pointer-events-none select-none absolute -bottom-6 -right-4 opacity-10">
              <MasonSquareWatermark className="w-64 h-64 sm:w-72 sm:h-72" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
                WEEK OF {formatLeadDateline(weeklyState.publishedAt)} // WEEKLY SYSTEMS RETROSPECTIVE
              </div>

              <h2 className="font-display italic text-2xl sm:text-3xl lg:text-[32px] text-[#F3EFE6] leading-tight">
                {weeklyState.heroTitle}
              </h2>

              {/* Synchronized Editorial Lenses from Weekly Trestleboard State */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() =>
                    openRubricInspector({ tool: weeklyState.dominantTool })
                  }
                  className="px-2.5 py-1 bg-[#0B0E14] border border-[#C5A059]/75 text-[#C5A059] hover:bg-[#C5A059]/15 transition-colors cursor-pointer"
                >
                  DOMINANT TOOL: {weeklyState.dominantTool.toUpperCase()}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openRubricInspector({
                      failureMode: weeklyState.primaryFailureMode,
                    })
                  }
                  className="px-2.5 py-1 bg-[#0B0E14] border border-[#8A6D3B]/75 text-[#F3EFE6] hover:border-[#C5A059] transition-colors cursor-pointer"
                >
                  PRIMARY FAILURE MODE:{" "}
                  {(
                    SHORT_FAILURE_LABELS[weeklyState.primaryFailureMode] ||
                    weeklyState.primaryFailureMode
                  ).toUpperCase()}
                </button>
              </div>

              <p className="font-serif text-base sm:text-[17px] text-[#F3EFE6]/90 leading-relaxed pt-1">
                {weeklyState.heroOpeningProse}
              </p>
            </div>
          </div>

          {/* Right Column (35% Width) — The Friday CAB Call (Audio Feature + Weekly Docket) */}
          <div className="lg:w-[35%] p-6 sm:p-8 lg:p-10 border-t lg:border-t-0 lg:border-l border-[#C5A059]/35 bg-[#0B0E14]/35 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#C5A059]">
                THE CAB CALL // EPISODE #{weeklyState.episodeNumber} (5 MIN)
              </div>

              <p className="font-serif italic text-sm sm:text-[15px] text-[#F3EFE6]/90 leading-relaxed">
                {weeklyState.podcastDescription}
              </p>

              {/* Compact 3-Item Bulleted Weekly Docket Eliminating Vertical Dead Space */}
              {weeklyState.anchorIncidents.length > 0 && (
                <div className="pt-3 border-t border-[#8A6D3B]/35 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
                    Weekly Docket // 3 Anchor Incidents
                  </div>
                  <ul className="space-y-2">
                    {weeklyState.anchorIncidents.slice(0, 3).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 text-xs leading-snug"
                      >
                        <span className="text-[#C5A059] font-mono mt-0.5 select-none">
                          •
                        </span>
                        <Link
                          href={`/incidents/${item.slug}`}
                          className="font-serif text-[#F3EFE6]/90 hover:text-[#C5A059] transition-colors line-clamp-2"
                        >
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-5 mt-5 border-t border-[#8A6D3B]/35 space-y-3.5">
              {isPinnedEpisodeRenderable && (
                <button
                  type="button"
                  onClick={() => {
                    if (isPinnedActive) {
                      togglePlayPause();
                    } else {
                      playEpisode(pinnedEpisode as PodcastEpisode, 0);
                    }
                  }}
                  className="w-full py-3.5 px-5 bg-[#C5A059] text-[#0B0E14] font-display text-xs sm:text-sm font-bold tracking-wider uppercase hover:bg-[#d4b26a] transition-colors cursor-pointer shadow-[0_4px_20px_rgba(197,160,89,0.25)]"
                >
                  {isPinnedActive && isPlaying ? (
                    <span>
                      ⏸ Pause Weekly Brief (
                      <span className="font-mono font-semibold">
                        {weeklyState.durationFormatted}
                      </span>
                      )
                    </span>
                  ) : (
                    <span>
                      ▶ Listen to Weekly Brief (
                      <span className="font-mono font-semibold">
                        {weeklyState.durationFormatted}
                      </span>
                      )
                    </span>
                  )}
                </button>
              )}

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

      {/* C. EDITORIAL FILTER RIBBON */}
      <BrassSectionDivider />

      <section
        id="active-dispatches"
        aria-label="Editorial Filter Ribbon"
        className="mb-9 pb-6 border-b border-[#8A6D3B]/40 scroll-mt-20"
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

          {(selectedTool !== "ALL" || selectedFailure !== "ALL") && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-serif text-xs text-[#C5A059] hover:text-[#F3EFE6] underline cursor-pointer whitespace-nowrap px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </section>

      {/* D. THE TRESTLEBOARD INCIDENT GRID (Or Empty Filter State) */}
      {filteredIncidents.length === 0 ? (
        <div
          role="status"
          className="relative bg-[#111726] border border-[#C5A059]/75 p-10 text-center space-y-4 shadow-[0_12px_36px_rgba(0,0,0,0.55)]"
        >
          <div className="pointer-events-none absolute inset-1.5 border border-[#8A6D3B]/45" />
          <span className="pointer-events-none absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-[#C5A059]" />
          <span className="pointer-events-none absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-[#C5A059]" />
          <span className="pointer-events-none absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-[#C5A059]" />
          <span className="pointer-events-none absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-[#C5A059]" />

          <div className="relative z-10 space-y-3 max-w-lg mx-auto">
            <p className="font-display text-lg text-[#F3EFE6]">
              No Active Incidents Match the Selected Filter Combination
            </p>
            <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
              No verified dispatches on the Trestleboard simultaneously match{" "}
              <span className="text-[#C5A059]">
                {selectedTool === "ALL" ? "All Working Tools" : selectedTool}
              </span>{" "}
              and{" "}
              <span className="text-[#C5A059]">
                {selectedFailure === "ALL"
                  ? "All Failure Modes"
                  : SHORT_FAILURE_LABELS[selectedFailure as SreFailureModeId] ||
                    selectedFailure}
              </span>
              .
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={resetFilters}
                className="px-5 py-2.5 bg-[#C5A059] text-[#0B0E14] font-display text-xs font-semibold uppercase tracking-wider hover:bg-[#d4b26a] transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Optional Lead Post-Mortem Slot: ONLY rendered if explicitly flagged with bespoke multi-paragraph analysis */}
          {leadPostMortemIncident && (
            <article
              aria-label="Lead Post-Mortem Analysis"
              className="relative bg-[#111726] border border-[#C5A059]/60 p-6 sm:p-8 lg:p-10 shadow-[0_14px_40px_rgba(0,0,0,0.6)]"
            >
              <div className="pointer-events-none absolute inset-1.5 border border-[#8A6D3B]/45" />
              <span className="pointer-events-none absolute top-1 left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#C5A059]" />
              <span className="pointer-events-none absolute top-1 right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#C5A059]" />
              <span className="pointer-events-none absolute bottom-1 left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#C5A059]" />
              <span className="pointer-events-none absolute bottom-1 right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#C5A059]" />

              <div className="relative z-10 space-y-4">
                <div className="pb-3.5 border-b border-[#8A6D3B]/45 font-mono text-xs uppercase tracking-[0.16em] text-[#94A3B8] flex items-center justify-between">
                  <div>
                    <span className="text-[#C5A059]">
                      {formatLeadDateline(leadPostMortemIncident.publishedAt)}
                    </span>
                    <span className="mx-2 text-[#8A6D3B]">•</span>
                    <span className="text-[#F3EFE6]">
                      {leadPostMortemIncident.sourceFeed}
                    </span>
                  </div>
                  <span className="text-[#C5A059]">LEAD POST-MORTEM</span>
                </div>

                <Link
                  href={`/incidents/${leadPostMortemIncident.slug}`}
                  className="block group/lead"
                >
                  <h2 className="font-display italic text-2xl sm:text-3xl lg:text-[32px] text-[#F3EFE6] group-hover/lead:text-[#C5A059] transition-colors leading-tight">
                    {leadPostMortemIncident.title}
                  </h2>
                </Link>

                <div className="font-serif text-base sm:text-[17px] text-[#F3EFE6]/90 leading-relaxed space-y-4">
                  {leadPostMortemIncident.leadPostMortemAnalysis
                    ?.split(/\n\s*\n/)
                    .map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                </div>

                <div className="pt-4 border-t border-[#8A6D3B]/35 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-serif">
                    <button
                      type="button"
                      onClick={() =>
                        openRubricInspector({
                          tool: leadPostMortemIncident.primaryTool,
                        })
                      }
                      className="px-2.5 py-1 bg-[#0B0E14] border border-[#C5A059]/60 text-[#C5A059] hover:bg-[#C5A059]/15 transition-colors cursor-pointer"
                    >
                      [{leadPostMortemIncident.primaryTool}]
                    </button>
                    <span className="text-[#8A6D3B] font-bold">·</span>
                    <button
                      type="button"
                      onClick={() =>
                        openRubricInspector({
                          failureMode: leadPostMortemIncident.sreFailureMode,
                        })
                      }
                      className="px-2.5 py-1 bg-[#0B0E14] border border-[#8A6D3B]/55 text-[#94A3B8] hover:text-[#F3EFE6] hover:border-[#C5A059]/60 transition-colors cursor-pointer"
                    >
                      [
                      {SHORT_FAILURE_LABELS[
                        leadPostMortemIncident.sreFailureMode
                      ] || leadPostMortemIncident.sreFailureMode}
                      ]
                    </button>
                  </div>
                  <Link
                    href={`/incidents/${leadPostMortemIncident.slug}`}
                    className="font-serif text-sm text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
                  >
                    Read Brief →
                  </Link>
                </div>
              </div>
            </article>
          )}

          {/* 2-Column Incident Grid */}
          <section
            id="systemic-trends"
            aria-label="Trestleboard Incident Grid"
            className="scroll-mt-20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">
              {gridIncidents.map((incident) => (
                <IncidentCard key={incident.id} incident={incident} />
              ))}
            </div>
          </section>

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

