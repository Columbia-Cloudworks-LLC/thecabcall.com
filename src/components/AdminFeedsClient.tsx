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
  initialAuditEntries?: AuditLedgerEntry[];
  chainIntegrity?: AuditChainVerificationResult;
  embedded?: boolean;
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
  embedded = false,
}: AdminFeedsClientProps) {
  const router = useRouter();
  const [feeds, setFeeds] = useState<IngestFeedRecord[]>(initialFeeds);

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

  // Edit feed modal state
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

  async function handleTestUrl(targetUrl?: string) {
    const urlToTest = (targetUrl ?? newUrl).trim();
    if (!urlToTest) {
      setBanner({
        type: "error",
        title: "Missing Feed URL",
        detail: "Enter an http:// or https:// RSS or Atom feed URL to test.",
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
          focusArea:
            newFocusArea.trim() || "Institutional & Infrastructure Coverage",
          domainSectorOverride: newSectorOverride || null,
          itemsPerPoll: newItemsPerPoll,
          enabled: true,
          reason:
            newReason.trim() ||
            `Added RSS source "${newName.trim()}" to monitored newsroom feeds`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feed?: IngestFeedRecord;
        feeds?: IngestFeedRecord[];
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Add RSS Source",
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
          title: `RSS Source "${data.feed?.name}" Added`,
          detail:
            "Source registered for scheduled and manual newsroom collection and recorded in the audit ledger.",
        });
        router.refresh();
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
            `Updated configuration for RSS source "${editName.trim()}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feed?: IngestFeedRecord;
        feeds?: IngestFeedRecord[];
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Update RSS Source",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.feeds)) {
          setFeeds(data.feeds);
        }
        setEditingFeed(null);
        setBanner({
          type: "success",
          title: `Updated RSS Source "${data.feed?.name}"`,
          detail: "Configuration saved and recorded in the audit ledger.",
        });
        router.refresh();
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
          reason: `${
            nextEnabled ? "Resumed" : "Paused"
          } collection for RSS source "${feed.name}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feeds?: IngestFeedRecord[];
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Toggle Source Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.feeds)) {
          setFeeds(data.feeds);
        }
        setBanner({
          type: "success",
          title: `${nextEnabled ? "Resumed" : "Paused"} "${feed.name}"`,
          detail: "Source status updated and recorded in the audit ledger.",
        });
        router.refresh();
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
            `Removed RSS source "${deletingFeed.name}" from active rotation`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feeds?: IngestFeedRecord[];
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Remove Source Failed",
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
          title: `Removed RSS Source "${removedName}"`,
          detail:
            "Full snapshot preserved in the audit ledger for 1-click restoration.",
        });
        router.refresh();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Remove Source Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingDelete(false);
    }
  }

  const activeFeedsCount = feeds.filter((f) => f.enabled).length;

  return (
    <div
      className={
        embedded
          ? "space-y-6"
          : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"
      }
    >
      {!embedded && (
        <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="font-display text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
              Editorial &amp; Feeds • Monitored Sources
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6]">
              Monitored RSS &amp; News Sources
            </h1>
            <p className="font-serif text-sm text-[#94A3B8] max-w-2xl">
              Manage the RSS and Atom publications checked for incoming stories.
              Test candidate feeds live before adding them.
            </p>
          </div>
          <Link
            href="/admin/incidents"
            className="px-3.5 py-2 bg-[#0B0E14] border border-[#8A6D3B]/50 hover:border-[#C5A059] font-display text-xs uppercase tracking-wider text-[#C5A059]"
          >
            ← Back to Case Briefs
          </Link>
        </div>
      )}

      {/* Status Banner */}
      {banner && (
        <div
          className={`p-4 border text-xs flex items-start justify-between gap-4 ${
            banner.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/45 text-emerald-200"
              : "bg-red-950/60 border-red-500/50 text-red-200"
          }`}
        >
          <div>
            <div className="font-display font-bold uppercase tracking-wider">
              {banner.title}
            </div>
            <div className="font-serif text-sm mt-1 text-[#F3EFE6]/90">
              {banner.detail}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="font-display text-xs uppercase tracking-wider opacity-75 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add New Feed + Live RSS/Atom URL Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Add New Feed Form */}
        <div className="lg:col-span-6 relative bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
            <div>
              <h2 className="font-display text-base sm:text-lg text-[#F3EFE6] tracking-wide">
                Add RSS or Atom Source
              </h2>
              <p className="font-serif text-xs text-[#94A3B8]">
                Test a feed URL below, then add it to the monitored rotation.
              </p>
            </div>
            <span className="px-2.5 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/45 font-display text-[10px] uppercase tracking-wider text-[#C5A059]">
              {activeFeedsCount} of {feeds.length} Active
            </span>
          </div>

          <form onSubmit={handleCreateFeed} className="space-y-4">
            <div>
              <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                Feed URL (RSS or Atom XML) *
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.cisa.gov/cybersecurity-advisories/all.xml"
                  className="flex-1 bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] px-3 py-2 text-xs font-mono text-[#F3EFE6] outline-none"
                />
                <button
                  type="button"
                  disabled={testingUrl}
                  onClick={() => handleTestUrl()}
                  className="px-3.5 py-2 bg-[#0B0E14] hover:border-[#C5A059] border border-[#8A6D3B]/55 text-xs font-display uppercase tracking-wider text-[#C5A059] font-semibold transition-all duration-200 ease-out cursor-pointer shrink-0"
                >
                  {testingUrl ? "Testing…" : "Test Feed"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Publication / Source Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Reuters Infrastructure"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] px-3 py-2 text-xs font-sans text-[#F3EFE6] outline-none"
                />
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Editorial Beat / Focus *
                </label>
                <input
                  type="text"
                  required
                  value={newFocusArea}
                  onChange={(e) => setNewFocusArea(e.target.value)}
                  placeholder="e.g. Grid Reliability & Public Policy"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] px-3 py-2 text-xs font-sans text-[#F3EFE6] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Primary Topic Sector (Optional)
                </label>
                <select
                  value={newSectorOverride}
                  onChange={(e) => setNewSectorOverride(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] px-3 py-2 text-xs font-sans text-[#F3EFE6] outline-none"
                >
                  <option value="">Infer Automatically from Story</option>
                  {DOMAIN_SECTOR_OPTIONS.filter(Boolean).map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Stories Checked Per Fetch (1–25)
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
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] px-3 py-2 text-xs font-mono text-[#F3EFE6] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                Editorial Note (Recorded in Audit Ledger)
              </label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Expand primary-source infrastructure reporting"
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] px-3 py-2 text-xs font-serif text-[#F3EFE6] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!canMutate || submittingCreate}
              className="w-full py-2.5 px-4 bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer"
            >
              {submittingCreate ? "Adding Source…" : "+ Add RSS Source"}
            </button>
          </form>
        </div>

        {/* Right: Live RSS/Atom Feed Preview Inspector */}
        <div className="lg:col-span-6 relative bg-[#111726] border border-[#8A6D3B]/45 p-6 flex flex-col justify-between space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
            <div>
              <h2 className="font-display text-base sm:text-lg text-[#F3EFE6] tracking-wide">
                Live Feed Preview
              </h2>
              <p className="font-serif text-xs text-[#94A3B8]">
                Preview incoming headlines and excerpts before adding a source.
              </p>
            </div>
            {previewResult && (
              <span
                className={`px-2.5 py-0.5 border font-display text-[10px] uppercase tracking-wider font-semibold ${
                  previewResult.ok
                    ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                    : "bg-red-950/60 border-red-500/40 text-red-300"
                }`}
              >
                {previewResult.ok
                  ? `${previewResult.itemCount} Stories Found`
                  : "Parse Error"}
              </span>
            )}
          </div>

          {!previewResult ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4 border border-dashed border-[#8A6D3B]/40 bg-[#0B0E14]/50">
              <div className="font-serif text-sm text-[#94A3B8] max-w-md">
                Enter an RSS or Atom URL on the left and click{" "}
                <span className="text-[#C5A059] font-semibold">
                  &ldquo;Test Feed&rdquo;
                </span>{" "}
                (or click{" "}
                <span className="text-[#C5A059] font-semibold">
                  &ldquo;Preview&rdquo;
                </span>{" "}
                on any source below) to inspect its latest stories.
              </div>
            </div>
          ) : !previewResult.ok ? (
            <div className="p-4 border border-red-500/40 bg-red-950/30 text-xs text-red-200 space-y-2">
              <div className="font-display uppercase tracking-wider font-bold">
                Unable to Read Feed: {previewResult.url}
              </div>
              <div className="font-serif">{previewResult.error}</div>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1">
              <div className="flex items-center justify-between bg-[#0B0E14] border border-[#8A6D3B]/40 px-3 py-2 text-xs">
                <div className="truncate">
                  <span className="text-[#94A3B8]">Channel: </span>
                  <span className="font-display text-[#C5A059] font-semibold">
                    {previewResult.feedTitle}
                  </span>
                </div>
                {previewResult.feedTitle && (
                  <button
                    type="button"
                    onClick={() =>
                      setNewName(previewResult.feedTitle!.slice(0, 60))
                    }
                    className="font-display text-[10px] uppercase tracking-wider text-[#C5A059] hover:underline ml-2 shrink-0 cursor-pointer"
                  >
                    Use Name
                  </button>
                )}
              </div>

              {previewResult.items.map((item, idx) => (
                <div
                  key={item.urlHash || idx}
                  className="p-3 bg-[#0B0E14] border border-[#8A6D3B]/35 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-serif text-sm font-semibold text-[#F3EFE6] hover:text-[#C5A059] transition-colors"
                    >
                      {idx + 1}. {item.title} ↗
                    </a>
                    <span className="font-sans text-[11px] text-[#94A3B8] shrink-0">
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="font-serif text-xs text-[#94A3B8] line-clamp-2">
                    {item.rawExcerpt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configured RSS Sources List */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#8A6D3B]/35 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-display text-base sm:text-lg text-[#F3EFE6] tracking-wide">
              Monitored RSS Sources ({feeds.length})
            </h2>
            <p className="font-serif text-xs text-[#94A3B8]">
              Active sources are checked automatically every 6 hours and when
              clicking &ldquo;Fetch Latest News&rdquo;.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#8A6D3B]/35 bg-[#0B0E14]/90 font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Source &amp; Feed URL</th>
                <th className="py-3 px-4">Beat &amp; Sector</th>
                <th className="py-3 px-4">Stories / Fetch</th>
                <th className="py-3 px-4">Collected</th>
                <th className="py-3 px-4">Last Checked</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8A6D3B]/25 text-xs">
              {feeds.map((feed) => (
                <tr
                  key={feed.id}
                  className={`hover:bg-[#0B0E14]/50 transition-colors ${
                    !feed.enabled ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => handleToggleFeedEnabled(feed)}
                      title="Click to toggle Active / Paused"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-display text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors ${
                        feed.enabled
                          ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:border-emerald-400"
                          : "bg-[#0B0E14] border-[#8A6D3B]/40 text-[#94A3B8]"
                      }`}
                    >
                      <span>{feed.enabled ? "●" : "⏸"}</span>
                      <span>{feed.enabled ? "Active" : "Paused"}</span>
                    </button>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-display text-sm text-[#F3EFE6]">
                      {feed.name}
                    </div>
                    <a
                      href={feed.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-[#94A3B8] hover:text-[#C5A059] break-all"
                    >
                      {feed.url}
                    </a>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-serif text-xs text-[#F3EFE6]/90">
                      {feed.focusArea}
                    </div>
                    {feed.domainSectorOverride && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/45 font-display text-[10px] uppercase tracking-wider text-[#C5A059]">
                        {feed.domainSectorOverride}
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-sans text-[#F3EFE6]">
                    {feed.itemsPerPoll} stories
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[#C5A059] font-semibold">
                    {feed.totalIngested}
                  </td>

                  <td className="py-3.5 px-4 text-[11px]">
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
                        {feed.lastStatus === "error" ? "Error" : "Healthy"}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      {feed.lastPolledAt
                        ? new Date(feed.lastPolledAt).toLocaleDateString()
                        : "Ready"}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5 font-display text-[10px] uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => handleTestUrl(feed.url)}
                        className="px-2.5 py-1 bg-[#0B0E14] hover:border-[#C5A059] border border-[#8A6D3B]/45 text-[#C5A059] cursor-pointer"
                      >
                        Preview
                      </button>
                      {canMutate && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(feed)}
                            className="px-2.5 py-1 bg-[#0B0E14] hover:border-[#C5A059] border border-[#8A6D3B]/45 text-[#F3EFE6] cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingFeed(feed);
                              setDeleteReason("");
                            }}
                            className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-200 cursor-pointer"
                          >
                            Remove
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

      {/* Subtle Footer Link to Feed Audit History */}
      <div className="flex items-center justify-between pt-1 text-xs text-[#94A3B8]">
        <span className="font-serif italic">
          All RSS source additions, edits, and removals are recorded in the
          immutable audit ledger.
        </span>
        <Link
          href="/admin/audit?targetType=ingest_feed"
          className="font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
        >
          View Source Audit History →
        </Link>
      </div>

      {/* Edit Feed Modal */}
      {editingFeed && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-[#C5A059] max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
              <h3 className="font-display text-lg text-[#F3EFE6]">
                Edit RSS Source — {editingFeed.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingFeed(null)}
                className="text-xs font-display text-[#94A3B8] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Source Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs text-[#F3EFE6]"
                />
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Feed URL *
                </label>
                <input
                  type="url"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Editorial Beat *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFocusArea}
                    onChange={(e) => setEditFocusArea(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs text-[#F3EFE6]"
                  />
                </div>

                <div>
                  <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Stories Per Fetch (1–25)
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
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Topic Sector Override
                </label>
                <select
                  value={editSectorOverride}
                  onChange={(e) => setEditSectorOverride(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs text-[#F3EFE6]"
                >
                  <option value="">Infer Automatically from Story</option>
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
                  className="font-sans text-xs text-[#F3EFE6]"
                >
                  Include source in scheduled and manual newsroom fetches
                </label>
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Editorial Note
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for updating this source"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFeed(null)}
                  className="px-4 py-2 border border-[#8A6D3B]/45 text-xs font-display uppercase tracking-wider text-[#94A3B8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-2 bg-[#C5A059] text-[#0B0E14] text-xs font-display uppercase tracking-wider font-bold cursor-pointer"
                >
                  {submittingEdit ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Feed Confirmation Modal */}
      {deletingFeed && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-red-500/60 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-display text-lg text-[#F3EFE6]">
              Remove RSS Source &ldquo;{deletingFeed.name}&rdquo;?
            </h3>
            <p className="font-serif text-xs text-[#94A3B8]">
              This removes the feed from active rotation. A complete snapshot is
              saved in the audit ledger so it can be restored in one click.
            </p>
            <form onSubmit={handleConfirmDelete} className="space-y-3">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Reason for Removal *
                </label>
                <input
                  type="text"
                  required
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Retired duplicate or low-signal RSS feed"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingFeed(null)}
                  className="px-4 py-2 border border-[#8A6D3B]/45 text-xs font-display uppercase tracking-wider text-[#94A3B8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelete}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-display uppercase tracking-wider font-bold cursor-pointer"
                >
                  {submittingDelete ? "Removing…" : "Confirm Removal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
