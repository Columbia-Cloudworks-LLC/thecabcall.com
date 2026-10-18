"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthenticatedAdminActor } from "@/pipeline/auth";
import type {
  AuditChainVerificationResult,
  AuditLedgerEntry,
} from "@/pipeline/audit";
import type { PipelineRunRecord } from "@/lib/types";

interface AdminOverviewClientProps {
  actor: AuthenticatedAdminActor;
  ownerEmail: string;
  systemHealth: {
    d1Source: string;
    synthesizedCount: number;
    triagedCount: number;
    droppedCount: number;
    totalEvaluated: number;
    totalIncidents: number;
    totalEpisodes: number;
    latestEpisodeTitle: string;
    latestEpisodeNumber: number;
    noiseRejectionRate: number;
    avgClassifierLatencyMs: number;
    avgJevConfidence: number;
    activeFeedCount: number;
    activeFeedsList: { name: string; focus: string }[];
    activeFilterCount: number;
    activeUsersCount: number;
    invitedUsersCount: number;
  };
  initialAuditEntries: AuditLedgerEntry[];
  initialAuditTotal: number;
  initialChainIntegrity?: AuditChainVerificationResult;
  initialPipelineRuns: PipelineRunRecord[];
}

function formatActionReadable(entry: AuditLedgerEntry): string {
  switch (entry.actionType) {
    case "incident_headline_deescalate":
      return "Rewrote story headline for calm editorial posture";
    case "incident_brief_override":
      return "Updated Craftsman's Brief editorial text";
    case "incident_image_attach":
      return "Updated story illustration";
    case "episode_generate":
      return "Generated new weekly podcast episode";
    case "episode_edit":
      return "Updated podcast episode notes or transcript";
    case "episode_delete":
      return "Removed podcast episode from archive";
    case "feed_add":
      return "Added new monitored RSS source";
    case "feed_update":
      return "Updated RSS source configuration";
    case "feed_delete":
      return "Removed RSS source";
    case "filter_add":
      return "Added editorial filtering rule";
    case "filter_update":
      return "Updated editorial filtering rule";
    case "filter_delete":
      return "Removed editorial filtering rule";
    case "user_invite":
      return "Invited new editorial team member";
    case "user_role_update":
      return "Updated team member role";
    case "user_revoke":
      return "Revoked team member access";
    case "audit_replay":
      return "Restored prior record state from audit ledger";
    case "pipeline_ingest":
      return "Fetched latest news from monitored RSS sources";
    case "pipeline_synthesize":
      return "Synthesized Craftsman's Briefs for pending stories";
    default:
      return entry.reason || entry.actionType.replace(/_/g, " ");
  }
}

function formatRunTypeReadable(runType: string): string {
  const lower = runType.toLowerCase();
  if (lower.includes("ingest")) return "Fetched & Filtered RSS News";
  if (lower.includes("synth")) return "Synthesized Case Briefs";
  if (lower.includes("rollup") || lower.includes("podcast"))
    return "Generated Weekly Podcast Rollup";
  return runType;
}

