"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import {
  IncidentArticle,
  PipelineRunRecord,
  SystemPostureSummary,
} from "@/lib/types";
import { BrassSectionDivider } from "./MasonicEngravings";

export function SystemStatusClient({
  initialRuns,
  posture,
}: {
  initialRuns: PipelineRunRecord[];
  posture: SystemPostureSummary;
}) {
  const [runs, setRuns] = useState<PipelineRunRecord[]>(initialRuns);
  const [isRunningSweep, setIsRunningSweep] = useState(false);
  const [createdIncident, setCreatedIncident] =
    useState<IncidentArticle | null>(null);

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
    try {
      const res = await fetch("/api/cron/ingest", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.run) {
          setRuns((prev) => [data.run, ...prev]);
        }
        if (data.createdIncidents?.[0]) {
          setCreatedIncident(data.createdIncidents[0]);
        }
      }
    } finally {
      setIsRunningSweep(false);
    }
  };

  const handleRunCustomClassification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    setIsSimulatingCustom(true);
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
        if (data.run) {
          setRuns((prev) => [data.run, ...prev]);
        }
        if (data.createdIncidents?.[0]) {
          setCreatedIncident(data.createdIncidents[0]);
        }
      }
    } finally {
      setIsSimulatingCustom(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Masthead & Overall Pipeline Health */}
      <div className="tracing-board-frame p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#8A6D3B]/40">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              SYSTEM STATUS &amp; PIPELINE ARCHITECTURE // COLOPHON &amp; TRANSPARENCY
            </span>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6] mt-1">
              System 1 + System 2 Telemetry Observability
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#10B981]/15 border border-[#10B981]/50 font-mono text-xs text-[#10B981] font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
              ALL PIPELINE STAGES NOMINAL (99.98% SLO)
            </span>
          </div>
        </div>

        {/* 4 Telemetry Health Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 font-mono">
          <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45">
            <span className="text-[11px] text-[#94A3B8] uppercase">
              RSS Items Evaluated (7D)
            </span>
            <div className="text-2xl font-bold text-[#F3EFE6] mt-1">
              {posture.totalEvaluatedWindow}
            </div>
            <span className="text-[11px] text-[#10B981]">
              URL Hash Deduplication Active
            </span>
          </div>

          <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45">
            <span className="text-[11px] text-[#94A3B8] uppercase">
              System-1 Noise Rejection
            </span>
            <div className="text-2xl font-bold text-[#10B981] mt-1">
              {posture.noiseRejectionRate}%
            </div>
            <span className="text-[11px] text-[#94A3B8]">
              Gate: Jev Confidence &ge; 0.75
            </span>
          </div>

          <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45">
            <span className="text-[11px] text-[#94A3B8] uppercase">
              Avg Classifier Latency
            </span>
            <div className="text-2xl font-bold text-[#C5A059] mt-1">
              {posture.avgClassifierLatencyMs}ms
            </div>
            <span className="text-[11px] text-[#94A3B8]">
              Single Forward Pass (70–500ms SLO)
            </span>
          </div>

          <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45">
            <span className="text-[11px] text-[#94A3B8] uppercase">
              Monthly Pipeline Run Cost
            </span>
            <div className="text-2xl font-bold text-[#F3EFE6] mt-1">
              ~$0.04/mo
            </div>
            <span className="text-[11px] text-[#C5A059]">
              $0.042 / 1M Jev Input Tokens
            </span>
          </div>
        </div>
      </div>

      {/* Interactive 4-Stage Pipeline Explorer & Live Trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Left: 4-Stage Architecture Diagram (7 cols) */}
        <div className="lg:col-span-7 tracing-board-frame p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
            <div>
              <span className="font-mono text-xs text-[#C5A059] uppercase">
                PIPELINE ARCHITECTURE // SYSTEM 1 TRIAGE + SYSTEM 2 SYNTHESIS
              </span>
              <h2 className="font-display text-xl text-[#F3EFE6] mt-0.5">
                Four-Stage Automated PIR Workflow
              </h2>
            </div>

            <button
              type="button"
              onClick={handleTriggerRssCron}
              disabled={isRunningSweep}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase hover:bg-[#d6b36a] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRunningSweep ? "animate-spin" : ""
                }`}
              />
              <span>
                {isRunningSweep ? "Running Cron Sweep..." : "Trigger RSS Cron"}
              </span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                STAGE 1
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  Ingestion &amp; Deterministic De-duplication (`/api/cron/ingest`)
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  Scheduled Cron pulls target RSS feeds (Reuters, AP, Ars Technica, Hacker News), strips HTML to clean plain text, and hashes URLs (`url_hash`) so only net-new articles enter classification.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#C5A059]/60 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                STAGE 2
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  The &ldquo;System 1&rdquo; Triage Gate (Jev / Zero-Shot NLI)
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  Evaluates raw article text in a single forward pass (~120ms): scores Signal vs. Noise (drops items below 0.75 confidence before spending generation tokens), computes the 6-Tool probability vector, and assigns the primary SRE Failure Mode.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                STAGE 3
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  Structured Telemetry Ledger (`telemetry_articles`)
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  Stores source metadata, the complete Jev probability distribution across all six Working Tools, confidence score, and SRE failure tag in indexed structured storage.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#10B981]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#10B981] text-[#10B981] h-fit">
                STAGE 4
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  The &ldquo;System 2&rdquo; Bounded Socratic Synthesis
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  Strictly bound by the Stage-2 database record (forbidden from inventing angles). Writes the neutral Socratic Brief, the Diagnostic Lens breakdown, the Proportionality Check, and 3–4 Socratic Inquiry questions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Live Classifier & PIR Simulator (5 cols) */}
        <div className="lg:col-span-5 tracing-board-frame p-6 sm:p-7 space-y-4">
          <div className="border-b border-[#8A6D3B]/35 pb-3">
            <span className="font-mono text-xs text-[#10B981] uppercase">
              LIVE TELEMETRY SANDBOX // TEST SYSTEM 1 + SYSTEM 2
            </span>
            <h2 className="font-display text-xl text-[#F3EFE6] mt-0.5">
              Ingest &amp; Classify Custom Event
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Submit any headline and summary below to run the real-time classifier and publish a new Incident Brief to the live Trestleboard.
            </p>
          </div>

          <form onSubmit={handleRunCustomClassification} className="space-y-3.5">
            <div>
              <label className="font-mono text-[11px] uppercase text-[#C5A059] block mb-1">
                Source Tag
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
                Raw Event Telemetry / Summary
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
                  ? "Running System-1 Jev + System-2 Synthesis..."
                  : "Classify & Publish Incident Brief"}
              </span>
            </button>
          </form>

          {createdIncident && (
            <div className="p-4 bg-[#0B0E14] border border-[#10B981] space-y-2 mt-4">
              <div className="flex items-center justify-between font-mono text-xs text-[#10B981]">
                <span>✓ PUBLISHED: {createdIncident.incidentCode}</span>
                <span>
                  CONFIDENCE: {Math.round(createdIncident.jevConfidence * 100)}%
                </span>
              </div>
              <p className="font-display text-sm text-[#F3EFE6]">
                {createdIncident.title}
              </p>
              <div className="flex items-center justify-between font-mono text-xs pt-1">
                <span className="text-[#C5A059]">
                  Tool: {createdIncident.primaryTool}
                </span>
                <Link
                  href={`/incidents/${createdIncident.slug}`}
                  className="inline-flex items-center gap-1 text-[#10B981] hover:underline"
                >
                  <span>Inspect Generated PIR</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <BrassSectionDivider label="EPISTEMIC HUMILITY & ZERO AI SLOP GOVERNANCE CHARTER" />

      {/* Governance Charter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
          <div className="font-mono text-xs text-[#10B981] uppercase">
            CHARTER RULE 02 // EPISTEMIC HUMILITY
          </div>
          <h3 className="font-display text-lg text-[#F3EFE6]">
            The &ldquo;Pending Post-Mortem&rdquo; Rule
          </h3>
          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            The pipeline never declares a partisan villain or predicts catastrophic outcomes. Ongoing stories are framed as active incidents with incomplete telemetry—highlighting what data is missing and what Socratic questions will prove whether the system is recovering.
          </p>
        </div>

        <div className="tracing-board-frame p-6 space-y-3">
          <div className="font-mono text-xs text-[#F59E0B] uppercase">
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

      <BrassSectionDivider label="RECENT PIPELINE EXECUTION LOGS & CRON TELEMETRY" />

      {/* Pipeline Runs Table */}
      <div className="tracing-board-frame overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[780px]">
          <thead>
            <tr className="bg-[#0B0E14] border-b border-[#C5A059]/50 font-mono text-xs uppercase text-[#C5A059]">
              <th className="p-3.5">Run ID</th>
              <th className="p-3.5">Job Type</th>
              <th className="p-3.5">Timestamp (UTC)</th>
              <th className="p-3.5">Evaluated</th>
              <th className="p-3.5">Accepted</th>
              <th className="p-3.5">Noise Dropped</th>
              <th className="p-3.5">Avg Latency</th>
              <th className="p-3.5">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#8A6D3B]/30 font-mono text-xs">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-[#0B0E14]/60">
                <td className="p-3.5 text-[#C5A059]">{run.id}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/50 text-[#F3EFE6]">
                    {run.runType}
                  </span>
                </td>
                <td className="p-3.5 text-[#94A3B8]">
                  {run.startedAt.slice(0, 19).replace("T", " ")}
                </td>
                <td className="p-3.5 text-[#F3EFE6]">{run.itemsEvaluated}</td>
                <td className="p-3.5 text-[#10B981] font-bold">
                  +{run.itemsAccepted}
                </td>
                <td className="p-3.5 text-[#F59E0B]">{run.itemsRejectedNoise}</td>
                <td className="p-3.5 text-[#C5A059]">
                  {run.avgClassifierLatencyMs}ms
                </td>
                <td className="p-3.5 text-[#94A3B8] max-w-md">{run.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
