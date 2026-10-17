"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthenticatedAdminActor } from "@/pipeline/auth";
import type {
  AuditChainVerificationResult,
  AuditLedgerEntry,
} from "@/pipeline/audit";
import type {
  FeedTestPreviewResult,
  IngestFeedRecord,
} from "@/pipeline/ingest";

interface AdminFeedsClientProps {
  actor: AuthenticatedAdminActor;
  initialFeeds: IngestFeedRecord[];
  initialAuditEntries: AuditLedgerEntry[];
  chainIntegrity?: AuditChainVerificationResult;
}

const DOMAIN_SECTOR_OPTIONS = [
  "",
  "Public Policy & Governance",
  "Economics & Markets",
  "Technology & Cyber",
  "Infrastructure & Supply Chain",
  "Institutional Leadership",
];

export function AdminFeedsClient({
  actor,
  initialFeeds,
  initialAuditEntries,
  chainIntegrity,
}: AdminFeedsClientProps) {
  const router = useRouter();
  const [feeds, setFeeds] = useState<IngestFeedRecord[]>(initialFeeds);
  const [auditEntries, setAuditEntries] =
    useState<AuditLedgerEntry[]>(initialAuditEntries);

  // Create feed form state
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newFocusArea, setNewFocusArea] = useState("");
  const [newSectorOverride, setNewSectorOverride] = useState("");
  const [newItemsPerPoll, setNewItemsPerPoll] = useState(5);
  const [newReason, setNewReason] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // RSS Live Preview Tester state
  const [testingUrl, setTestingUrl] = useState(false);
  const [previewResult, setPreviewResult] =
    useState<FeedTestPreviewResult | null>(null);

  // Edit feed modal/drawer state
  const [editingFeed, setEditingFeed] = useState<IngestFeedRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editFocusArea, setEditFocusArea] = useState("");
  const [editSectorOverride, setEditSectorOverride] = useState("");
  const [editItemsPerPoll, setEditItemsPerPoll] = useState(5);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editReason, setEditReason] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete confirmation modal state
  const [deletingFeed, setDeletingFeed] = useState<IngestFeedRecord | null>(
    null
  );
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Status banner
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    title: string;
    detail: string;
  } | null>(null);

  const canMutate =
    actor.role === "owner" ||
    actor.role === "admin" ||
    actor.role === "editor";

  async function refreshAuditLog() {
    try {
      const res = await fetch(
        "/api/admin/audit?targetType=ingest_feed&limit=20",
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as { entries?: AuditLedgerEntry[] };
        if (Array.isArray(data.entries)) {
          setAuditEntries(data.entries);
        }
      }
    } catch {
      // ignore
    }
    router.refresh();
  }

  async function handleTestUrl(targetUrl?: string) {
    const urlToTest = (targetUrl ?? newUrl).trim();
    if (!urlToTest) {
      setBanner({
        type: "error",
        title: "Missing RSS/Atom URL",
        detail: "Enter an http:// or https:// feed URL to test.",
      });
      return;
    }

    setTestingUrl(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/feeds/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToTest, maxItems: 5 }),
      });
      const data = (await res.json()) as FeedTestPreviewResult;
      setPreviewResult(data);
      if (data.ok && data.feedTitle && !newName.trim() && !targetUrl) {
        setNewName(data.feedTitle.slice(0, 60));
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Feed Test Failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTestingUrl(false);
    }
  }

  async function handleCreateFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;

    setSubmittingCreate(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          url: newUrl.trim(),
          focusArea: newFocusArea.trim() || "Institutional & Systemic Telemetry",
          domainSectorOverride: newSectorOverride || null,
          itemsPerPoll: newItemsPerPoll,
          enabled: true,
          reason:
            newReason.trim() ||
            `Added inbound RSS/Atom feed "${newName.trim()}" to active ingestion rotation`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feed?: IngestFeedRecord;
        feeds?: IngestFeedRecord[];
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Create Inbound Feed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.feeds)) {
          setFeeds(data.feeds);
        } else if (data.feed) {
          setFeeds((prev) => [...prev, data.feed!]);
        }
        setNewName("");
        setNewUrl("");
        setNewFocusArea("");
        setNewSectorOverride("");
        setNewItemsPerPoll(5);
        setNewReason("");
        setBanner({
          type: "success",
          title: `Feed "${data.feed?.name}" Added & Audited`,
          detail: `Recorded feed.create in audit_ledger (${data.auditEntry?.entryHash.slice(
            0,
            12
          )}…).`,
        });
        await refreshAuditLog();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Create Feed Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingCreate(false);
    }
  }

  function openEditModal(feed: IngestFeedRecord) {
    setEditingFeed(feed);
    setEditName(feed.name);
    setEditUrl(feed.url);
    setEditFocusArea(feed.focusArea);
    setEditSectorOverride(feed.domainSectorOverride || "");
    setEditItemsPerPoll(feed.itemsPerPoll || 5);
    setEditEnabled(feed.enabled);
    setEditReason("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingFeed || !canMutate) return;

    setSubmittingEdit(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/feeds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingFeed.id,
          name: editName.trim(),
          url: editUrl.trim(),
          focusArea: editFocusArea.trim(),
          domainSectorOverride: editSectorOverride || null,
          itemsPerPoll: editItemsPerPoll,
          enabled: editEnabled,
          reason:
            editReason.trim() ||
            `Updated configuration for inbound feed "${editName.trim()}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feed?: IngestFeedRecord;
        feeds?: IngestFeedRecord[];
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Update Feed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.feeds)) {
          setFeeds(data.feeds);
        }
        setEditingFeed(null);
        setBanner({
          type: "success",
          title: `Updated Feed "${data.feed?.name}"`,
          detail: `Recorded feed.update in audit_ledger (${data.auditEntry?.entryHash.slice(
            0,
            12
          )}…).`,
        });
        await refreshAuditLog();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Update Feed Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingEdit(false);
    }
  }

  async function handleToggleFeedEnabled(feed: IngestFeedRecord) {
    if (!canMutate) return;
    setBanner(null);
    try {
      const nextEnabled = !feed.enabled;
      const res = await fetch("/api/admin/feeds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: feed.id,
          enabled: nextEnabled,
          reason: `${nextEnabled ? "Enabled" : "Paused"} polling for inbound feed "${feed.name}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feeds?: IngestFeedRecord[];
        auditEntry?: AuditLedgerEntry;
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Toggle Feed Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.feeds)) {
          setFeeds(data.feeds);
        }
        setBanner({
          type: "success",
          title: `${nextEnabled ? "Resumed" : "Paused"} "${feed.name}"`,
          detail: `Recorded feed.update in audit_ledger (${data.auditEntry?.entryHash.slice(
            0,
            12
          )}…).`,
        });
        await refreshAuditLog();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Toggle Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleConfirmDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deletingFeed || !canMutate) return;

    setSubmittingDelete(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/feeds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deletingFeed.id,
          reason:
            deleteReason.trim() ||
            `Removed inbound feed "${deletingFeed.name}" from active rotation`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feeds?: IngestFeedRecord[];
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Delete Feed Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.feeds)) {
          setFeeds(data.feeds);
        } else {
          setFeeds((prev) => prev.filter((f) => f.id !== deletingFeed.id));
        }
        const removedName = deletingFeed.name;
        setDeletingFeed(null);
        setDeleteReason("");
        setBanner({
          type: "success",
          title: `Deleted Feed "${removedName}"`,
          detail: `Recorded feed.delete with full before_state_json in audit_ledger (${data.auditEntry?.entryHash.slice(
            0,
            12
          )}…). Can be restored anytime via Audit Replay.`,
        });
        await refreshAuditLog();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Delete Feed Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingDelete(false);
    }
  }

  const activeFeedsCount = feeds.filter((f) => f.enabled).length;
  const pausedFeedsCount = feeds.length - activeFeedsCount;
  const totalIngestedAllFeeds = feeds.reduce(
    (sum, f) => sum + (f.totalIngested || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#263147] pb-6">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[#C5A059]">
            STAGE 1 TELEMETRY COLLECTOR // D1 INGEST_FEEDS REGISTRY
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F3EFE6] mt-1">
            Dynamic Inbound RSS &amp; Atom Feed Management
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1 max-w-3xl">
            Configure the live RSS 2.0 and Atom 1.0 feeds polled every 6 hours
            by the Cloudflare Worker. Test candidate URLs before adding them,
            pause noisy sources, or adjust items-per-poll—with every change
            hash-chained in{" "}
            <code className="text-[#C5A059] font-mono">audit_ledger</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/filters"
            className="px-3.5 py-2 rounded-md bg-[#151C2C] hover:bg-[#1D263B] border border-[#2E3C56] font-mono text-xs text-[#E5C178] transition-colors"
          >
            Configure Triage Filters →
          </Link>
          <Link
            href="/admin/audit?targetType=ingest_feed"
            className="px-3.5 py-2 rounded-md bg-[#111622] hover:bg-[#182032] border border-[#263147] font-mono text-xs text-[#D6D1C7] transition-colors"
          >
            Inspect Feed Audit Log ({chainIntegrity?.totalEntries ?? "—"})
          </Link>
        </div>
      </div>

      {/* Status Banner */}
      {banner && (
        <div
          className={`p-4 rounded-lg border font-mono text-xs flex items-start justify-between gap-4 ${
            banner.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-200"
              : "bg-red-950/60 border-red-500/50 text-red-200"
          }`}
        >
          <div>
            <div className="font-bold uppercase tracking-wider">
              {banner.title}
            </div>
            <div className="mt-1 opacity-90">{banner.detail}</div>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Telemetry Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#111622] border border-[#263147] rounded-lg p-4">
          <div className="font-mono text-[11px] uppercase text-[#8E9BAE]">
            Total Registered Feeds
          </div>
          <div className="text-2xl font-mono font-bold text-[#F3EFE6] mt-1">
            {feeds.length}
          </div>
          <div className="text-[11px] font-mono text-[#8E9BAE] mt-1">
            Stored in D1 <code>ingest_feeds</code>
          </div>
        </div>

        <div className="bg-[#111622] border border-[#263147] rounded-lg p-4">
          <div className="font-mono text-[11px] uppercase text-[#8E9BAE]">
            Active Polling Sources
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
            {activeFeedsCount}
          </div>
          <div className="text-[11px] font-mono text-[#8E9BAE] mt-1">
            {pausedFeedsCount} paused
          </div>
        </div>

        <div className="bg-[#111622] border border-[#263147] rounded-lg p-4">
          <div className="font-mono text-[11px] uppercase text-[#8E9BAE]">
            Max Items / Poll Pass
          </div>
          <div className="text-2xl font-mono font-bold text-[#C5A059] mt-1">
            {feeds
              .filter((f) => f.enabled)
              .reduce((s, f) => s + (f.itemsPerPoll || 5), 0)}
          </div>
          <div className="text-[11px] font-mono text-[#8E9BAE] mt-1">
            Across all enabled feeds
          </div>
        </div>

        <div className="bg-[#111622] border border-[#263147] rounded-lg p-4">
          <div className="font-mono text-[11px] uppercase text-[#8E9BAE]">
            Cumulative Tracked Dispatches
          </div>
          <div className="text-2xl font-mono font-bold text-sky-400 mt-1">
            {totalIngestedAllFeeds}
          </div>
          <div className="text-[11px] font-mono text-[#8E9BAE] mt-1">
            Net-new articles ingested via feeds
          </div>
        </div>
      </div>

      {/* Add New Feed + Live RSS/Atom URL Preview Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Add New Feed Form */}
        <div className="lg:col-span-6 bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#263147] pb-3">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#F3EFE6]">
                Add Inbound RSS / Atom Feed
              </h2>
              <p className="text-xs text-[#8E9BAE] font-mono">
                Emits <code>feed.create</code> to <code>audit_ledger</code>
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/50 font-mono text-[11px] text-[#E5C178]">
              RSS 2.0 / Atom 1.0
            </span>
          </div>

          <form onSubmit={handleCreateFeed} className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                Feed URL (RSS or Atom XML) *
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.cisa.gov/cybersecurity-advisories/all.xml"
                  className="flex-1 bg-[#0B0E14] border border-[#263147] focus:border-[#C5A059] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6] outline-none"
                />
                <button
                  type="button"
                  disabled={testingUrl}
                  onClick={() => handleTestUrl()}
                  className="px-3.5 py-2 rounded bg-[#182032] hover:bg-[#222D45] border border-[#3A4A6B] text-xs font-mono text-[#E5C178] font-semibold transition-colors cursor-pointer shrink-0"
                >
                  {testingUrl ? "Testing…" : "Test RSS URL"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Reuters US Domestic"
                  className="w-full bg-[#0B0E14] border border-[#263147] focus:border-[#C5A059] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6] outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Operational Focus Area *
                </label>
                <input
                  type="text"
                  required
                  value={newFocusArea}
                  onChange={(e) => setNewFocusArea(e.target.value)}
                  placeholder="e.g. Federal Policy & Grid Security"
                  className="w-full bg-[#0B0E14] border border-[#263147] focus:border-[#C5A059] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Domain Sector Override (Optional)
                </label>
                <select
                  value={newSectorOverride}
                  onChange={(e) => setNewSectorOverride(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#263147] focus:border-[#C5A059] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6] outline-none"
                >
                  <option value="">Auto-Infer from Dispatch Content</option>
                  {DOMAIN_SECTOR_OPTIONS.filter(Boolean).map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Items Inspected Per Poll (1–25)
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={newItemsPerPoll}
                  onChange={(e) =>
                    setNewItemsPerPoll(
                      Math.min(25, Math.max(1, Number(e.target.value) || 5))
                    )
                  }
                  className="w-full bg-[#0B0E14] border border-[#263147] focus:border-[#C5A059] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                Audit Disclosure Justification Reason
              </label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Expand primary-source infrastructure & regulatory telemetry coverage"
                className="w-full bg-[#0B0E14] border border-[#263147] focus:border-[#C5A059] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!canMutate || submittingCreate}
              className="w-full py-2.5 px-4 rounded bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {submittingCreate
                ? "Registering Feed in D1…"
                : "+ Add Feed & Record Audit Entry"}
            </button>
          </form>
        </div>

        {/* Right: Live RSS/Atom Feed Preview Inspector */}
        <div className="lg:col-span-6 bg-[#111622] border border-[#263147] rounded-lg p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-[#263147] pb-3">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#F3EFE6]">
                Live RSS / Atom Parser Preview
              </h2>
              <p className="text-xs text-[#8E9BAE] font-mono">
                Inspects raw XML, strips CDATA/HTML, and previews 5 dispatches
              </p>
            </div>
            {previewResult && (
              <span
                className={`px-2.5 py-0.5 rounded border font-mono text-[11px] font-semibold ${
                  previewResult.ok
                    ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                    : "bg-red-950/60 border-red-500/40 text-red-300"
                }`}
              >
                {previewResult.ok
                  ? `${(previewResult.feedFormat || "rss2").toUpperCase()} • ${
                      previewResult.itemCount
                    } ITEMS • ${previewResult.latencyMs}ms`
                  : "PARSE FAILED"}
              </span>
            )}
          </div>

          {!previewResult ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4 border border-dashed border-[#263147] rounded-lg bg-[#0B0E14]/50">
              <div className="font-mono text-xs text-[#8E9BAE]">
                Enter any candidate RSS 2.0 or Atom 1.0 URL on the left and
                click{" "}
                <span className="text-[#E5C178] font-semibold">
                  &ldquo;Test RSS URL&rdquo;
                </span>{" "}
                (or click{" "}
                <span className="text-[#E5C178] font-semibold">
                  &ldquo;Test Live&rdquo;
                </span>{" "}
                on any existing feed below) to inspect live dispatches before
                ingesting.
              </div>
            </div>
          ) : !previewResult.ok ? (
            <div className="p-4 rounded border border-red-500/40 bg-red-950/30 font-mono text-xs text-red-200 space-y-2">
              <div className="font-bold">
                Unable to Parse Feed: {previewResult.url}
              </div>
              <div>Error: {previewResult.error}</div>
              <div>Latency: {previewResult.latencyMs}ms</div>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1">
              <div className="flex items-center justify-between bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono">
                <div className="truncate">
                  <span className="text-[#8E9BAE]">Channel: </span>
                  <span className="text-[#E5C178] font-semibold">
                    {previewResult.feedTitle}
                  </span>
                </div>
                {previewResult.feedTitle && (
                  <button
                    type="button"
                    onClick={() =>
                      setNewName(previewResult.feedTitle!.slice(0, 60))
                    }
                    className="text-[11px] text-[#C5A059] hover:underline ml-2 shrink-0 cursor-pointer"
                  >
                    Use Title
                  </button>
                )}
              </div>

              {previewResult.items.map((item, idx) => (
                <div
                  key={item.urlHash || idx}
                  className="p-3 rounded bg-[#0B0E14] border border-[#263147] space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#F3EFE6] hover:text-[#C5A059] transition-colors"
                    >
                      {idx + 1}. {item.title} ↗
                    </a>
                    <span className="font-mono text-[10px] text-[#8E9BAE] shrink-0">
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] line-clamp-2">
                    {item.rawExcerpt}
                  </p>
                  <div className="font-mono text-[10px] text-[#64748B]">
                    SHA-256 URL Hash: {item.urlHash.slice(0, 16)}…
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Registered Inbound Feeds Table */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#263147] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-serif font-bold text-[#F3EFE6]">
              Configured Inbound Telemetry Feeds ({feeds.length})
            </h2>
            <p className="text-xs font-mono text-[#8E9BAE]">
              Active feeds are polled on every scheduled 6-hour cron pass and
              manual ingest run
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#263147] bg-[#0B0E14]/80 font-mono text-[11px] uppercase text-[#8E9BAE]">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Feed Name &amp; URL</th>
                <th className="py-3 px-4">Focus Area / Sector</th>
                <th className="py-3 px-4">Items / Poll</th>
                <th className="py-3 px-4">Ingested</th>
                <th className="py-3 px-4">Last Poll Health</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263147]/60 text-xs">
              {feeds.map((feed) => (
                <tr
                  key={feed.id}
                  className={`hover:bg-[#161D2B]/60 transition-colors ${
                    !feed.enabled ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-3.5 px-4 font-mono">
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => handleToggleFeedEnabled(feed)}
                      title="Click to toggle Active / Paused"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-semibold cursor-pointer transition-colors ${
                        feed.enabled
                          ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:border-emerald-400"
                          : "bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-400"
                      }`}
                    >
                      <span>{feed.enabled ? "●" : "⏸"}</span>
                      <span>{feed.enabled ? "ACTIVE" : "PAUSED"}</span>
                    </button>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#F3EFE6]">
                      {feed.name}
                    </div>
                    <a
                      href={feed.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-[#8E9BAE] hover:text-[#C5A059] break-all"
                    >
                      {feed.url}
                    </a>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="text-[#D6D1C7]">{feed.focusArea}</div>
                    {feed.domainSectorOverride && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#182032] border border-[#2E3C56] font-mono text-[10px] text-[#C5A059]">
                        {feed.domainSectorOverride}
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[#F3EFE6]">
                    {feed.itemsPerPoll} items
                  </td>

                  <td className="py-3.5 px-4 font-mono text-sky-300 font-semibold">
                    {feed.totalIngested}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          feed.lastStatus === "error"
                            ? "bg-red-400"
                            : "bg-emerald-400"
                        }`}
                      />
                      <span
                        className={
                          feed.lastStatus === "error"
                            ? "text-red-300"
                            : "text-emerald-300"
                        }
                      >
                        {(feed.lastStatus || "nominal").toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8E9BAE] mt-0.5">
                      {feed.lastPolledAt
                        ? `Polled ${new Date(
                            feed.lastPolledAt
                          ).toLocaleString()}`
                        : "Awaiting next poll"}
                    </div>
                    {feed.lastError && (
                      <div className="text-[10px] text-red-400 mt-0.5 truncate max-w-[200px]">
                        {feed.lastError}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTestUrl(feed.url)}
                        className="px-2.5 py-1 rounded bg-[#182032] hover:bg-[#222D45] border border-[#2E3C56] text-[11px] text-[#E5C178] cursor-pointer"
                      >
                        Test Live
                      </button>
                      {canMutate && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(feed)}
                            className="px-2.5 py-1 rounded bg-[#111622] hover:bg-[#1B2436] border border-[#263147] text-[11px] text-[#D6D1C7] cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingFeed(feed);
                              setDeleteReason("");
                            }}
                            className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-[11px] text-red-200 cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Feed Audit Ledger Entries */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#263147] pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-[#F3EFE6]">
              Recent Inbound Feed Audit Trail (<code>target_type = ingest_feed</code>)
            </h2>
            <p className="text-xs font-mono text-[#8E9BAE]">
              Every feed addition, pause/resume toggle, edit, or removal is
              cryptographically hash-chained and replayable
            </p>
          </div>
          <Link
            href="/admin/audit?targetType=ingest_feed"
            className="font-mono text-xs text-[#C5A059] hover:underline"
          >
            Open in Replay Studio →
          </Link>
        </div>

        {auditEntries.length === 0 ? (
          <div className="text-xs font-mono text-[#8E9BAE] py-4">
            No feed mutations recorded yet beyond baseline migration seed. Add
            or edit a feed above to append a live hash-chained audit entry.
          </div>
        ) : (
          <div className="space-y-2">
            {auditEntries.slice(0, 8).map((entry) => (
              <div
                key={entry.eventId}
                className="p-3 rounded bg-[#0B0E14] border border-[#263147] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-mono"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E5C178] text-[10px] font-bold">
                      {entry.actionType}
                    </span>
                    <span className="text-[#F3EFE6] font-semibold">
                      Target #{entry.targetId}
                    </span>
                    <span className="text-[#8E9BAE]">by {entry.actorEmail}</span>
                  </div>
                  <div className="text-[#9CA3AF] text-[11px]">
                    {entry.reason}
                  </div>
                </div>
                <div className="text-right text-[10px] text-[#8E9BAE] shrink-0">
                  <div>{new Date(entry.timestamp).toLocaleString()}</div>
                  <div className="text-emerald-400">
                    SHA-256: {entry.entryHash.slice(0, 14)}…
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Feed Modal */}
      {editingFeed && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111622] border border-[#C5A059] rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#263147] pb-3">
              <h3 className="text-lg font-serif font-bold text-[#F3EFE6]">
                Edit Inbound Feed #{editingFeed.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingFeed(null)}
                className="text-xs font-mono text-[#8E9BAE] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Feed URL *
                </label>
                <input
                  type="url"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Focus Area *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFocusArea}
                    onChange={(e) => setEditFocusArea(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Items Per Poll (1–25)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={editItemsPerPoll}
                    onChange={(e) =>
                      setEditItemsPerPoll(
                        Math.min(25, Math.max(1, Number(e.target.value) || 5))
                      )
                    }
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Domain Sector Override
                </label>
                <select
                  value={editSectorOverride}
                  onChange={(e) => setEditSectorOverride(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                >
                  <option value="">Auto-Infer from Dispatch Content</option>
                  {DOMAIN_SECTOR_OPTIONS.filter(Boolean).map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="edit-feed-enabled"
                  type="checkbox"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                />
                <label
                  htmlFor="edit-feed-enabled"
                  className="font-mono text-xs text-[#D6D1C7]"
                >
                  Feed Enabled in Scheduled &amp; Manual Ingestion Passes
                </label>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Audit Justification Reason
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for updating this feed configuration"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFeed(null)}
                  className="px-4 py-2 rounded border border-[#263147] text-xs font-mono text-[#9CA3AF] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-2 rounded bg-[#C5A059] text-[#0B0E14] text-xs font-mono font-bold cursor-pointer"
                >
                  {submittingEdit ? "Saving…" : "Save Changes & Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Feed Confirmation Modal */}
      {deletingFeed && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111622] border border-red-500/60 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-serif font-bold text-[#F3EFE6]">
              Remove Inbound Feed &ldquo;{deletingFeed.name}&rdquo;?
            </h3>
            <p className="text-xs text-[#9CA3AF]">
              This removes the feed from <code>ingest_feeds</code> and logs a{" "}
              <code>feed.delete</code> record in <code>audit_ledger</code> with
              its full <code>before_state_json</code> so it can be restored in
              one click via Audit Replay.
            </p>
            <form onSubmit={handleConfirmDelete} className="space-y-3">
              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Audit Deletion Reason *
                </label>
                <input
                  type="text"
                  required
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Retired duplicate or low-signal RSS endpoint"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingFeed(null)}
                  className="px-4 py-2 rounded border border-[#263147] text-xs font-mono text-[#9CA3AF] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelete}
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold cursor-pointer"
                >
                  {submittingDelete ? "Deleting…" : "Confirm Delete & Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