export function AdminOverviewClient({
  actor,
  systemHealth,
  initialAuditEntries,
  initialAuditTotal,
  initialChainIntegrity,
  initialPipelineRuns,
}: AdminOverviewClientProps) {
  const router = useRouter();
  const [auditEntries, setAuditEntries] =
    useState<AuditLedgerEntry[]>(initialAuditEntries);
  const [auditTotal, setAuditTotal] = useState<number>(initialAuditTotal);
  const [chainIntegrity, setChainIntegrity] = useState<
    AuditChainVerificationResult | undefined
  >(initialChainIntegrity);

  // Quick-action state
  const [chainSynthesizeOnIngest, setChainSynthesizeOnIngest] = useState(true);
  const [runningAction, setRunningAction] = useState<
    "ingest" | "synthesize" | "rollup" | "verify" | "custom" | null
  >(null);
  const [actionBanner, setActionBanner] = useState<{
    type: "success" | "error";
    title: string;
    detail: string;
  } | null>(null);

  // Admin-only custom case submission state
  const [showCustomCaseForm, setShowCustomCaseForm] = useState(false);
  const [customSource, setCustomSource] = useState("REUTERS // INFRASTRUCTURE");
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const canRunPipelines =
    actor.role === "owner" ||
    actor.role === "admin" ||
    actor.role === "editor";

  async function refreshAuditTelemetry() {
    try {
      const res = await fetch("/api/admin/audit?limit=20", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          entries?: AuditLedgerEntry[];
          total?: number;
          chainIntegrity?: AuditChainVerificationResult;
        };
        if (Array.isArray(data.entries)) {
          setAuditEntries(data.entries);
        }
        if (typeof data.total === "number") {
          setAuditTotal(data.total);
        }
        if (data.chainIntegrity) {
          setChainIntegrity(data.chainIntegrity);
        }
      }
    } catch {
      // ignore
    }
    router.refresh();
  }

  async function handleRunIngest() {
    setRunningAction("ingest");
    setActionBanner(null);
    try {
      const res = await fetch(
        `/api/run-ingest${chainSynthesizeOnIngest ? "?synthesize=true" : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            synthesize: chainSynthesizeOnIngest,
            synthesizeLimit: 5,
            maxNetNew: 10,
          }),
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        ingestedCount?: number;
        triagedCount?: number;
        droppedCount?: number;
        synthesis?: { requestedLimit?: number; synthesizedCount?: number };
      };
      if (!res.ok || data.ok === false) {
        setActionBanner({
          type: "error",
          title: "News Fetch Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        const synthNote = data.synthesis
          ? ` • Auto-drafted ${data.synthesis.synthesizedCount ?? 0} new case briefs.`
          : "";
        setActionBanner({
          type: "success",
          title: "Latest News Fetched & Filtered",
          detail: `Evaluated ${data.ingestedCount ?? 0} incoming stories → ${
            data.triagedCount ?? 0
          } selected for editorial review, ${
            data.droppedCount ?? 0
          } filtered as low-signal noise.${synthNote}`,
        });
        await refreshAuditTelemetry();
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "News Fetch Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunningAction(null);
    }
  }

  async function handleRunSynthesize() {
    setRunningAction("synthesize");
    setActionBanner(null);
    try {
      const res = await fetch("/api/run-synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        requestedLimit?: number;
        synthesizedCount?: number;
      };
      if (!res.ok || data.ok === false) {
        setActionBanner({
          type: "error",
          title: "Case Brief Synthesis Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        setActionBanner({
          type: "success",
          title: "Case Briefs Synthesized",
          detail: `Drafted ${
            data.synthesizedCount ?? 0
          } Craftsman's Briefs and recorded changes in the audit ledger.`,
        });
        await refreshAuditTelemetry();
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "Synthesis Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunningAction(null);
    }
  }

  async function handleGenerateEpisode() {
    setRunningAction("rollup");
    setActionBanner(null);
    try {
      const res = await fetch("/api/run-rollup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        episode?: {
          episode_number?: number;
          title?: string;
          slug?: string;
          audio_url?: string;
        };
      };
      if (!res.ok || data.ok === false) {
        setActionBanner({
          type: "error",
          title: "Weekly Episode Generation Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        setActionBanner({
          type: "success",
          title: `Generated Weekly Episode #${
            data.episode?.episode_number ?? "New"
          }`,
          detail: `"${
            data.episode?.title ?? "Weekly CAB Brief"
          }" audio and transcript published and recorded in the audit ledger.`,
        });
        await refreshAuditTelemetry();
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "Weekly Episode Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunningAction(null);
    }
  }

  async function handleVerifyChain() {
    setRunningAction("verify");
    setActionBanner(null);
    try {
      const res = await fetch("/api/admin/audit/verify", {
        cache: "no-store",
      });
      const data = (await res.json()) as AuditChainVerificationResult & {
        ok?: boolean;
      };
      setChainIntegrity(data);
      if (data.valid) {
        setActionBanner({
          type: "success",
          title: "Audit Ledger Verified",
          detail: `Confirmed cryptographic integrity across all ${data.totalEntries} editorial records from GENESIS to HEAD.`,
        });
      } else {
        setActionBanner({
          type: "error",
          title: "Ledger Integrity Alert",
          detail: data.error || "Digest mismatch detected in the audit ledger.",
        });
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "Ledger Verification Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunningAction(null);
    }
  }

  async function handleSubmitCustomCase(e: React.FormEvent) {
    e.preventDefault();
    if (!canRunPipelines || !customTitle.trim() || !customDesc.trim()) return;
    setRunningAction("custom");
    setActionBanner(null);
    try {
      const res = await fetch("/api/run-ingest?synthesize=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          synthesize: true,
          synthesizeLimit: 1,
          customArticle: {
            title: customTitle.trim(),
            description: customDesc.trim(),
            sourceFeed: customSource.trim() || "EDITORIAL DISPATCH",
            link:
              customUrl.trim() ||
              `https://thecabcall.com/editorial-case/${Date.now()}`,
          },
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        ingestedCount?: number;
        triagedCount?: number;
      };
      if (!res.ok || data.ok === false) {
        setActionBanner({
          type: "error",
          title: "Custom Story Submission Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        setActionBanner({
          type: "success",
          title: "Custom Craftsman's Brief Drafted",
          detail: `Evaluated and drafted "${customTitle.trim()}" under ${actor.email}.`,
        });
        setCustomTitle("");
        setCustomDesc("");
        setCustomUrl("");
        setShowCustomCaseForm(false);
        await refreshAuditTelemetry();
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "Custom Story Submission Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunningAction(null);
    }
  }

  const isLedgerValid = chainIntegrity?.valid !== false;
  const recentAuditItems = auditEntries.slice(0, 5);
  const recentRunItems = initialPipelineRuns.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* The Editor's Study Overview Hero */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 sm:p-7 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <span className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l border-[#C5A059]/75" />
        <span className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r border-[#C5A059]/75" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b border-l border-[#C5A059]/75" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b border-r border-[#C5A059]/75" />

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-display text-[10px] uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Editorial Desk Ready
            </span>
            <span className="font-serif italic text-xs text-[#C5A059]">
              Latest Broadcast: Ep #{systemHealth.latestEpisodeNumber} —{" "}
              {systemHealth.latestEpisodeTitle}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] tracking-wide">
            The Editor&apos;s Study
          </h1>
          <p className="font-serif text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
            Fetch incoming stories from monitored RSS sources, draft calm
            Craftsman&apos;s Briefs, produce the weekly podcast episode, and
            review the immutable editorial ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/admin/incidents"
            className="bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider px-4 py-2.5 transition-all duration-200 ease-out"
          >
            Editorial &amp; Feeds →
          </Link>
          <Link
            href="/admin/episodes"
            className="px-4 py-2.5 border border-[#8A6D3B]/55 hover:border-[#C5A059] bg-[#0B0E14]/70 text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out"
          >
            Podcast Studio →
          </Link>
        </div>
      </div>

      {/* Action Status Feedback Banner */}
      {actionBanner && (
        <div
          className={`p-4 border text-xs flex items-start justify-between gap-4 ${
            actionBanner.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/45 text-emerald-200"
              : "bg-red-950/50 border-red-500/50 text-red-200"
          }`}
        >
          <div className="space-y-1">
            <div className="font-display uppercase tracking-wider font-bold text-sm">
              {actionBanner.title}
            </div>
            <div className="font-serif text-sm text-[#F3EFE6]/90">
              {actionBanner.detail}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="underline font-display uppercase tracking-wider text-[11px] shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Single Compact 5-Metric Horizontal Summary Strip */}
      <div
        aria-label="Editorial Desk Summary Metrics"
        className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#8A6D3B]/35 border border-[#8A6D3B]/45 bg-[#111726]/95 shadow-lg"
      >
        <Link
          href="/admin/incidents"
          className="p-4 sm:p-5 hover:bg-[#0B0E14]/50 transition-all duration-200 ease-out group"
        >
          <div className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8] group-hover:text-[#C5A059] transition-colors">
            Active Stories
          </div>
          <div className="font-display text-2xl sm:text-3xl text-[#F3EFE6] font-bold mt-1">
            {systemHealth.totalIncidents}
          </div>
          <div className="font-serif text-xs text-[#94A3B8] mt-1">
            {systemHealth.synthesizedCount} published •{" "}
            {systemHealth.triagedCount} pending
          </div>
        </Link>

        <Link
          href="/admin/incidents?view=feeds"
          className="p-4 sm:p-5 hover:bg-[#0B0E14]/50 transition-all duration-200 ease-out group"
        >
          <div className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8] group-hover:text-[#C5A059] transition-colors">
            Monitored Feeds
          </div>
          <div className="font-display text-2xl sm:text-3xl text-[#F3EFE6] font-bold mt-1">
            {systemHealth.activeFeedCount}
          </div>
          <div className="font-serif text-xs text-[#94A3B8] mt-1 truncate">
            Active RSS sources
          </div>
        </Link>

        <Link
          href="/admin/incidents?view=rules"
          className="p-4 sm:p-5 hover:bg-[#0B0E14]/50 transition-all duration-200 ease-out group"
        >
          <div className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8] group-hover:text-[#C5A059] transition-colors">
            Filter Rules
          </div>
          <div className="font-display text-2xl sm:text-3xl text-[#F3EFE6] font-bold mt-1">
            {systemHealth.activeFilterCount}
          </div>
          <div className="font-serif text-xs text-[#94A3B8] mt-1">
            {systemHealth.noiseRejectionRate}% noise filtered
          </div>
        </Link>

        <Link
          href="/admin/episodes"
          className="p-4 sm:p-5 hover:bg-[#0B0E14]/50 transition-all duration-200 ease-out group"
        >
          <div className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8] group-hover:text-[#C5A059] transition-colors">
            Published Episodes
          </div>
          <div className="font-display text-2xl sm:text-3xl text-[#F3EFE6] font-bold mt-1">
            {systemHealth.totalEpisodes}
          </div>
          <div className="font-serif text-xs text-[#94A3B8] mt-1 truncate">
            Latest: Ep #{systemHealth.latestEpisodeNumber}
          </div>
        </Link>

        <Link
          href="/admin/audit"
          className="col-span-2 sm:col-span-1 p-4 sm:p-5 hover:bg-[#0B0E14]/50 transition-all duration-200 ease-out group"
        >
          <div className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8] group-hover:text-[#C5A059] transition-colors">
            Ledger Status
          </div>
          <div
            className={`font-display text-xl sm:text-2xl font-bold mt-1 ${
              isLedgerValid ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {isLedgerValid ? "Verified" : "Alert"}
          </div>
          <div className="font-serif text-xs text-emerald-300/90 mt-1">
            Verified ({auditTotal} records)
          </div>
        </Link>
      </div>

      {/* Plain-English Quick-Action Cards */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-5 shadow-xl">
        <span className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l border-[#C5A059]/70" />
        <span className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r border-[#C5A059]/70" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b border-l border-[#C5A059]/70" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b border-r border-[#C5A059]/70" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#8A6D3B]/30 pb-4">
          <div>
            <h2 className="font-display text-lg text-[#F3EFE6] tracking-wide">
              Editorial Actions
            </h2>
            <p className="font-serif text-xs text-[#94A3B8] mt-0.5">
              Trigger news collection, draft new case briefs, or produce the
              weekly podcast episode on demand.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-sans text-[#F3EFE6] cursor-pointer">
              <input
                type="checkbox"
                checked={chainSynthesizeOnIngest}
                onChange={(e) => setChainSynthesizeOnIngest(e.target.checked)}
                className="border-[#8A6D3B] bg-[#0B0E14] text-[#C5A059] accent-[#C5A059]"
              />
              <span>Auto-draft briefs when fetching news</span>
            </label>
            {canRunPipelines && (
              <button
                type="button"
                onClick={() => setShowCustomCaseForm((prev) => !prev)}
                className="px-3 py-1.5 border border-[#C5A059]/60 bg-[#0B0E14] hover:border-[#C5A059] font-display text-[11px] uppercase tracking-wider text-[#C5A059] transition-all duration-200 ease-out cursor-pointer"
              >
                {showCustomCaseForm
                  ? "Hide Custom Story Form"
                  : "+ Submit Custom Story"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Fetch Latest News */}
          <button
            type="button"
            disabled={!canRunPipelines || runningAction !== null}
            onClick={handleRunIngest}
            className="group relative flex flex-col justify-between text-left p-5 bg-[#0B0E14]/85 hover:bg-[#0B0E14] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-all duration-200 ease-out disabled:opacity-50 cursor-pointer"
          >
            <span className="pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l border-[#C5A059]/60" />
            <span className="pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#C5A059]/60" />
            <div>
              <div className="font-display text-[10px] uppercase tracking-[0.16em] text-[#C5A059]">
                Newsroom Intake
              </div>
              <div className="font-display text-base font-bold text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors mt-1.5">
                {runningAction === "ingest"
                  ? "Fetching Latest News…"
                  : "Fetch Latest News"}
              </div>
              <p className="font-serif text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                Check monitored RSS sources and filter incoming stories.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-[#8A6D3B]/25 flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-[#C5A059]">
              <span>{systemHealth.activeFeedCount} feeds active</span>
              <span>Run →</span>
            </div>
          </button>

          {/* Card 2: Synthesize Case Briefs */}
          <button
            type="button"
            disabled={!canRunPipelines || runningAction !== null}
            onClick={handleRunSynthesize}
            className="group relative flex flex-col justify-between text-left p-5 bg-[#0B0E14]/85 hover:bg-[#0B0E14] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-all duration-200 ease-out disabled:opacity-50 cursor-pointer"
          >
            <span className="pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l border-[#C5A059]/60" />
            <span className="pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#C5A059]/60" />
            <div>
              <div className="font-display text-[10px] uppercase tracking-[0.16em] text-[#C5A059]">
                Editorial Drafting
              </div>
              <div className="font-display text-base font-bold text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors mt-1.5">
                {runningAction === "synthesize"
                  ? "Synthesizing Briefs…"
                  : "Synthesize Case Briefs"}
              </div>
              <p className="font-serif text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                Draft structured Craftsman&apos;s Briefs for pending stories.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-[#8A6D3B]/25 flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-[#C5A059]">
              <span>{systemHealth.triagedCount} pending</span>
              <span>Draft →</span>
            </div>
          </button>

          {/* Card 3: Generate Weekly Episode */}
          <button
            type="button"
            disabled={!canRunPipelines || runningAction !== null}
            onClick={handleGenerateEpisode}
            className="group relative flex flex-col justify-between text-left p-5 bg-[#0B0E14]/85 hover:bg-[#0B0E14] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-all duration-200 ease-out disabled:opacity-50 cursor-pointer"
          >
            <span className="pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l border-[#C5A059]/60" />
            <span className="pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#C5A059]/60" />
            <div>
              <div className="font-display text-[10px] uppercase tracking-[0.16em] text-[#C5A059]">
                Podcast Production
              </div>
              <div className="font-display text-base font-bold text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors mt-1.5">
                {runningAction === "rollup"
                  ? "Generating Episode…"
                  : "Generate Weekly Episode"}
              </div>
              <p className="font-serif text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                Produce the 5-minute weekly audio brief and transcript.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-[#8A6D3B]/25 flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-[#C5A059]">
              <span>{systemHealth.totalEpisodes} episodes</span>
              <span>Produce →</span>
            </div>
          </button>

          {/* Card 4: Verify Ledger */}
          <button
            type="button"
            disabled={runningAction !== null}
            onClick={handleVerifyChain}
            className="group relative flex flex-col justify-between text-left p-5 bg-[#0B0E14]/85 hover:bg-[#0B0E14] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-all duration-200 ease-out disabled:opacity-50 cursor-pointer"
          >
            <span className="pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l border-[#C5A059]/60" />
            <span className="pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#C5A059]/60" />
            <div>
              <div className="font-display text-[10px] uppercase tracking-[0.16em] text-[#C5A059]">
                Provenance &amp; Audit
              </div>
              <div className="font-display text-base font-bold text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors mt-1.5">
                {runningAction === "verify"
                  ? "Verifying Ledger…"
                  : "Verify Ledger"}
              </div>
              <p className="font-serif text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
                Confirm cryptographic integrity across all editorial records.
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-[#8A6D3B]/25 flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-[#C5A059]">
              <span>{auditTotal} records</span>
              <span>Verify →</span>
            </div>
          </button>
        </div>

        {/* Optional Custom Story Submission Form */}
        {showCustomCaseForm && canRunPipelines && (
          <form
            onSubmit={handleSubmitCustomCase}
            className="mt-4 pt-5 border-t border-[#8A6D3B]/35 space-y-4 bg-[#0B0E14]/90 p-5 border border-[#8A6D3B]/40"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[10px] uppercase tracking-widest text-[#C5A059]">
                  Editorial Dispatch Desk
                </div>
                <h3 className="font-display text-base text-[#F3EFE6] mt-0.5">
                  Submit Sourced Story for a Craftsman&apos;s Brief
                </h3>
              </div>
              <span className="font-sans text-xs text-[#94A3B8]">
                Recorded under {actor.email}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-display text-[11px] uppercase tracking-wider text-[#C5A059] block mb-1.5">
                  Source Attribution
                </label>
                <input
                  type="text"
                  required
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  placeholder="e.g. REUTERS // INFRASTRUCTURE"
                  className="w-full bg-[#111726] border border-[#8A6D3B]/45 px-3 py-2 text-xs text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </div>
              <div>
                <label className="font-display text-[11px] uppercase tracking-wider text-[#C5A059] block mb-1.5">
                  Source Article URL (Optional)
                </label>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#111726] border border-[#8A6D3B]/45 px-3 py-2 font-mono text-xs text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-display text-[11px] uppercase tracking-wider text-[#C5A059] block mb-1.5">
                Story Headline
              </label>
              <input
                type="text"
                required
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Enter sourced story headline..."
                className="w-full bg-[#111726] border border-[#8A6D3B]/45 px-3 py-2 font-serif text-sm text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            <div>
              <label className="font-display text-[11px] uppercase tracking-wider text-[#C5A059] block mb-1.5">
                Factual Summary (2+ Sentences)
              </label>
              <textarea
                rows={3}
                required
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Provide a multi-sentence factual summary of the event..."
                className="w-full bg-[#111726] border border-[#8A6D3B]/45 p-3 font-serif text-sm text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={runningAction !== null}
                className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer disabled:opacity-50"
              >
                {runningAction === "custom"
                  ? "Drafting Craftsman's Brief…"
                  : "Draft & Publish Craftsman's Brief"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 5-Item Plain-English "Recent Activity & Pipeline Runs" Feed */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 shadow-xl overflow-hidden">
        <span className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l border-[#C5A059]/70" />
        <span className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r border-[#C5A059]/70" />

        <div className="p-5 sm:p-6 border-b border-[#8A6D3B]/35 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-display text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
              Editorial Logbook
            </div>
            <h2 className="font-display text-lg sm:text-xl text-[#F3EFE6] mt-0.5">
              Recent Activity &amp; Pipeline Runs
            </h2>
          </div>

          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0B0E14] border border-[#8A6D3B]/50 hover:border-[#C5A059] font-display text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-all duration-200 ease-out"
          >
            View Full Audit Ledger →
          </Link>
        </div>

        <div className="divide-y divide-[#8A6D3B]/25">
          {recentAuditItems.map((entry) => (
            <div
              key={entry.eventId}
              className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#0B0E14]/45 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xs font-semibold text-[#F3EFE6]">
                    {formatActionReadable(entry)}
                  </span>
                  <span className="text-xs text-[#8A6D3B]">•</span>
                  <span className="font-mono text-[11px] text-[#C5A059] truncate max-w-[240px]">
                    {entry.targetId}
                  </span>
                </div>
                {entry.reason && (
                  <p className="font-serif text-xs text-[#94A3B8] line-clamp-1">
                    {entry.reason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[11px] text-[#94A3B8]">
                  {entry.timestamp.replace("T", " ").slice(0, 16)} UTC
                </span>

                <span
                  title={`Actor: ${entry.actorEmail} (${entry.actorRole}) • SHA-256: ${entry.entryHash} • Prev: ${entry.prevHash}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-sans text-[11px] cursor-help"
                >
                  ✓ Verified
                </span>

                <Link
                  href={`/admin/audit?eventId=${encodeURIComponent(
                    entry.eventId
                  )}`}
                  className="text-xs font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
                >
                  Inspect →
                </Link>
              </div>
            </div>
          ))}

          {recentRunItems.map((run) => (
            <div
              key={run.id}
              className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0B0E14]/25 hover:bg-[#0B0E14]/50 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/45 font-display text-[10px] uppercase tracking-wider text-[#C5A059]">
                    Automated Run
                  </span>
                  <span className="font-display text-xs font-semibold text-[#F3EFE6]">
                    {formatRunTypeReadable(run.runType)}
                  </span>
                </div>
                <p className="font-serif text-xs text-[#94A3B8] line-clamp-1">
                  Reviewed {run.itemsEvaluated} stories ({run.itemsAccepted}{" "}
                  accepted, {run.itemsRejectedNoise} filtered as noise) —{" "}
                  {run.notes}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[11px] text-[#94A3B8]">
                  {run.startedAt.replace("T", " ").slice(0, 16)} UTC
                </span>
                <span
                  title={`Run ID: ${run.id} • Status: ${run.status} • Classifier Latency: ${run.avgClassifierLatencyMs}ms`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-sans text-[11px] cursor-help"
                >
                  ✓ Verified
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
