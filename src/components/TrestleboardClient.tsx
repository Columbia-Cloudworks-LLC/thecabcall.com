"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Radio,
  Filter,
  SlidersHorizontal,
  ArrowRight,
  ShieldCheck,
  Activity,
  ExternalLink,
} from "lucide-react";
import {
  DOMAIN_SECTORS,
  SRE_FAILURE_MODES,
  WORKING_TOOLS,
  WorkingToolId,
} from "@/lib/taxonomy";
import {
  IncidentArticle,
  PodcastEpisode,
  SystemPostureSummary,
} from "@/lib/types";
import { useTelemetry } from "./TelemetryContext";
import { IncidentCard } from "./IncidentCard";
import { BrassSectionDivider } from "./MasonicEngravings";

interface TrestleboardClientProps {
  initialIncidents: IncidentArticle[];
  posture: SystemPostureSummary;
  pinnedEpisode: PodcastEpisode;
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

  const filteredIncidents = initialIncidents.filter((inc) => {
    if (selectedTool !== "ALL" && inc.primaryTool !== selectedTool) return false;
    if (selectedFailure !== "ALL" && inc.sreFailureMode !== selectedFailure)
      return false;
    if (selectedSector !== "ALL" && inc.domainSector !== selectedSector)
      return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* 1. SYSTEM POSTURE HEADER (7-Day Macro-Telemetry Bar) */}
      <section
        aria-label="System Posture Header"
        className="tracing-board-frame p-5 sm:p-6 mb-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#8A6D3B]/35">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              <Activity className="w-3.5 h-3.5 text-[#10B981]" />
              <span>
                THE TRESTLEBOARD // 7-DAY MACRO SYSTEM POSTURE TELEMETRY
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-1">
              Active Civic &amp; Infrastructure Incident Command
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <div className="px-3 py-1.5 bg-[#0B0E14] border border-[#8A6D3B]/50">
              <span className="text-[#94A3B8]">EVALUATED (7D): </span>
              <strong className="text-[#F3EFE6]">
                {posture.totalEvaluatedWindow} RSS ITEMS
              </strong>
            </div>
            <div className="px-3 py-1.5 bg-[#0B0E14] border border-[#10B981]/40">
              <span className="text-[#94A3B8]">NOISE DROPPED: </span>
              <strong className="text-[#10B981]">
                {posture.noiseRejectionRate}%
              </strong>
            </div>
            <div className="px-3 py-1.5 bg-[#0B0E14] border border-[#C5A059]/50">
              <span className="text-[#94A3B8]">AVG JEV LATENCY: </span>
              <strong className="text-[#C5A059]">
                {posture.avgClassifierLatencyMs}ms
              </strong>
            </div>
          </div>
        </div>

        {/* Macro Posture KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          {/* Dominant Working Tool */}
          <div className="p-4 bg-[#0B0E14]/90 border border-[#C5A059]/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
                Dominant Working Tool (7D)
              </span>
              <button
                type="button"
                onClick={() =>
                  openRubricInspector({ tool: posture.dominantTool })
                }
                className="font-mono text-xs text-[#C5A059] hover:underline cursor-pointer"
              >
                Inspect [?]
              </button>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-display text-2xl text-[#C5A059]">
                {posture.dominantTool}
              </span>
              <span className="font-mono text-xl font-bold text-[#F3EFE6]">
                {posture.dominantToolPercentage}%
              </span>
            </div>
            <p className="font-mono text-[11px] text-[#94A3B8] mt-2">
              Primary moral diagnostic trigger across high-confidence events.
            </p>
          </div>

          {/* Top Recurring SRE Failure Mode */}
          <div className="p-4 bg-[#0B0E14]/90 border border-[#F59E0B]/45 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
                Recurring SRE Anti-Pattern
              </span>
              <button
                type="button"
                onClick={() =>
                  openRubricInspector({ failureMode: posture.topFailureMode })
                }
                className="font-mono text-xs text-[#F59E0B] hover:underline cursor-pointer"
              >
                Inspect [?]
              </button>
            </div>
            <div className="mt-2">
              <span className="font-display text-xl text-[#F3EFE6]">
                {posture.topFailureMode}
              </span>
            </div>
            <p className="font-mono text-[11px] text-[#F59E0B] mt-2">
              Divergence between filed compliance specs and production reality.
            </p>
          </div>

          {/* 6-Tool Telemetry Distribution Mini-Matrix */}
          <div className="p-4 bg-[#0B0E14]/90 border border-[#8A6D3B]/45">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
                Working Tool Distribution
              </span>
              <Link
                href="/knowledge-graph"
                className="font-mono text-[11px] text-[#C5A059] hover:underline"
              >
                Matrix View →
              </Link>
            </div>
            <div className="space-y-1.5">
              {posture.toolDistribution.slice(0, 4).map((item) => (
                <button
                  key={item.tool}
                  type="button"
                  onClick={() =>
                    setSelectedTool(
                      selectedTool === item.tool ? "ALL" : item.tool
                    )
                  }
                  className="w-full text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-[#F3EFE6] group-hover:text-[#C5A059]">
                      {item.tool}
                    </span>
                    <span className="text-[#C5A059]">{item.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#111726] mt-0.5 overflow-hidden">
                    <div
                      className="h-full bg-[#C5A059]"
                      style={{ width: `${Math.max(8, item.percentage)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. PINNED CAB WEEKLY BRIEF (5-Minute Friday Telemetry Rollup) */}
      <section
        aria-label="Pinned CAB Rollup"
        className="relative bg-[#111726] border-2 border-[#C5A059]/70 p-6 sm:p-7 mb-10 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#C5A059] text-[#0B0E14] font-semibold uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5" />
                PINNED FRIDAY CAB ROLLUP (5-MIN RETRO)
              </span>
              <span className="text-[#C5A059]">
                EPISODE #{pinnedEpisode.episodeNumber} •{" "}
                {pinnedEpisode.durationFormatted}
              </span>
              <span className="text-[#94A3B8]">|</span>
              <span className="text-[#10B981]">
                ZERO DEFINITIONS / EPISTEMIC HUMILITY VERIFIED
              </span>
            </div>

            <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] leading-snug">
              {pinnedEpisode.title}
            </h2>

            <p className="font-serif text-sm sm:text-base text-[#F3EFE6]/85 leading-relaxed max-w-4xl">
              {pinnedEpisode.summary}
            </p>

            {/* Clickable Incident Markers for this episode */}
            <div className="pt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="text-[#94A3B8] uppercase">
                Referenced Incidents:
              </span>
              {pinnedEpisode.incidentMarkers.map((marker) => (
                <Link
                  key={marker.incidentId}
                  href={`/incidents/${marker.incidentSlug}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0B0E14] border border-[#8A6D3B]/60 text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
                >
                  <span className="text-[#C5A059]">{marker.timecodeLabel}</span>
                  <span>{marker.incidentCode}</span>
                  <span className="text-[#94A3B8] hidden sm:inline">
                    ({marker.toolApplied})
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-75" />
                </Link>
              ))}
            </div>
          </div>

          {/* Right Action Column */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isPinnedActive) {
                  togglePlayPause();
                } else {
                  playEpisode(pinnedEpisode, 0);
                }
              }}
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#d6b36a] transition-colors cursor-pointer"
            >
              {isPinnedActive && isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause 5-Min CAB Brief</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play 5-Min CAB Brief ({pinnedEpisode.durationFormatted})</span>
                </>
              )}
            </button>

            <Link
              href="/archive"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0B0E14] border border-[#8A6D3B]/60 font-mono text-xs text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
            >
              <span>Read 3-Part Script &amp; Archive</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <BrassSectionDivider label="ACTIVE INCIDENT FEED // TRIAGE-FIRST TELEMETRY" />

      {/* 3. FILTER RIBBON FOR ACTIVE INCIDENT FEED */}
      <section aria-label="Incident Feed Filters" className="mb-7 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-[#C5A059] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter by Working Tool (Axis 1):</span>
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
              className="font-mono text-xs text-[#C5A059] hover:underline cursor-pointer"
            >
              Reset All Filters [×]
            </button>
          )}
        </div>

