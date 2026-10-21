"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  HairlineSection,
  HeroCornerBrackets,
} from "@/components/ui/BroadsheetPrimitives";
import type { AuthenticatedAdminActor } from "@/pipeline/auth";
import type { OutboundFeedConfig } from "@/pipeline/publishing";
import { WORKING_TOOLS } from "@/lib/taxonomy";

interface AdminPublishingClientProps {
  actor: AuthenticatedAdminActor;
  initialFeeds: OutboundFeedConfig[];
  initialPreview: {
    slug: string;
    format: "xml" | "json";
    content: string;
  };
  episodeCount: number;
  incidentCount: number;
}

const BUILTIN_SLUGS = new Set([
  "podcast-rss",
  "incidents-rss",
  "incidents-json",
]);

export function resolvePublicFeedPath(slug: string): string {
  if (slug === "podcast-rss") return "/feed.xml";
  if (slug === "incidents-rss") return "/feeds/incidents.xml";
  if (slug === "incidents-json") return "/feeds/incidents.json";
  if (slug.endsWith("-json")) return `/feeds/${slug}.json`;
  return `/feeds/${slug}.xml`;
}

export function resolveFeedFormatBadge(slug: string): string {
  if (slug === "podcast-rss") return "RSS 2.0 + iTunes XML";
  if (slug === "incidents-json" || slug.endsWith("-json")) {
    return "JSON Feed 1.1";
  }
  return "RSS 2.0 + Media XML";
}

