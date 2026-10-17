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

export function AdminOverviewClient({
  actor,
  ownerEmail,
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
    "ingest" | "synthesize" | "rollup" | "verify" | null
  >(null);
  const [actionBanner, setActionBanner] = useState<{
    type: "success" | "error";
    title: string;
    detail: string;
  } | null>(null);

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
          title: "RSS Ingest & System-1 Triage Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        const synthNote = data.synthesis
          ? ` • Chained System-2 synthesized ${data.synthesis.synthesizedCount ?? 0} briefs.`
          : "";
        setActionBanner({
          type: "success",
          title: "RSS Ingest & System-1 Jev Classification Complete",
          detail: `Evaluated ${data.ingestedCount ?? 0} feed items → ${
            data.triagedCount ?? 0
          } triaged systemic incidents, ${
            data.droppedCount ?? 0
          } dropped as low-signal noise.${synthNote}`,
        });
        await refreshAuditTelemetry();
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "RSS Ingest Error",
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
          title: "System-2 Socratic Synthesis Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        setActionBanner({
          type: "success",
          title: "System-2 Gemini 2.5 Flash Synthesis Complete",
          detail: `Synthesized ${
            data.synthesizedCount ?? 0
          } Socratic briefs (batch limit ${
            data.requestedLimit ?? 5
          }) and committed to D1.`,
        });
        await refreshAuditTelemetry();
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "System-2 Synthesis Error",
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
          title: "Podcast Rollup Generation Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        setActionBanner({
          type: "success",
          title: `Generated Podcast Episode #${
            data.episode?.episode_number ?? "New"
          }`,
          detail: `"${
            data.episode?.title ?? "Weekly CAB Brief"
          }" synthesized, uploaded to R2 (${
            data.episode?.audio_url ?? "/audio/..."
          }), and logged to audit_ledger.`,
        });
        await refreshAuditTelemetry();
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "Podcast Rollup Error",
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
          title: "SHA-256 Cryptographic Audit Chain Verified",
          detail: `Walked all ${data.totalEntries} entries from GENESIS (${data.genesisHash?.slice(
            0,
            12
          )}…) to HEAD (${data.headHash?.slice(
            0,
            12
          )}…) with zero digest mismatches.`,
        });
      } else {
        setActionBanner({
          type: "error",
          title: "Cryptographic Chain Integrity Alert",
          detail: data.error || "Digest mismatch detected in audit_ledger.",
        });
      }
    } catch (err) {
      setActionBanner({
        type: "error",
        title: "Chain Verification Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Command Center Overview Hero */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-[11px]">
              ● SYSTEM POSTURE: NOMINAL ({systemHealth.d1Source.toUpperCase()})
            </span>
            <span className="font-mono text-xs text-[#8E9BAE]">
              System-1: <code className="text-[#D6D1C7]">jev-1.14.0</code> (
              {systemHealth.avgClassifierLatencyMs}ms avg) • System-2:{" "}
              <code className="text-[#D6D1C7]">gemini-2.5-flash</code>
            </span>
          </div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-[#F3EFE6]">
            Change Advisory Board Telemetry Command Center
          </h1>
          <p className="text-xs text-[#9CA3AF] max-w-3xl">
            Live operational overview of inbound RSS ingestion, System-1 Jev
            triage filters, System-2 Socratic synthesis, Friday podcast rollups,
            and the append-only SHA-256 hash-chained{" "}
            <code className="text-[#C5A059]">audit_ledger</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/audit"
            className="bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-mono text-xs font-semibold uppercase px-4 py-2.5 rounded transition-colors"
          >
            Audit Explorer &amp; Replay Studio →
          </Link>
          <a
            href="/api/admin/audit/export?format=md"
            className="px-3.5 py-2.5 rounded border border-[#263147] hover:border-[#C5A059] text-xs font-mono text-[#D6D1C7] transition-colors"
          >
            Export Disclosure (.MD)
          </a>
        </div>
      </div>

      {/* Action Status Feedback Banner */}
      {actionBanner && (
        <div
          className={`p-4 rounded-lg border font-mono text-xs flex items-start justify-between gap-4 ${
            actionBanner.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/40 border-red-500/40 text-red-200"
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider">
              {actionBanner.title}
            </div>
            <div className="text-[#D6D1C7]">{actionBanner.detail}</div>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="underline text-xs shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick-Action Pipeline Triggers */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-cinzel text-lg font-bold text-[#F3EFE6]">
              Quick-Action Pipeline &amp; Governance Triggers
            </h2>
            <p className="text-xs text-[#8E9BAE] font-mono">
              Execute edge ingestion, Socratic brief synthesis, or podcast audio
              rollup on demand. All runs are logged to{" "}
              <code className="text-[#C5A059]">audit_ledger</code> under{" "}
              <span className="text-[#F3EFE6]">{actor.email}</span>.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-mono text-[#D6D1C7] cursor-pointer">
            <input
              type="checkbox"
              checked={chainSynthesizeOnIngest}
              onChange={(e) => setChainSynthesizeOnIngest(e.target.checked)}
              className="rounded border-[#263147] bg-[#0B0E14] text-[#C5A059]"
            />
            <span>Chain System-2 Synthesis on Ingest</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            disabled={!canRunPipelines || runningAction !== null}
            onClick={handleRunIngest}
            className="flex flex-col justify-between text-left p-4 rounded-md bg-[#161E2E] hover:bg-[#1C263B] border border-[#2E3C56] hover:border-[#C5A059] transition-all disabled:opacity-50 cursor-pointer"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] font-semibold">
                STAGE 1–3 // EDGE INGEST
              </div>
              <div className="font-cinzel text-base font-bold text-[#F3EFE6] mt-1">
                {runningAction === "ingest"
                  ? "Running Ingest…"
                  : "Run Ingest Pipeline"}
              </div>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Polls {systemHealth.activeFeedCount} active RSS feeds &amp;
                classifies via TypeSafe Jev (jev-1.14.0).
              </p>
            </div>
            <div className="mt-3 font-mono text-[11px] text-[#C5A059]">
              POST /api/run-ingest →
            </div>
          </button>

          <button
            type="button"
            disabled={!canRunPipelines || runningAction !== null}
            onClick={handleRunSynthesize}
            className="flex flex-col justify-between text-left p-4 rounded-md bg-[#161E2E] hover:bg-[#1C263B] border border-[#2E3C56] hover:border-[#C5A059] transition-all disabled:opacity-50 cursor-pointer"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-sky-300 font-semibold">
                STAGE 4 // SYSTEM-2 GEMINI
              </div>
              <div className="font-cinzel text-base font-bold text-[#F3EFE6] mt-1">
                {runningAction === "synthesize"
                  ? "Synthesizing Briefs…"
                  : "Run Synthesis"}
              </div>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Generates Socratic briefs for pending triaged incidents (
                {systemHealth.triagedCount} awaiting synthesis).
              </p>
            </div>
            <div className="mt-3 font-mono text-[11px] text-sky-300">
              POST /api/run-synthesize →
            </div>
          </button>

          <button
            type="button"
            disabled={!canRunPipelines || runningAction !== null}
            onClick={handleGenerateEpisode}
            className="flex flex-col justify-between text-left p-4 rounded-md bg-[#161E2E] hover:bg-[#1C263B] border border-[#2E3C56] hover:border-[#C5A059] transition-all disabled:opacity-50 cursor-pointer"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                STAGE 5 // PODCAST + R2 TTS
              </div>
              <div className="font-cinzel text-base font-bold text-[#F3EFE6] mt-1">
                {runningAction === "rollup"
                  ? "Generating Episode…"
                  : "Generate Episode"}
              </div>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Synthesizes 5-minute Friday CAB Rollup script &amp; MP3 audio to
                Cloudflare R2.
              </p>
            </div>
            <div className="mt-3 font-mono text-[11px] text-emerald-300">
              POST /api/run-rollup →
            </div>
          </button>

          <button
            type="button"
            disabled={runningAction !== null}
            onClick={handleVerifyChain}
            className="flex flex-col justify-between text-left p-4 rounded-md bg-[#161E2E] hover:bg-[#1C263B] border border-[#2E3C56] hover:border-[#C5A059] transition-all disabled:opacity-50 cursor-pointer"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
                CRYPTOGRAPHIC PROVENANCE
              </div>
              <div className="font-cinzel text-base font-bold text-[#F3EFE6] mt-1">
                {runningAction === "verify"
                  ? "Verifying Hashes…"
                  : "Verify Audit Chain"}
              </div>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Recomputes SHA-256 digests from GENESIS to HEAD across all{" "}
                {auditTotal} ledger rows.
              </p>
            </div>
            <div className="mt-3 font-mono text-[11px] text-amber-300">
              GET /api/admin/audit/verify →
            </div>
          </button>
        </div>
      </div>

      {/* Telemetry & Governance KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Total Incidents */}
        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#8E9BAE]">
                Total Incidents &amp; Triage Gate
              </span>
              <span className="font-mono text-[11px] text-emerald-300">
                {systemHealth.noiseRejectionRate}% Noise Rejected
              </span>
            </div>
            <div className="font-cinzel text-3xl font-bold text-[#F3EFE6] mt-2">
              {systemHealth.totalIncidents} Active Incidents
            </div>
            <div className="font-mono text-xs text-[#9CA3AF] mt-1.5">
              {systemHealth.synthesizedCount} Synthesized •{" "}
              {systemHealth.triagedCount} Pending Triage •{" "}
              {systemHealth.droppedCount} Dropped Noise
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E2738] flex items-center justify-between font-mono text-xs">
            <Link
              href="/admin/incidents"
              className="text-[#C5A059] hover:underline"
            >
              Incidents &amp; Transforms Studio →
            </Link>
            <Link href="/" className="text-[#8E9BAE] hover:text-[#F3EFE6]">
              View Trestleboard ↗
            </Link>
          </div>
        </div>

        {/* Card 2: Active Inbound Feeds */}
        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#8E9BAE]">
                Active Inbound RSS Feeds
              </span>
              <span className="font-mono text-[11px] text-emerald-300">
                POLLING NOMINAL
              </span>
            </div>
            <div className="font-cinzel text-3xl font-bold text-[#F3EFE6] mt-2">
              {systemHealth.activeFeedCount} High-Impact Feeds
            </div>
            <div className="font-mono text-[11px] text-[#9CA3AF] mt-1.5 truncate">
              {systemHealth.activeFeedsList.map((f) => f.name).join(" • ")}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E2738] flex items-center justify-between font-mono text-xs">
            <Link
              href="/admin/feeds"
              className="text-[#C5A059] hover:underline"
            >
              Manage Inbound Feeds →
            </Link>
            <span className="text-[#8E9BAE]">5 items/poll</span>
          </div>
        </div>

        {/* Card 3: Active Triage Filters */}
        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#8E9BAE]">
                Active Triage Filters &amp; Jev Gate
              </span>
              <span className="font-mono text-[11px] text-[#C5A059]">
                P(systemic) ≥ 0.70
              </span>
            </div>
            <div className="font-cinzel text-3xl font-bold text-[#F3EFE6] mt-2">
              {systemHealth.activeFilterCount} Active Filter Rules
            </div>
            <div className="font-mono text-xs text-[#9CA3AF] mt-1.5">
              Avg Jev Confidence: {(systemHealth.avgJevConfidence * 100).toFixed(0)}
              % • Latency: {systemHealth.avgClassifierLatencyMs}ms
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E2738] flex items-center justify-between font-mono text-xs">
            <Link
              href="/admin/filters"
              className="text-[#C5A059] hover:underline"
            >
              Configure Triage Filters →
            </Link>
            <span className="text-[#8E9BAE]">jev-1.14.0</span>
          </div>
        </div>

        {/* Card 4: Podcast Episodes */}
        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#8E9BAE]">
                Podcast Episodes &amp; R2 Audio
              </span>
              <span className="font-mono text-[11px] text-sky-300">
                cabcall-audio
              </span>
            </div>
            <div className="font-cinzel text-3xl font-bold text-[#F3EFE6] mt-2">
              {systemHealth.totalEpisodes} Episodes
            </div>
            <div className="font-mono text-xs text-[#9CA3AF] mt-1.5 truncate">
              Latest: Ep #{systemHealth.latestEpisodeNumber} —{" "}
              {systemHealth.latestEpisodeTitle}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E2738] flex items-center justify-between font-mono text-xs">
            <Link
              href="/admin/episodes"
              className="text-[#C5A059] hover:underline"
            >
              Open Podcast Episode Studio →
            </Link>
            <Link
              href="/feed.xml"
              className="text-[#8E9BAE] hover:text-[#F3EFE6]"
            >
              /feed.xml ↗
            </Link>
          </div>
        </div>

        {/* Card 5: Authorized Accounts */}
        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#8E9BAE]">
                Authorized Admin Accounts
              </span>
              <span className="font-mono text-[11px] text-[#C5A059]">
                OWNER LOCK ACTIVE
              </span>
            </div>
            <div className="font-cinzel text-3xl font-bold text-[#F3EFE6] mt-2">
              {systemHealth.activeUsersCount} Active /{" "}
              {systemHealth.invitedUsersCount} Invited
            </div>
            <div className="font-mono text-xs text-[#9CA3AF] mt-1.5 truncate">
              Owner: {ownerEmail}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E2738] flex items-center justify-between font-mono text-xs">
            <Link
              href="/admin/users"
              className="text-[#C5A059] hover:underline"
            >
              Manage Users &amp; Invites →
            </Link>
            <span className="text-[#8E9BAE]">OAuth + Magic Link</span>
          </div>
        </div>

        {/* Card 6: Immutable Audit Ledger */}
        <div className="bg-[#111622] border border-[#263147] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-[#8E9BAE]">
                Immutable Audit Ledger
              </span>
              <span
                className={`font-mono text-[11px] font-bold ${
                  chainIntegrity?.valid !== false
                    ? "text-emerald-300"
                    : "text-red-300"
                }`}
              >
                {chainIntegrity?.valid !== false
                  ? "SHA-256 VERIFIED"
                  : "CHAIN ALERT"}
              </span>
            </div>
            <div className="font-cinzel text-3xl font-bold text-emerald-300 mt-2">
              {auditTotal} Chained Events
            </div>
            <div className="font-mono text-xs text-[#9CA3AF] mt-1.5 truncate">
              HEAD: {chainIntegrity?.headHash || "GENESIS"}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E2738] flex items-center justify-between font-mono text-xs">
            <Link
              href="/admin/audit"
              className="text-[#C5A059] hover:underline"
            >
              Open Replay &amp; Diff Studio →
            </Link>
            <div className="flex items-center gap-2">
              <a
                href="/api/admin/audit/export?format=md"
                className="text-[#8E9BAE] hover:text-[#F3EFE6]"
              >
                .MD
              </a>
              <span className="text-[#263147]">|</span>
              <a
                href="/api/admin/audit/export?format=json"
                className="text-[#8E9BAE] hover:text-[#F3EFE6]"
              >
                .JSON
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Immutable Audit Events Table */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg overflow-hidden">
        <div className="p-5 border-b border-[#263147] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-[#C5A059]">
              IMMUTABLE REPLAYABLE LEDGER // RECENT STATE TRANSITIONS
            </div>
            <h2 className="font-cinzel text-xl font-bold text-[#F3EFE6] mt-0.5">
              Recent Audit Trail Events ({auditEntries.length} of {auditTotal})
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/audit"
              className="px-3.5 py-2 rounded bg-[#161E2E] hover:bg-[#1E293B] border border-[#2E3C56] hover:border-[#C5A059] font-mono text-xs text-[#F3EFE6] transition-colors"
            >
              Explore Full Ledger, Diffs &amp; State Replay →
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#263147] bg-[#0D111A] font-mono text-[11px] uppercase text-[#8E9BAE]">
                <th className="py-3 px-4">#ID / Timestamp</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Actor &amp; Auth</th>
                <th className="py-3 px-4">Disclosure Reason</th>
                <th className="py-3 px-4">SHA-256 Chain Link</th>
                <th className="py-3 px-4 text-right">Inspect / Replay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2738] text-xs font-mono">
              {auditEntries.map((entry) => (
                <tr
                  key={entry.eventId}
                  className="hover:bg-[#161E2E]/60 transition-colors"
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-[#F3EFE6] font-semibold">
                      #{entry.id}
                    </div>
                    <div className="text-[11px] text-[#8E9BAE]">
                      {entry.timestamp.replace("T", " ").slice(0, 19)} UTC
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-[#182032] border border-[#2E3C56] text-[#C5A059] font-semibold">
                      {entry.actionType}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-[#D6D1C7]">{entry.targetType}</div>
                    <div className="text-[11px] text-[#8E9BAE] max-w-[180px] truncate">
                      {entry.targetId}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-[#F3EFE6]">{entry.actorEmail}</div>
                    <div className="text-[10px] text-[#8E9BAE]">
                      {entry.actorRole.toUpperCase()} • {entry.authMethod}
                    </div>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <div className="text-[#D6D1C7] line-clamp-2 font-sans text-xs">
                      {entry.reason || "—"}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div
                      className="text-[11px] text-emerald-300"
                      title={`Entry SHA-256: ${entry.entryHash}`}
                    >
                      {entry.entryHash.slice(0, 12)}…
                    </div>
                    <div
                      className="text-[10px] text-[#8E9BAE]"
                      title={`Prev SHA-256: ${entry.prevHash}`}
                    >
                      ←{" "}
                      {entry.prevHash === "GENESIS"
                        ? "GENESIS"
                        : `${entry.prevHash.slice(0, 10)}…`}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/audit?eventId=${encodeURIComponent(
                        entry.eventId
                      )}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#2E3C56] hover:border-[#C5A059] text-[#C5A059] text-[11px] transition-colors"
                    >
                      Diff / Replay →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Pipeline Execution Runs */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg overflow-hidden">
        <div className="p-5 border-b border-[#263147]">
          <div className="font-mono text-[11px] uppercase tracking-widest text-[#8E9BAE]">
            CLOUDFLARE EDGE TELEMETRY // PIPELINE_RUNS
          </div>
          <h2 className="font-cinzel text-lg font-bold text-[#F3EFE6] mt-0.5">
            Recent Automated &amp; Manual Pipeline Runs
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#263147] bg-[#0D111A] font-mono text-[11px] uppercase text-[#8E9BAE]">
                <th className="py-3 px-4">Run ID / Started</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Evaluated / Accepted / Noise</th>
                <th className="py-3 px-4">Avg Latency</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2738] text-xs font-mono">
              {initialPipelineRuns.map((run) => (
                <tr key={run.id} className="hover:bg-[#161E2E]/40">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-[#F3EFE6]">{run.id}</div>
                    <div className="text-[11px] text-[#8E9BAE]">
                      {run.startedAt.replace("T", " ").slice(0, 19)} UTC
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-[#C5A059]">
                    {run.runType}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        run.status === "nominal"
                          ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300"
                          : "bg-amber-950/60 border border-amber-500/40 text-amber-300"
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-[#D6D1C7]">
                    {run.itemsEvaluated} eval • {run.itemsAccepted} acc •{" "}
                    {run.itemsRejectedNoise} drop
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-[#8E9BAE]">
                    {run.avgClassifierLatencyMs}ms
                  </td>
                  <td className="py-3 px-4 text-[#9CA3AF] font-sans text-xs max-w-md truncate">
                    {run.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