        {/* Working Tool Pill Bar */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedTool("ALL")}
            className={`px-3 py-1.5 font-mono text-xs border transition-colors cursor-pointer ${
              selectedTool === "ALL"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-semibold"
                : "bg-[#111726] text-[#94A3B8] border-[#8A6D3B]/45 hover:text-[#F3EFE6] hover:border-[#C5A059]/60"
            }`}
          >
            ALL TOOLS ({initialIncidents.length})
          </button>
          {WORKING_TOOLS.map((tool) => {
            const count = initialIncidents.filter(
              (i) => i.primaryTool === tool.id
            ).length;
            const active = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() =>
                  setSelectedTool(active ? "ALL" : (tool.id as WorkingToolId))
                }
                className={`px-3 py-1.5 font-mono text-xs border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-semibold"
                    : "bg-[#111726] text-[#F3EFE6] border-[#8A6D3B]/45 hover:border-[#C5A059]"
                }`}
              >
                {tool.numeral}. {tool.id} ({count})
              </button>
            );
          })}
        </div>

        {/* Secondary Axis Filters: SRE Failure Mode & Domain Sector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="flex items-center gap-2 bg-[#111726] border border-[#8A6D3B]/45 px-3 py-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
            <label
              htmlFor="failure-select"
              className="font-mono text-xs text-[#94A3B8] shrink-0"
            >
              SRE Failure Mode:
            </label>
            <select
              id="failure-select"
              value={selectedFailure}
              onChange={(e) => setSelectedFailure(e.target.value)}
              className="bg-transparent font-mono text-xs text-[#F3EFE6] focus:outline-none w-full"
            >
              <option value="ALL" className="bg-[#0B0E14]">
                All SRE Failure Modes
              </option>
              {SRE_FAILURE_MODES.map((f) => (
                <option key={f.id} value={f.id} className="bg-[#0B0E14]">
                  {f.shortCode} — {f.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#111726] border border-[#8A6D3B]/45 px-3 py-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
            <label
              htmlFor="sector-select"
              className="font-mono text-xs text-[#94A3B8] shrink-0"
            >
              Domain Sector:
            </label>
            <select
              id="sector-select"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-transparent font-mono text-xs text-[#F3EFE6] focus:outline-none w-full"
            >
              <option value="ALL" className="bg-[#0B0E14]">
                All Domain Sectors
              </option>
              {DOMAIN_SECTORS.map((s) => (
                <option key={s} value={s} className="bg-[#0B0E14]">
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 4. ACTIVE INCIDENT FEED GRID */}
      {filteredIncidents.length === 0 ? (
        <div className="tracing-board-frame p-10 text-center space-y-3">
          <p className="font-display text-lg text-[#F3EFE6]">
            No High-Signal Incidents Match Selected Diagnostic Axes
          </p>
          <p className="font-mono text-xs text-[#94A3B8]">
            Clear one or more filter axes or trigger a new ingestion pass from System Status.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedTool("ALL");
              setSelectedFailure("ALL");
              setSelectedSector("ALL");
            }}
            className="px-4 py-2 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-semibold uppercase cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredIncidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      )}
    </div>
  );
}
