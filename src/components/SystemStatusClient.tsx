"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Play,
  Radio,
  RefreshCw,
  Rss,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  formatCraftLedgerEntry,
  isRenderablePublicEpisode,
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  PublicEpisodeDto,
  PublicIncidentDto,
} from "@/lib/dto";
import { useTelemetry } from "./TelemetryContext";
import { BrassSectionDivider } from "./MasonicEngravings";

const SYNDICATED_SOURCED_FEEDS = [
  {
    name: "NPR News",
    category: "National & Civic Infrastructure",
    cadence: "Concurrent Scheduled Poll",
  },
  {
    name: "PBS NewsHour",
    category: "Public Policy & Institutional Governance",
    cadence: "Concurrent Scheduled Poll",
  },
  {
    name: "New York Times",
    category: "National & Global Dispatches",
    cadence: "Concurrent Scheduled Poll",
  },
  {
    name: "Wall Street Journal",
    category: "Markets, Supply Chain & Enterprise Operations",
    cadence: "Concurrent Scheduled Poll",
  },
  {
    name: "Ars Technica",
    category: "Systems Engineering, Cloud & Security",
    cadence: "Concurrent Scheduled Poll",
  },
];

export function SystemStatusClient() {
  const { playEpisode, refreshTelemetry } = useTelemetry();

  const [isRunningSweep, setIsRunningSweep] = useState(false);
  const [isRunningSynthesize, setIsRunningSynthesize] = useState(false);
  const [isRunningRollup, setIsRunningRollup] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [createdIncident, setCreatedIncident] =
    useState<PublicIncidentDto | null>(null);
  const [createdRollupEpisode, setCreatedRollupEpisode] =
    useState<PublicEpisodeDto | null>(null);

  const [customTitle, setCustomTitle] = useState(
    "Cloud Provider Regional Control Plane Outage Traced to Unreviewed Automated BGP Policy Push"
  );
  const [customDesc, setCustomDesc] = useState(
    "An automated configuration management rollout bypassed canary validation gates during a peak traffic window, withdrawing BGP route announcements for twelve availability zones while synthetic status dashboards continued reporting all-green."
  );
  const [customSource, setCustomSource] = useState("REUTERS // INFRASTRUCTURE");
  const [isSimulatingCustom, setIsSimulatingCustom] = useState(false);

  const handleTriggerRssCron = async () => {
    setIsRunningSweep(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/cron/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "ingest" }),
      });
      if (res.ok) {
        const data = await res.json();
        const candidate = data.createdIncidents?.[0];
        if (candidate && isRenderablePublicIncident(candidate)) {
          setCreatedIncident(mapDtoToCraftLexicon(candidate));
        }
        setStatusBanner(
          "Completed concurrent source sweep and diagnostic classification."
        );
      }
      await refreshTelemetry();
    } finally {
      setIsRunningSweep(false);
    }
  };

  const handleTriggerSynthesize = async () => {
    setIsRunningSynthesize(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/cron/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "synthesize", limit: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        const candidate = data.createdIncidents?.[0];
        if (candidate && isRenderablePublicIncident(candidate)) {
          setCreatedIncident(mapDtoToCraftLexicon(candidate));
        }
        setStatusBanner(
          "Completed Socratic editorial synthesis for triaged dispatches."
        );
      }
      await refreshTelemetry();
    } finally {
      setIsRunningSynthesize(false);
    }
  };

  const handleTriggerWeeklyRollup = async () => {
    setIsRunningRollup(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/cron/weekly-rollup", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.episode && isRenderablePublicEpisode(data.episode)) {
          setCreatedRollupEpisode(mapDtoToCraftLexicon(data.episode));
        }
        setStatusBanner(
          `Prepared Friday CAB Weekly Brief #${data.episode?.episodeNumber || 43}.`
        );
      }
      await refreshTelemetry();
    } finally {
      setIsRunningRollup(false);
    }
  };

  const handleRunCustomClassification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    setIsSimulatingCustom(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/cron/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customArticle: {
            title: customTitle,
            description: customDesc,
            sourceFeed: customSource,
            link: `https://thecabcall.com/live-sim/${Date.now()}`,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const candidate = data.createdIncidents?.[0];
        if (candidate && isRenderablePublicIncident(candidate)) {
          setCreatedIncident(mapDtoToCraftLexicon(candidate));
        }
        setStatusBanner(
          "Synthesized and verified Structural Inspection for custom case."
        );
      }
      await refreshTelemetry();
    } finally {
      setIsSimulatingCustom(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Masthead & Editorial Colophon */}
      <div className="tracing-board-frame p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#8A6D3B]/40">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              ABOUT &amp; FEEDS // EDITORIAL CHARTER &amp; SYNDICATION LEDGER
            </span>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6] mt-1">
              Editorial Governance &amp; Syndicated Dispatches
            </h1>
            <p className="font-serif text-sm sm:text-base text-[#94A3B8] mt-2 max-w-3xl leading-relaxed">
              The Change Advisory Board examines current events as active civic and institutional cases awaiting complete structural inspection—pairing Site Reliability Engineering failure analysis with the Six Working Tools of Freemasonry.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B0E14] border border-[#C5A059] font-mono text-xs text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0B0E14] transition-colors"
            >
              <Rss className="w-3.5 h-3.5" />
              <span>Subscribe via RSS (/feed.xml)</span>
            </a>
          </div>
        </div>

        {/* Inbound Syndicated Sources Grid */}
        <div className="mt-6">
          <div className="font-mono text-xs uppercase tracking-wider text-[#C5A059] mb-3">
            Primary Sourced Publications (Concurrent Scheduled Polling)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {SYNDICATED_SOURCED_FEEDS.map((feed) => (
              <div
                key={feed.name}
                className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="font-display text-base text-[#F3EFE6]">
                    {feed.name}
                  </div>
                  <p className="font-serif text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    {feed.category}
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] pt-2 border-t border-[#8A6D3B]/30">
                  {feed.cadence}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editorial Workflow & Dispatch Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Left: Four-Stage Editorial Methodology (7 cols) */}
        <div className="lg:col-span-7 tracing-board-frame p-6 sm:p-7 space-y-5">
          <div className="flex flex-col gap-3 border-b border-[#8A6D3B]/35 pb-4">
            <div>
              <span className="font-mono text-xs text-[#C5A059] uppercase">
                EDITORIAL METHODOLOGY // SOURCED TRIAGE &amp; SOCRATIC REVIEW
              </span>
              <h2 className="font-display text-xl text-[#F3EFE6] mt-0.5">
                Four-Stage Structural Inspection Discipline
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleTriggerRssCron}
                disabled={
                  isRunningSweep || isRunningSynthesize || isRunningRollup
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#C5A059] text-[#0B0E14] font-mono text-[11px] font-bold uppercase hover:bg-[#d6b36a] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isRunningSweep ? "animate-spin" : ""
                  }`}
                />
                <span>
                  {isRunningSweep ? "Polling Sourced Publications..." : "Poll Sourced Publications"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTriggerSynthesize}
                disabled={
                  isRunningSweep || isRunningSynthesize || isRunningRollup
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#111726] border border-[#C5A059]/75 text-[#F3EFE6] font-mono text-[11px] font-bold uppercase hover:bg-[#C5A059]/15 transition-colors cursor-pointer disabled:opacity-50"
              >
                <BookOpen
                  className={`w-3.5 h-3.5 ${
                    isRunningSynthesize ? "animate-pulse" : ""
                  }`}
                />
                <span>
                  {isRunningSynthesize
                    ? "Drafting Craftsman's Briefs..."
                    : "Draft Craftsman's Briefs"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTriggerWeeklyRollup}
                disabled={
                  isRunningSweep || isRunningSynthesize || isRunningRollup
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#111726] border border-[#C5A059]/75 text-[#C5A059] font-mono text-[11px] font-bold uppercase hover:bg-[#C5A059]/15 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Radio
                  className={`w-3.5 h-3.5 ${
                    isRunningRollup ? "animate-pulse" : ""
                  }`}
                />
                <span>
                  {isRunningRollup
                    ? "Preparing Friday CAB Brief..."
                    : "Friday Weekly Rollup"}
                </span>
              </button>
            </div>

            {statusBanner && (
              <div className="p-3 bg-[#0B0E14] border border-[#C5A059]/50 font-serif text-sm text-[#F3EFE6] flex items-center justify-between gap-3">
                <span>{statusBanner}</span>
              </div>
            )}

            {createdRollupEpisode && (
              <div className="p-3.5 bg-[#0B0E14] border border-[#C5A059]/65 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-mono text-[11px] text-[#C5A059]">
                    WEEKLY BRIEF EPISODE #{createdRollupEpisode.episodeNumber}
                  </div>
                  <div className="font-display text-sm text-[#F3EFE6]">
                    {createdRollupEpisode.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => playEpisode(createdRollupEpisode, 0)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase cursor-pointer shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Listen Now</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                I
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  Concurrent Sourced Ingestion &amp; Canonical De-duplication
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Target dispatches are polled concurrently under strict byte and timeout bounds, stripped of unsafe markup and tracking parameters, and fingerprinted via canonical URL and GUID hashing.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#C5A059]/60 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                II
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  Dual-Axis Structural Triage
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Each candidate dispatch is evaluated for structural signal versus transient commentary and paired with its primary Masonic Working Tool and Structural Failure Mode.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                III
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  Bounded Socratic Structural Inspection
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Synthesizes unvarnished factual summaries, separates partisan heat and spin from the actual structural foundation, and poses open Socratic verification questions.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                IV
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  The Friday CAB Weekly Brief
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Every Friday, the week&rsquo;s anchor dispatches are distilled into a 5-minute spoken retrospective and syndicated via the public RSS 2.0 podcast feed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Editorial Dispatch Desk (5 cols) */}
        <div className="lg:col-span-5 tracing-board-frame p-6 sm:p-7 space-y-4">
          <div className="border-b border-[#8A6D3B]/35 pb-3">
            <span className="font-mono text-xs text-[#C5A059] uppercase">
              THE CRAFTSMAN&apos;S BRIEF // CUSTOM CASE SUBMISSION
            </span>
            <h2 className="font-display text-xl text-[#F3EFE6] mt-0.5">
              Submit Event for Structural Inspection
            </h2>
            <p className="font-serif text-sm text-[#94A3B8] mt-1">
              Submit a sourced headline and factual summary below to draft and verify a new Craftsman&apos;s Brief for the Trestleboard.
            </p>
          </div>

          <form onSubmit={handleRunCustomClassification} className="space-y-3.5">
            <div>
              <label className="font-mono text-[11px] uppercase text-[#C5A059] block mb-1">
                Source Attribution
              </label>
              <input
                type="text"
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/50 px-3 py-2 font-mono text-xs text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-mono text-[11px] uppercase text-[#C5A059] block mb-1">
                Event Headline
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/50 px-3 py-2 font-serif text-sm text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-mono text-[11px] uppercase text-[#C5A059] block mb-1">
                Factual Event Summary
              </label>
              <textarea
                rows={4}
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/50 p-3 font-serif text-sm text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSimulatingCustom}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#d6b36a] transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isSimulatingCustom
                  ? "Drafting Structural Inspection..."
                  : "Draft & Publish Craftsman's Brief"}
              </span>
            </button>
          </form>

          {createdIncident && isRenderablePublicIncident(createdIncident) && (
            <div className="p-4 bg-[#0B0E14] border border-[#C5A059] space-y-2 mt-4">
              <div className="flex items-center justify-between font-mono text-xs text-[#C5A059]">
                <span>{createdIncident.primaryTool}</span>
                <span className="text-[11px] text-[#94A3B8]">
                  {formatCraftLedgerEntry(createdIncident.incidentCode)}
                </span>
              </div>
              <p className="font-display text-sm text-[#F3EFE6]">
                {createdIncident.title}
              </p>
              <div className="flex items-center justify-between font-mono text-xs pt-1">
                <span className="text-[#94A3B8]">
                  {createdIncident.sreFailureMode}
                </span>
                <Link
                  href={`/incidents/${createdIncident.slug}`}
                  className="inline-flex items-center gap-1 text-[#C5A059] hover:underline"
                >
                  <span>Read Full Brief</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <BrassSectionDivider label="EDITORIAL GOVERNANCE CHARTER" />

      {/* Governance Charter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="tracing-board-frame p-6 space-y-3">
          <div className="font-mono text-xs text-[#C5A059] uppercase">
            CHARTER RULE 01 // ZERO DEFINITIONS
          </div>
          <h3 className="font-display text-lg text-[#F3EFE6]">
            Never Lecture the Craft
          </h3>
          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            Weekly rollup scripts and incident briefs are strictly forbidden from reciting monitorial definitions of the Working Tools or basic SRE acronyms. Tools are invoked as operational verbs and diagnostic instruments that the audience speaks natively.
          </p>
        </div>

        <div className="tracing-board-frame p-6 space-y-3">
          <div className="font-mono text-xs text-[#C5A059] uppercase">
            CHARTER RULE 02 // EPISTEMIC HUMILITY
          </div>
          <h3 className="font-display text-lg text-[#F3EFE6]">
            The &ldquo;Pending Post-Mortem&rdquo; Rule
          </h3>
          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            The board never declares a partisan villain or predicts catastrophic outcomes. Ongoing stories are framed as active incidents with incomplete telemetry—highlighting what data is missing and what Socratic questions will prove whether the system is recovering.
          </p>
        </div>

        <div className="tracing-board-frame p-6 space-y-3">
          <div className="font-mono text-xs text-[#C5A059] uppercase">
            CHARTER RULE 03 // PROPORTIONALITY CHECK
          </div>
          <h3 className="font-display text-lg text-[#F3EFE6]">
            Isolate Jitter from Capacity
          </h3>
          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            Every synthesized brief must explicitly separate one sensationalized detail the news cycle is overblowing (alert noise/jitter) from the underlying structural or architectural constraint (signal/capacity).
          </p>
        </div>
      </div>
    </div>
  );
}