export function AdminPublishingClient({
  actor,
  initialFeeds,
  initialPreview,
  episodeCount,
  incidentCount,
}: AdminPublishingClientProps) {
  const [feeds, setFeeds] = useState<OutboundFeedConfig[]>(initialFeeds);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialFeeds[0]?.slug || "podcast-rss"
  );

  const activeFeed = useMemo(
    () =>
      feeds.find((f) => f.slug === selectedSlug) ||
      feeds[0] ||
      initialFeeds[0],
    [feeds, selectedSlug, initialFeeds]
  );

  const [draft, setDraft] = useState<OutboundFeedConfig>(() => ({
    ...(initialFeeds[0] || {
      id: 1,
      slug: "podcast-rss",
      title: "Change Advisory Board (The CAB Call)",
      subtitle: "Weekly Systems Dispatches & Craft Failure Analysis",
      description: "",
      authorName: "Change Advisory Board",
      ownerEmail: "telemetry@thecabcall.com",
      coverImageUrl: null,
      language: "en-us",
      category: "Technology",
      maxItems: 50,
      useDeescalatedTitles: true,
      includeOriginalTitleNote: true,
      includeAttachedImages: true,
      includeFullSocraticBrief: true,
      includeAuditLedgerFooter: true,
      filterWorkingTool: null,
      enabled: true,
      updatedAt: new Date().toISOString(),
    }),
  }));

  const [auditReason, setAuditReason] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [refreshingPreview, setRefreshingPreview] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<{
    slug: string;
    format: "xml" | "json";
    content: string;
  }>(initialPreview);

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFeedSlug, setNewFeedSlug] = useState<string>("incidents-the-square");
  const [newFeedTitle, setNewFeedTitle] = useState<string>(
    "The CAB Call — The Square Case Briefs"
  );
  const [newFeedSubtitle, setNewFeedSubtitle] = useState<string>(
    "Filtered Craftsman's Briefs for Governance & Fair Dealing"
  );
  const [newFeedDescription, setNewFeedDescription] = useState<string>(
    "Dedicated syndication feed of Craftsman's Briefs classified under The Square."
  );
  const [newFeedTool, setNewFeedTool] = useState<string>("The Square");
  const [newFeedReason, setNewFeedReason] = useState<string>(
    "Created dedicated Working Tool syndication channel."
  );
  const [creatingFeed, setCreatingFeed] = useState<boolean>(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    title: string;
    detail: string;
    auditEventId?: string;
  } | null>(null);

  const isReadOnlyAuditor = actor.role === "auditor";

  async function selectFeedAndLoadPreview(feed: OutboundFeedConfig) {
    setSelectedSlug(feed.slug);
    setDraft({ ...feed });
    setStatusMessage(null);
    await handleLivePreview(feed);
  }

  async function handleLivePreview(configToPreview: OutboundFeedConfig = draft) {
    setRefreshingPreview(true);
    try {
      const res = await fetch("/api/admin/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          draftConfig: configToPreview,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        preview?: { slug: string; format: "xml" | "json"; content: string };
      };
      if (res.ok && data.preview) {
        setPreviewData(data.preview);
      }
    } catch {
      // keep existing preview
    } finally {
      setRefreshingPreview(false);
    }
  }

  async function handleSaveFeed(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnlyAuditor) return;
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/publishing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idOrSlug: draft.slug,
          title: draft.title,
          subtitle: draft.subtitle,
          description: draft.description,
          authorName: draft.authorName,
          ownerEmail: draft.ownerEmail,
          coverImageUrl: draft.coverImageUrl,
          language: draft.language,
          category: draft.category,
          maxItems: draft.maxItems,
          useDeescalatedTitles: draft.useDeescalatedTitles,
          includeOriginalTitleNote: draft.includeOriginalTitleNote,
          includeAttachedImages: draft.includeAttachedImages,
          includeFullSocraticBrief: draft.includeFullSocraticBrief,
          includeAuditLedgerFooter: draft.includeAuditLedgerFooter,
          filterWorkingTool: draft.filterWorkingTool,
          enabled: draft.enabled,
          reason:
            auditReason.trim() ||
            `Updated syndication settings for ${draft.slug} in Publishing Studio.`,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feed?: OutboundFeedConfig;
        feeds?: OutboundFeedConfig[];
        auditEventId?: string;
        preview?: { slug: string; format: "xml" | "json"; content: string };
      };

      if (!res.ok || !data.ok || !data.feed) {
        throw new Error(data.error || "Failed to update outbound feed.");
      }

      if (Array.isArray(data.feeds)) {
        setFeeds(data.feeds);
      }
      setDraft({ ...data.feed });
      if (data.preview) {
        setPreviewData(data.preview);
      }
      setAuditReason("");
      setStatusMessage({
        type: "success",
        title: "Syndication Feed Updated",
        detail: `Saved ${data.feed.title} (${resolvePublicFeedPath(
          data.feed.slug
        )}) and recorded outbound_feed.update in the immutable audit ledger.`,
        auditEventId: data.auditEventId,
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        title: "Update Failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCustomFeed(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnlyAuditor) return;
    setCreatingFeed(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          slug: newFeedSlug,
          title: newFeedTitle,
          subtitle: newFeedSubtitle,
          description: newFeedDescription,
          filterWorkingTool: newFeedTool || null,
          reason:
            newFeedReason.trim() ||
            `Created custom outbound syndication feed '${newFeedSlug}'.`,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feed?: OutboundFeedConfig;
        feeds?: OutboundFeedConfig[];
        auditEventId?: string;
        preview?: { slug: string; format: "xml" | "json"; content: string };
      };

      if (!res.ok || !data.ok || !data.feed) {
        throw new Error(data.error || "Failed to create custom feed.");
      }

      if (Array.isArray(data.feeds)) {
        setFeeds(data.feeds);
      }
      setSelectedSlug(data.feed.slug);
      setDraft({ ...data.feed });
      if (data.preview) {
        setPreviewData(data.preview);
      }
      setShowCreateModal(false);
      setStatusMessage({
        type: "success",
        title: "Custom Syndication Feed Created",
        detail: `Published ${resolvePublicFeedPath(
          data.feed.slug
        )} and recorded outbound_feed.create in the immutable audit ledger.`,
        auditEventId: data.auditEventId,
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        title: "Creation Failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCreatingFeed(false);
    }
  }

  async function handleDeleteCustomFeed(slug: string) {
    if (isReadOnlyAuditor || BUILTIN_SLUGS.has(slug)) return;
    try {
      const res = await fetch("/api/admin/publishing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idOrSlug: slug,
          reason:
            auditReason.trim() ||
            `Removed custom syndication feed '${slug}' from Publishing Studio.`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        feeds?: OutboundFeedConfig[];
        auditEventId?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete custom feed.");
      }
      const nextFeeds = data.feeds || feeds.filter((f) => f.slug !== slug);
      setFeeds(nextFeeds);
      const fallback = nextFeeds[0];
      if (fallback) {
        await selectFeedAndLoadPreview(fallback);
      }
      setStatusMessage({
        type: "success",
        title: "Custom Feed Removed",
        detail: `Deleted custom feed '${slug}' and recorded outbound_feed.delete in the audit ledger.`,
        auditEventId: data.auditEventId,
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        title: "Delete Failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const publicPath = resolvePublicFeedPath(draft.slug);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Studio Masthead */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 shadow-xl">
        <HeroCornerBrackets size="sm" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="font-display text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
              Settings &amp; Audit • Outbound Syndication Studio
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] tracking-wide">
              Syndication &amp; Outbound Feeds
            </h1>
            <p className="font-serif text-sm text-[#94A3B8] max-w-2xl">
              Configure channel metadata, de-alarmed headline rules, media
              enclosures, and audit provenance footers across {feeds.length}{" "}
              public feeds serving {episodeCount} podcast episodes and{" "}
              {incidentCount} synthesized Craftsman&apos;s Briefs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isReadOnlyAuditor && (
              <button
                type="button"
                onClick={() => setShowCreateModal((prev) => !prev)}
                className="px-3.5 py-2 bg-[#111726] border border-[#8A6D3B]/60 hover:border-[#C5A059] text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out cursor-pointer"
              >
                {showCreateModal ? "Close New Feed Form" : "+ New Tool Feed"}
              </button>
            )}
            <a
              href="https://thecabcall.com/feeds"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-[#C5A059]/15 border border-[#C5A059] hover:bg-[#C5A059]/25 text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out"
            >
              Public Syndication Directory ↗
            </a>
          </div>
        </div>
      </div>

      {/* Inline Status Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`p-4 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-100"
              : "bg-red-950/60 border-red-500/60 text-red-100"
          }`}
        >
          <div className="space-y-0.5">
            <div className="font-display text-xs uppercase tracking-wider font-semibold">
              {statusMessage.title}
            </div>
            <p className="font-serif text-xs sm:text-sm opacity-90">
              {statusMessage.detail}
            </p>
          </div>
          {statusMessage.auditEventId && (
            <Link
              href={`/admin/audit?eventId=${encodeURIComponent(
                statusMessage.auditEventId
              )}`}
              className="px-3 py-1.5 bg-[#0B0E14]/80 border border-[#C5A059]/50 hover:border-[#C5A059] text-xs font-display uppercase tracking-wider text-[#C5A059] shrink-0"
            >
              View in Audit Ledger →
            </Link>
          )}
        </div>
      )}

      {/* Optional Create Custom Filtered Feed Drawer */}
      {showCreateModal && (
        <form
          onSubmit={handleCreateCustomFeed}
          className="bg-[#111726] border border-[#C5A059]/60 p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/30 pb-3">
            <div>
              <div className="font-display text-[11px] uppercase tracking-[0.16em] text-[#C5A059]">
                Custom Outbound Channel
              </div>
              <h2 className="font-display text-lg text-[#F3EFE6]">
                Create Filtered Syndication Feed
              </h2>
            </div>
            <span className="font-mono text-xs text-[#94A3B8]">
              /feeds/{newFeedSlug || "custom"}.xml
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="space-y-1 block">
              <span className="font-display text-[11px] uppercase tracking-wider text-[#C5A059]">
                Feed Slug
              </span>
              <input
                type="text"
                required
                value={newFeedSlug}
                onChange={(e) => setNewFeedSlug(e.target.value)}
                placeholder="incidents-the-square"
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </label>

            <label className="space-y-1 block">
              <span className="font-display text-[11px] uppercase tracking-wider text-[#C5A059]">
                Channel Title
              </span>
              <input
                type="text"
                required
                value={newFeedTitle}
                onChange={(e) => setNewFeedTitle(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </label>

            <label className="space-y-1 block">
              <span className="font-display text-[11px] uppercase tracking-wider text-[#C5A059]">
                Filter by Working Tool
              </span>
              <select
                value={newFeedTool}
                onChange={(e) => setNewFeedTool(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              >
                <option value="">All Six Working Tools</option>
                {WORKING_TOOLS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 block">
              <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                Channel Subtitle
              </span>
              <input
                type="text"
                value={newFeedSubtitle}
                onChange={(e) => setNewFeedSubtitle(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </label>

            <label className="space-y-1 block">
              <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                Audit Disclosure Reason
              </span>
              <input
                type="text"
                value={newFeedReason}
                onChange={(e) => setNewFeedReason(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
              Channel Description
            </span>
            <textarea
              rows={2}
              value={newFeedDescription}
              onChange={(e) => setNewFeedDescription(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3.5 py-2 border border-[#8A6D3B]/40 text-xs font-display uppercase tracking-wider text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingFeed}
              className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-display text-xs uppercase tracking-wider font-semibold cursor-pointer disabled:opacity-50"
            >
              {creatingFeed ? "Publishing Feed..." : "Create & Publish Feed"}
            </button>
          </div>
        </form>
      )}

      {/* Outbound Feed Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {feeds.map((feed) => {
          const isSelected = feed.slug === activeFeed?.slug;
          const feedPath = resolvePublicFeedPath(feed.slug);
          const formatBadge = resolveFeedFormatBadge(feed.slug);

          return (
            <div
              key={feed.slug}
              onClick={() => void selectFeedAndLoadPreview(feed)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void selectFeedAndLoadPreview(feed);
                }
              }}
              className={`group relative bg-[#111726] border p-5 flex flex-col justify-between gap-4 transition-all duration-200 ease-out cursor-pointer ${
                isSelected
                  ? "border-[#C5A059] shadow-[0_0_24px_rgba(197,160,89,0.14)]"
                  : "border-[#8A6D3B]/45 hover:border-[#C5A059]/75"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] font-semibold">
                    {formatBadge}
                  </span>
                  <span
                    className={`font-display text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                      feed.enabled
                        ? "border-emerald-500/40 text-emerald-300 bg-emerald-950/40"
                        : "border-amber-500/40 text-amber-300 bg-amber-950/40"
                    }`}
                  >
                    {feed.enabled ? "Active" : "Paused"}
                  </span>
                </div>

                <h2 className="font-display text-base text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors tracking-wide">
                  {feed.title}
                </h2>

                <p className="font-serif text-xs text-[#94A3B8] leading-relaxed line-clamp-2">
                  {feed.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#8A6D3B]/30 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-[#94A3B8] truncate">
                  https://thecabcall.com{feedPath}
                </span>
                <a
                  href={feedPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors shrink-0"
                >
                  Inspect Feed ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Two-Column Editor & Live XML/JSON Preview Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Channel Metadata & Editorial Syndication Toggles */}
        <form
          onSubmit={handleSaveFeed}
          className="lg:col-span-7 bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#8A6D3B]/35 pb-4">
            <div>
              <div className="font-display text-[11px] uppercase tracking-[0.16em] text-[#C5A059]">
                Active Feed Configuration • {draft.slug}
              </div>
              <h2 className="font-display text-xl text-[#F3EFE6] tracking-wide">
                {draft.title}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {!BUILTIN_SLUGS.has(draft.slug) && !isReadOnlyAuditor && (
                <button
                  type="button"
                  onClick={() => void handleDeleteCustomFeed(draft.slug)}
                  className="text-xs font-display uppercase tracking-wider text-red-300 hover:text-red-200 cursor-pointer"
                >
                  Delete Custom Feed
                </button>
              )}
              <a
                href={publicPath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6]"
              >
                Inspect Feed ↗
              </a>
            </div>
          </div>

          {/* Section 1: Channel Identity & Metadata */}
          <HairlineSection
            eyebrow="I. Channel Identity & Metadata"
            title="Title, Author & Distribution Parameters"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label className="space-y-1 block sm:col-span-2">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#C5A059]">
                  Channel Title
                </span>
                <input
                  type="text"
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-sm font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </label>

              <label className="space-y-1 block sm:col-span-2">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Subtitle
                </span>
                <input
                  type="text"
                  value={draft.subtitle}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </label>

              <label className="space-y-1 block sm:col-span-2">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Channel Description
                </span>
                <textarea
                  rows={3}
                  required
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6] leading-relaxed focus:border-[#C5A059] focus:outline-none max-w-prose"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Author / Publisher Name
                </span>
                <input
                  type="text"
                  value={draft.authorName}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      authorName: e.target.value,
                    }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Owner Contact Email
                </span>
                <input
                  type="email"
                  value={draft.ownerEmail}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      ownerEmail: e.target.value,
                    }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Cover Artwork URL (Optional)
                </span>
                <input
                  type="text"
                  value={draft.coverImageUrl || ""}
                  placeholder="https://thecabcall.com/media/podcast-cover-square.png"
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      coverImageUrl: e.target.value || null,
                    }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Directory Category
                </span>
                <input
                  type="text"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, category: e.target.value }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Maximum Items in Feed
                </span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={draft.maxItems}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      maxItems: Math.max(
                        1,
                        Math.min(200, Number(e.target.value) || 50)
                      ),
                    }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Working Tool Filter
                </span>
                <select
                  value={draft.filterWorkingTool || ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      filterWorkingTool: e.target.value || null,
                    }))
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                >
                  <option value="">All Six Working Tools (Unfiltered)</option>
                  {WORKING_TOOLS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} Only
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </HairlineSection>

          {/* Section 2: Editorial Syndication Switches */}
          <HairlineSection
            eyebrow="II. Editorial Syndication Rules"
            title="Headline De-Escalation, Enclosures & Provenance Toggles"
          >
            <div className="divide-y divide-[#8A6D3B]/25 pt-1">
              {[
                {
                  key: "useDeescalatedTitles" as const,
                  label: "Use De-Alarmed Titles",
                  description:
                    "Publish calm, neutralized Craftsman's Brief titles instead of alarmist raw source headlines.",
                },
                {
                  key: "includeOriginalTitleNote" as const,
                  label: "Original Headline Provenance Note",
                  description:
                    "Append an explicit 'Original source headline: ...' transparency note whenever a title was neutralized.",
                },
                {
                  key: "includeAttachedImages" as const,
                  label: "Attach Incident Images (<media:content> & <enclosure>)",
                  description:
                    "Emit RSS Media <media:content>, <enclosure>, and JSON Feed image attachments so subscribers see blueprint cards and photos.",
                },
                {
                  key: "includeFullSocraticBrief" as const,
                  label: "Include Full Socratic Brief",
                  description:
                    "Publish all three sections of the Craftsman's Brief (or disable to syndicate only the 2-sentence Executive Summary).",
                },
                {
                  key: "includeAuditLedgerFooter" as const,
                  label: "Audit Trail Verification Footer",
                  description:
                    "Include a cryptographic SHA-256 ledger verification footer linking back to the canonical Trestleboard brief.",
                },
                {
                  key: "enabled" as const,
                  label: "Syndication Feed Active",
                  description:
                    "Serve live 200 OK XML/JSON responses to external RSS readers and podcast directories.",
                },
              ].map((toggle) => (
                <label
                  key={toggle.key}
                  className="py-3 flex items-start justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <div className="font-display text-xs text-[#F3EFE6] tracking-wide">
                      {toggle.label}
                    </div>
                    <p className="font-serif text-xs text-[#94A3B8]">
                      {toggle.description}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(draft[toggle.key])}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [toggle.key]: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 accent-[#C5A059] cursor-pointer shrink-0"
                  />
                </label>
              ))}
            </div>
          </HairlineSection>

          {/* Section 3: Audit Justification & Save Bar */}
          <HairlineSection
            eyebrow="III. Immutable Audit Ledger Attribution"
            title="Record Change in Governance Ledger"
          >
            <div className="space-y-4 pt-2">
              <label className="space-y-1 block">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                  Editorial Reason for Disclosure Log
                </span>
                <input
                  type="text"
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder={`Updated ${draft.slug} syndication rules and metadata`}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void handleLivePreview(draft)}
                  disabled={refreshingPreview}
                  className="px-3.5 py-2 bg-[#0B0E14] border border-[#8A6D3B]/60 hover:border-[#C5A059] text-xs font-display uppercase tracking-wider text-[#C5A059] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {refreshingPreview
                    ? "Rendering Preview..."
                    : "Preview Draft Output"}
                </button>

                <button
                  type="submit"
                  disabled={saving || isReadOnlyAuditor}
                  className="px-5 py-2.5 bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-display text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving
                    ? "Saving & Auditing..."
                    : "Save & Publish Feed Settings"}
                </button>
              </div>
            </div>
          </HairlineSection>
        </form>

        {/* Right Column (5 cols): Live XML / JSON Feed Output Inspector */}
        <div className="lg:col-span-5 bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
            <div>
              <div className="font-display text-[11px] uppercase tracking-[0.16em] text-[#C5A059]">
                Live Syndication Output Preview
              </div>
              <h3 className="font-display text-base text-[#F3EFE6]">
                {publicPath} ({previewData.format.toUpperCase()})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => void handleLivePreview(draft)}
              disabled={refreshingPreview}
              className="text-xs font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] cursor-pointer"
            >
              {refreshingPreview ? "Refreshing..." : "Refresh ↻"}
            </button>
          </div>

          <p className="font-serif text-xs text-[#94A3B8]">
            Inspect how RSS readers, Apple Podcasts, Spotify, and JSON Feed
            clients receive your live syndicated items with the current toggles
            applied.
          </p>

          <pre className="bg-[#0B0E14] border border-[#8A6D3B]/35 p-4 text-[11px] font-mono text-[#F3EFE6]/90 overflow-x-auto max-h-[640px] overflow-y-auto leading-relaxed whitespace-pre-wrap break-words">
            {previewData.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
