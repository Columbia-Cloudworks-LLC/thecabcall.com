"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminFeedsClient } from "./AdminFeedsClient";
import { AdminFiltersClient } from "./AdminFiltersClient";
import { formatTranscriptParagraphs } from "@/lib/episode-metadata";
import {
  HairlineSection,
  HeroCornerBrackets,
} from "./ui/BroadsheetPrimitives";
import type { AuthenticatedAdminActor } from "@/pipeline/auth";
import type {
  AuditChainVerificationResult,
  AuditLedgerEntry,
} from "@/pipeline/audit";
import type {
  AdminIncidentRecord,
  ImageSourceType,
  PipelineTransformRecord,
} from "@/pipeline/editorial";
import type {
  IngestFeedRecord,
  IngestFilterRecord,
  SystemSettingsMap,
} from "@/pipeline/ingest";
import type { JevSreFailureModeKey, JevWorkingToolKey } from "@/pipeline/jev";

export type EditorialWorkspaceView = "stories" | "feeds" | "rules";

interface AdminIncidentsClientProps {
  actor: AuthenticatedAdminActor;
  initialIncidents: AdminIncidentRecord[];
  initialTransforms: PipelineTransformRecord[];
  initialCounts: {
    total: number;
    synthesized: number;
    triaged: number;
    quarantined: number;
    dropped: number;
    rewritten: number;
    withImage: number;
    pinned: number;
    hidden: number;
  };
  initialAuditEntries?: AuditLedgerEntry[];
  chainIntegrity?: AuditChainVerificationResult;
  defaultTab?: "incidents" | "transforms";
  defaultView?: EditorialWorkspaceView;
  initialFeeds?: IngestFeedRecord[];
  initialFilters?: IngestFilterRecord[];
  initialThresholds?: SystemSettingsMap;
}

const WORKING_TOOL_OPTIONS: Array<{
  key: JevWorkingToolKey;
  label: string;
}> = [
  { key: "square", label: "The Square" },
  { key: "plumb", label: "The Plumb" },
  { key: "level", label: "The Level" },
  { key: "common_gavel", label: "Common Gavel" },
  { key: "twenty_four_inch_gauge", label: "24-Inch Gauge" },
  { key: "trowel", label: "The Trowel" },
];

const FAILURE_MODE_OPTIONS: Array<{
  key: JevSreFailureModeKey;
  label: string;
}> = [
  { key: "configuration_drift", label: "Configuration Drift" },
  { key: "cascading_failure", label: "Cascading Failure" },
  {
    key: "untested_failover",
    label: "Single Point of Failure (SPOF) / Untested Failover",
  },
  { key: "alert_fatigue", label: "Alert Fatigue & Signal Loss" },
  {
    key: "blameless_postmortem_gap",
    label: "Blame Culture vs. Root-Cause Isolation",
  },
  {
    key: "capacity_exhaustion",
    label: "Technical & Institutional Debt",
  },
];

const TRANSFORM_LABELS: Record<
  string,
  { title: string; subtitle: string; badge: string }
> = {
  auto_deescalate_titles: {
    title: "Calm Headline Rewrite",
    subtitle:
      "Automatically rewrites sensationalist or clickbait source headlines (ALL-CAPS, partisan slam verbs, panic framing) into calm, factual titles while preserving original_title in the audit ledger.",
    badge: "Editorial Tone",
  },
  auto_extract_rss_images: {
    title: "Source Article Image Extraction",
    subtitle:
      "Extracts lead images and OpenGraph thumbnails from incoming RSS and Atom articles during newsroom collection.",
    badge: "Story Media",
  },
  auto_generate_fallback_cards: {
    title: "Masonic Blueprint Illustration Cards",
    subtitle:
      "Automatically attaches a custom 1200x630 blueprint SVG card featuring the Working Tool and Failure Mode when a story has no source photo.",
    badge: "Blueprint Card",
  },
  custom_system2_directive: {
    title: "Custom Editorial Guidance Note",
    subtitle:
      "Applies an additional standing editorial instruction across all newly drafted Craftsman's Briefs.",
    badge: "Editorial Voice",
  },
};

const DEFAULT_THRESHOLDS: SystemSettingsMap = {
  jevMinSystemicProb: 0.7,
  jevMinConfidence: 0.5,
  maxNetNewPerRun: 10,
  defaultItemsPerPoll: 3,
};

export function AdminIncidentsClient({
  actor,
  initialIncidents,
  initialTransforms,
  initialCounts,
  defaultTab = "incidents",
  defaultView,
  initialFeeds = [],
  initialFilters = [],
  initialThresholds = DEFAULT_THRESHOLDS,
}: AdminIncidentsClientProps) {
  const canMutate = actor.role !== "auditor";

  const resolvedDefaultView: EditorialWorkspaceView =
    defaultView || (defaultTab === "transforms" ? "rules" : "stories");

  const [activeView, setActiveView] =
    useState<EditorialWorkspaceView>(resolvedDefaultView);

  // Sync with ?view=stories|feeds|rules on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      if (
        viewParam === "stories" ||
        viewParam === "feeds" ||
        viewParam === "rules"
      ) {
        setActiveView(viewParam);
      }
    }
  }, []);

  const [incidents, setIncidents] =
    useState<AdminIncidentRecord[]>(initialIncidents);
  const [transforms, setTransforms] =
    useState<PipelineTransformRecord[]>(initialTransforms);
  const [counts, setCounts] = useState(initialCounts);

  // Filters for Case Briefs & Stories
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [rewrittenOnly, setRewrittenOnly] = useState<boolean>(false);

  // Active selected story for studio editing
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(
    initialIncidents[0]?.id ?? null
  );
  const [studioSection, setStudioSection] = useState<
    "headline" | "media" | "brief"
  >("headline");

  // Banner feedback
  const [banner, setBanner] = useState<{
    type: "success" | "error" | "info";
    title: string;
    detail: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [imageCacheBuster, setImageCacheBuster] = useState<number>(Date.now());

  const selectedIncident = useMemo(
    () => incidents.find((inc) => inc.id === selectedIncidentId) || null,
    [incidents, selectedIncidentId]
  );

  // Form states synchronized when selectedIncident changes
  const [headlineDraft, setHeadlineDraft] = useState<string>(
    initialIncidents[0]?.title || ""
  );
  const [headlineReason, setHeadlineReason] = useState<string>("");

  const [imageUrlDraft, setImageUrlDraft] = useState<string>(
    initialIncidents[0]?.imageUrl || ""
  );
  const [imageAltDraft, setImageAltDraft] = useState<string>(
    initialIncidents[0]?.imageAlt || ""
  );
  const [imageCaptionDraft, setImageCaptionDraft] = useState<string>(
    initialIncidents[0]?.imageCaption || ""
  );
  const [imageSourceTypeDraft, setImageSourceTypeDraft] =
    useState<ImageSourceType>(initialIncidents[0]?.imageSourceType || "none");
  const [imageReason, setImageReason] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [execSummaryDraft, setExecSummaryDraft] = useState<string>(
    initialIncidents[0]?.executiveSummary || ""
  );
  const [socraticBriefDraft, setSocraticBriefDraft] = useState<string>(
    initialIncidents[0]?.socraticBrief || ""
  );
  const [noiseDraft, setNoiseDraft] = useState<string>(
    initialIncidents[0]?.proportionalityCheck?.noiseOverblown || ""
  );
  const [signalDraft, setSignalDraft] = useState<string>(
    initialIncidents[0]?.proportionalityCheck?.structuralSignal || ""
  );
  const [q1Draft, setQ1Draft] = useState<string>(
    initialIncidents[0]?.questions?.[0] || ""
  );
  const [q2Draft, setQ2Draft] = useState<string>(
    initialIncidents[0]?.questions?.[1] || ""
  );
  const [primaryToolDraft, setPrimaryToolDraft] = useState<JevWorkingToolKey>(
    initialIncidents[0]?.primaryToolKey || "square"
  );
  const [secondaryToolDraft, setSecondaryToolDraft] =
    useState<JevWorkingToolKey>(
      initialIncidents[0]?.secondaryToolKey || "twenty_four_inch_gauge"
    );
  const [failureModeDraft, setFailureModeDraft] =
    useState<JevSreFailureModeKey>(
      initialIncidents[0]?.sreFailureModeKey || "configuration_drift"
    );
  const [statusDraft, setStatusDraft] = useState<
    "dropped" | "triaged" | "synthesized" | "QUARANTINED" | "PENDING_RETRY"
  >(
    (initialIncidents[0]?.status as
      | "dropped"
      | "triaged"
      | "synthesized"
      | "QUARANTINED"
      | "PENDING_RETRY") || "synthesized"
  );
  const [isPinnedDraft, setIsPinnedDraft] = useState<boolean>(
    Boolean(initialIncidents[0]?.isPinned)
  );
  const [isHiddenDraft, setIsHiddenDraft] = useState<boolean>(
    Boolean(initialIncidents[0]?.isHidden)
  );
  const [isLeadDraft, setIsLeadDraft] = useState<boolean>(
    Boolean(initialIncidents[0]?.isLeadPostMortem)
  );
  const [leadAnalysisDraft, setLeadAnalysisDraft] = useState<string>(
    initialIncidents[0]?.leadPostMortemAnalysis || ""
  );
  const [editorialNotesDraft, setEditorialNotesDraft] = useState<string>(
    initialIncidents[0]?.editorialNotes || ""
  );
  const [briefReason, setBriefReason] = useState<string>("");

  // Transform directive draft
  const customDirectiveTransform = transforms.find(
    (t) => t.transformKey === "custom_system2_directive"
  );
  const [customDirectiveText, setCustomDirectiveText] = useState<string>(
    typeof customDirectiveTransform?.config?.directive === "string"
      ? String(customDirectiveTransform.config.directive)
      : ""
  );
  const [transformReason, setTransformReason] = useState<string>("");

  function selectIncidentForEdit(inc: AdminIncidentRecord) {
    setSelectedIncidentId(inc.id);
    setHeadlineDraft(inc.title);
    setHeadlineReason("");
    setImageUrlDraft(inc.imageUrl || "");
    setImageAltDraft(inc.imageAlt || "");
    setImageCaptionDraft(inc.imageCaption || "");
    setImageSourceTypeDraft(inc.imageSourceType || "none");
    setImageReason("");
    setUploadFile(null);
    setExecSummaryDraft(inc.executiveSummary || "");
    setSocraticBriefDraft(inc.socraticBrief || "");
    setNoiseDraft(inc.proportionalityCheck?.noiseOverblown || "");
    setSignalDraft(inc.proportionalityCheck?.structuralSignal || "");
    setQ1Draft(inc.questions?.[0] || "");
    setQ2Draft(inc.questions?.[1] || "");
    setPrimaryToolDraft(inc.primaryToolKey || "square");
    setSecondaryToolDraft(inc.secondaryToolKey || "twenty_four_inch_gauge");
    setFailureModeDraft(inc.sreFailureModeKey || "configuration_drift");
    setStatusDraft(
      (inc.status as
        | "dropped"
        | "triaged"
        | "synthesized"
        | "QUARANTINED"
        | "PENDING_RETRY") || "synthesized"
    );
    setIsPinnedDraft(Boolean(inc.isPinned));
    setIsHiddenDraft(Boolean(inc.isHidden));
    setIsLeadDraft(Boolean(inc.isLeadPostMortem));
    setLeadAnalysisDraft(inc.leadPostMortemAnalysis || "");
    setEditorialNotesDraft(inc.editorialNotes || "");
    setBriefReason("");
  }

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter !== "ALL" && inc.status !== statusFilter) {
        return false;
      }
      if (rewrittenOnly && !inc.titleRewritten) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = inc.title.toLowerCase().includes(q);
        const matchOrig = (inc.originalTitle || "").toLowerCase().includes(q);
        const matchCode = inc.incidentCode.toLowerCase().includes(q);
        const matchSource = inc.sourceFeed.toLowerCase().includes(q);
        if (!matchTitle && !matchOrig && !matchCode && !matchSource) {
          return false;
        }
      }
      return true;
    });
  }, [incidents, statusFilter, rewrittenOnly, searchQuery]);

  async function refreshIncidents(selectId?: number) {
    try {
      const incRes = await fetch("/api/admin/incidents?limit=100", {
        cache: "no-store",
      });
      if (incRes.ok) {
        const data = await incRes.json();
        if (Array.isArray(data.incidents)) {
          setIncidents(data.incidents);
          if (data.counts) setCounts(data.counts);
          if (Array.isArray(data.transforms)) setTransforms(data.transforms);
          const targetId = selectId ?? selectedIncidentId;
          const updatedSelected = (
            data.incidents as AdminIncidentRecord[]
          ).find((i) => i.id === targetId);
          if (updatedSelected) {
            selectIncidentForEdit(updatedSelected);
          }
        }
      }
    } catch {
      // ignore refresh error
    }
  }

  async function handleRewriteTitle(options: {
    autoDeescalate?: boolean;
    restoreOriginal?: boolean;
  }) {
    if (!selectedIncident) return;
    setSubmitting(true);
    setBanner(null);

    try {
      const response = await fetch("/api/admin/incidents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rewrite_title",
          incidentId: selectedIncident.id,
          newTitle:
            !options.autoDeescalate && !options.restoreOriginal
              ? headlineDraft
              : undefined,
          autoDeescalate: options.autoDeescalate,
          restoreOriginal: options.restoreOriginal,
          reason:
            headlineReason.trim() ||
            (options.restoreOriginal
              ? "Restored original source headline in Editorial & Feeds."
              : options.autoDeescalate
              ? "Applied automated Calm Headline Rewrite."
              : "Editorial Calm Headline Rewrite in Editorial & Feeds."),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Headline rewrite failed");
      }

      setBanner({
        type: "success",
        title: options.restoreOriginal
          ? "Original Headline Restored"
          : "Calm Headline Saved & Recorded in Audit Ledger",
        detail: `Display Headline: "${
          data.incident?.title || headlineDraft
        }" • Original Source Headline Preserved: "${
          data.incident?.originalTitle || selectedIncident.originalTitle
        }"`,
      });
      await refreshIncidents(selectedIncident.id);
    } catch (err) {
      setBanner({
        type: "error",
        title: "Headline Update Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAttachImage(options: {
    extractFromSource?: boolean;
    generateSvgCard?: boolean;
    clearImage?: boolean;
  }) {
    if (!selectedIncident) return;
    setSubmitting(true);
    setBanner(null);

    try {
      const response = await fetch("/api/admin/incidents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach_image",
          incidentId: selectedIncident.id,
          extractFromSource: options.extractFromSource,
          generateSvgCard: options.generateSvgCard,
          imageUrl: options.clearImage ? "" : imageUrlDraft,
          imageAlt: options.clearImage ? "" : imageAltDraft,
          imageCaption: options.clearImage ? "" : imageCaptionDraft,
          imageSourceType: options.clearImage
            ? "none"
            : options.generateSvgCard
            ? "svg_card"
            : imageSourceTypeDraft === "none"
            ? "rss"
            : imageSourceTypeDraft,
          reason:
            imageReason.trim() ||
            (options.extractFromSource
              ? `Extracted source article image for ${selectedIncident.incidentCode}`
              : options.generateSvgCard
              ? `Attached Masonic Blueprint SVG Card for ${selectedIncident.incidentCode}`
              : options.clearImage
              ? `Cleared attached illustration for ${selectedIncident.incidentCode}`
              : `Updated story illustration for ${selectedIncident.incidentCode}`),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Image attachment failed");
      }

      setImageCacheBuster(Date.now());
      setBanner({
        type: "success",
        title: "Story Illustration Updated",
        detail: `Updated visual media for ${selectedIncident.incidentCode} and recorded in the audit ledger.`,
      });
      await refreshIncidents(selectedIncident.id);
    } catch (err) {
      setBanner({
        type: "error",
        title: "Illustration Update Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadFileToR2() {
    if (!selectedIncident || !uploadFile) return;
    setSubmitting(true);
    setBanner(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("incidentId", String(selectedIncident.id));
      formData.append(
        "imageAlt",
        imageAltDraft.trim() || selectedIncident.title
      );
      formData.append(
        "imageCaption",
        imageCaptionDraft.trim() ||
          `${selectedIncident.incidentCode} · ${selectedIncident.primaryTool}`
      );
      formData.append(
        "reason",
        imageReason.trim() ||
          `Uploaded custom illustration (${uploadFile.name}) for ${selectedIncident.incidentCode}`
      );

      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Image upload failed");
      }

      setImageCacheBuster(Date.now());
      setUploadFile(null);
      setBanner({
        type: "success",
        title: "Illustration Uploaded & Attached",
        detail: `Attached ${data.mediaUrl} to ${selectedIncident.incidentCode}.`,
      });
      await refreshIncidents(selectedIncident.id);
    } catch (err) {
      setBanner({
        type: "error",
        title: "Upload Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveBriefOverride(resynthesize = false) {
    if (!selectedIncident) return;
    setSubmitting(true);
    setBanner(null);

    try {
      const response = await fetch("/api/admin/incidents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          resynthesize
            ? {
                action: "resynthesize",
                incidentId: selectedIncident.id,
                reason:
                  briefReason.trim() ||
                  `Re-drafted Craftsman's Brief for ${selectedIncident.incidentCode}.`,
              }
            : {
                action: "override_brief",
                incidentId: selectedIncident.id,
                executiveSummary: execSummaryDraft,
                socraticBrief: socraticBriefDraft,
                noiseOverblown: noiseDraft,
                structuralSignal: signalDraft,
                questions: [q1Draft, q2Draft],
                primaryTool: primaryToolDraft,
                secondaryTool: secondaryToolDraft,
                sreFailureMode: failureModeDraft,
                status: statusDraft,
                isPinned: isPinnedDraft,
                isHidden: isHiddenDraft,
                isLeadPostMortem: isLeadDraft,
                leadPostMortemAnalysis: leadAnalysisDraft || null,
                editorialNotes: editorialNotesDraft || null,
                reason:
                  briefReason.trim() ||
                  `Saved Craftsman's Brief & Working Tool updates for ${selectedIncident.incidentCode}.`,
              }
        ),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Brief update failed");
      }

      setBanner({
        type: "success",
        title: resynthesize
          ? "Craftsman's Brief Re-Drafted"
          : "Craftsman's Brief & Working Tools Saved",
        detail: `Updated ${selectedIncident.incidentCode} and recorded changes in the audit ledger.`,
      });
      await refreshIncidents(selectedIncident.id);
    } catch (err) {
      setBanner({
        type: "error",
        title: "Brief Update Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleTransform(
    transform: PipelineTransformRecord,
    nextEnabled: boolean,
    customConfig?: Record<string, unknown>
  ) {
    setSubmitting(true);
    setBanner(null);

    try {
      const response = await fetch("/api/admin/transforms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transformKey: transform.transformKey,
          enabled: nextEnabled,
          config: customConfig ?? transform.config,
          reason:
            transformReason.trim() ||
            `Updated editorial tone rule "${transform.transformKey}" (enabled=${nextEnabled}).`,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Failed to update editorial rule");
      }

      if (Array.isArray(data.transforms)) {
        setTransforms(data.transforms);
      }
      setBanner({
        type: "success",
        title: "Editorial Tone Rule Updated",
        detail: `Rule is now ${
          nextEnabled ? "ENABLED" : "DISABLED"
        } and recorded in the audit ledger.`,
      });
      await refreshIncidents();
    } catch (err) {
      setBanner({
        type: "error",
        title: "Rule Update Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Unified "Editorial & Feeds" Workspace Header + Segmented Control Bar */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 shadow-xl space-y-5">
        <HeroCornerBrackets size="sm" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="font-display text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
              Editorial &amp; Feeds • Newsroom Workspace
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] tracking-wide">
              Editorial &amp; Feeds
            </h1>
            <p className="font-serif text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
              Review and refine published Craftsman&apos;s Briefs, manage
              monitored RSS news sources, and configure editorial tone and
              filtering rules in one unified workspace.
            </p>
          </div>

          {/* Compact Summary Metrics */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-[#F3EFE6]">
            <span>
              <strong className="text-[#C5A059]">{counts.synthesized}</strong>{" "}
              Published Briefs
            </span>
            <span className="text-[#8A6D3B]/60">•</span>
            <span>
              <strong className="text-emerald-300">{counts.rewritten}</strong>{" "}
              Calm Headlines
            </span>
            <span className="text-[#8A6D3B]/60">•</span>
            <span>
              <strong className="text-[#C5A059]">{initialFeeds.length}</strong>{" "}
              RSS Sources
            </span>
          </div>
        </div>

        {/* Top Segmented Control Bar switching between Stories, RSS Sources, and Editorial Tone & Filtering */}
        <div
          role="tablist"
          aria-label="Editorial & Feeds Workspace Views"
          className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#8A6D3B]/35 pt-4 border-t border-[#8A6D3B]/35"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "stories"}
            onClick={() => setActiveView("stories")}
            className={`py-2 sm:pr-4 text-left transition-all duration-200 ease-out cursor-pointer ${
              activeView === "stories"
                ? "border-b-2 border-b-[#C5A059] text-[#F3EFE6]"
                : "text-[#94A3B8] hover:text-[#F3EFE6]"
            }`}
          >
            <div className="font-display text-xs uppercase tracking-wider font-bold">
              1. Case Briefs &amp; Stories ({counts.total})
            </div>
            <div className="font-serif text-xs text-[#94A3B8] mt-0.5">
              Calm Headline Rewrite, illustrations &amp; Craftsman&apos;s Briefs
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeView === "feeds"}
            onClick={() => setActiveView("feeds")}
            className={`py-2 sm:px-4 text-left transition-all duration-200 ease-out cursor-pointer ${
              activeView === "feeds"
                ? "border-b-2 border-b-[#C5A059] text-[#F3EFE6]"
                : "text-[#94A3B8] hover:text-[#F3EFE6]"
            }`}
          >
            <div className="font-display text-xs uppercase tracking-wider font-bold">
              2. RSS Sources ({initialFeeds.length})
            </div>
            <div className="font-serif text-xs text-[#94A3B8] mt-0.5">
              Add, preview, or pause monitored RSS &amp; Atom publications
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeView === "rules"}
            onClick={() => setActiveView("rules")}
            className={`py-2 sm:pl-4 text-left transition-all duration-200 ease-out cursor-pointer ${
              activeView === "rules"
                ? "border-b-2 border-b-[#C5A059] text-[#F3EFE6]"
                : "text-[#94A3B8] hover:text-[#F3EFE6]"
            }`}
          >
            <div className="font-display text-xs uppercase tracking-wider font-bold">
              3. Editorial Tone &amp; Filtering ({initialFilters.length} rules)
            </div>
            <div className="font-serif text-xs text-[#94A3B8] mt-0.5">
              Minimum Relevance Score, keyword filters &amp; automated tone
              rules
            </div>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-4 border text-xs flex items-start justify-between gap-4 ${
            banner.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
              : banner.type === "error"
              ? "bg-red-950/60 border-red-500/50 text-red-200"
              : "bg-[#111726] border-[#C5A059] text-[#F3EFE6]"
          }`}
        >
          <div className="space-y-1">
            <div className="font-display font-bold uppercase tracking-wider">
              {banner.title}
            </div>
            <div className="font-serif text-sm text-[#F3EFE6]/90">
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

      {/* SUB-VIEW 2: RSS SOURCES */}
      {activeView === "feeds" && (
        <AdminFeedsClient
          actor={actor}
          initialFeeds={initialFeeds}
          embedded={true}
        />
      )}

      {/* SUB-VIEW 3: EDITORIAL TONE & FILTERING (Combines Automated Tone Rules + Relevance Thresholds + Keyword Filters) */}
      {activeView === "rules" && (
        <div className="space-y-6">
          {/* Automated Editorial Tone & Media Rules */}
          <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#8A6D3B]/35 pb-4">
              <div>
                <h2 className="font-display text-base sm:text-lg text-[#F3EFE6] tracking-wide">
                  Automated Editorial Tone &amp; Illustration Rules
                </h2>
                <p className="font-serif text-xs text-[#94A3B8]">
                  Configure automatic Calm Headline Rewrite, source photo
                  extraction, and Masonic Blueprint fallback cards.
                </p>
              </div>
              <input
                type="text"
                value={transformReason}
                onChange={(e) => setTransformReason(e.target.value)}
                placeholder="Editorial note for rule change (optional)…"
                className="px-3 py-1.5 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-serif text-[#F3EFE6] w-full sm:w-80"
              />
            </div>

            <div className="divide-y divide-[#8A6D3B]/30">
              {transforms.map((t) => {
                const meta = TRANSFORM_LABELS[t.transformKey] || {
                  title: t.transformKey,
                  subtitle: "Editorial automation rule",
                  badge: "Rule",
                };
                const isCustomDirective =
                  t.transformKey === "custom_system2_directive";

                return (
                  <div
                    key={t.transformKey}
                    className="py-4 first:pt-0 last:pb-0 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-bold text-[#F3EFE6]">
                            {meta.title}
                          </span>
                          <span className="font-display text-[10px] uppercase tracking-wider text-[#C5A059]">
                            • {meta.badge}
                          </span>
                          <span
                            className={`font-display text-[10px] font-bold uppercase tracking-wider ${
                              t.enabled ? "text-emerald-300" : "text-[#94A3B8]"
                            }`}
                          >
                            ({t.enabled ? "Active" : "Paused"})
                          </span>
                        </div>
                        <p className="font-serif text-xs text-[#94A3B8] leading-relaxed">
                          {meta.subtitle}
                        </p>
                      </div>

                      {canMutate && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleToggleTransform(t, !t.enabled)}
                          className={`font-display text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer shrink-0 ${
                            t.enabled
                              ? "text-[#94A3B8] hover:text-red-300"
                              : "text-emerald-300 hover:text-emerald-200"
                          }`}
                        >
                          {t.enabled ? "Pause Rule" : "Enable Rule"}
                        </button>
                      )}
                    </div>

                    {isCustomDirective && (
                      <div className="pt-3 border-t border-[#8A6D3B]/25 space-y-2.5">
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059]">
                          Standing Editorial Guidance Instruction:
                        </label>
                        <textarea
                          rows={2}
                          value={customDirectiveText}
                          onChange={(e) =>
                            setCustomDirectiveText(e.target.value)
                          }
                          placeholder="e.g., Emphasize concrete failure recovery timelines and avoid speculative policy prescriptions."
                          className="w-full max-w-prose px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-serif text-[#F3EFE6]"
                        />
                        {canMutate && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                handleToggleTransform(t, t.enabled, {
                                  directive: customDirectiveText,
                                })
                              }
                              className="px-4 py-1.5 bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Save Editorial Guidance
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Embedded Filtering Rules & Minimum Relevance Score */}
          <AdminFiltersClient
            actor={actor}
            initialFilters={initialFilters}
            initialThresholds={initialThresholds}
            initialFeeds={initialFeeds}
            embedded={true}
          />
        </div>
      )}

      {/* SUB-VIEW 1: CASE BRIEFS & STORIES (2-Column Master/Detail) */}
      {activeView === "stories" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (5 cols): Scannable Story Roster */}
          <div className="lg:col-span-5 bg-[#111726] border border-[#8A6D3B]/45 p-4 space-y-4 shadow-xl">
            <div className="space-y-3 border-b border-[#8A6D3B]/35 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xs uppercase tracking-wider text-[#C5A059] font-bold">
                  Stories &amp; Briefs ({filteredIncidents.length})
                </h2>
                <label className="inline-flex items-center gap-1.5 font-sans text-xs text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rewrittenOnly}
                    onChange={(e) => setRewrittenOnly(e.target.checked)}
                    className="accent-[#C5A059]"
                  />
                  <span>Calm Headlines Only</span>
                </label>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search headline, original title, #CAB code, or source…"
                className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />

              <div className="flex flex-wrap gap-3">
                {[
                  { id: "ALL", label: "All" },
                  { id: "synthesized", label: "Published" },
                  { id: "triaged", label: "Pending" },
                  { id: "QUARANTINED", label: "Quarantined" },
                  { id: "dropped", label: "Filtered" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`pb-1 font-display text-[10px] uppercase tracking-wider cursor-pointer transition-colors ${
                      statusFilter === tab.id
                        ? "border-b-2 border-[#C5A059] text-[#F3EFE6] font-bold"
                        : "text-[#94A3B8] hover:text-[#F3EFE6]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#8A6D3B]/25 max-h-[760px] overflow-y-auto pr-1">
              {filteredIncidents.map((inc) => {
                const isSelected = inc.id === selectedIncidentId;
                return (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => selectIncidentForEdit(inc)}
                    className={`w-full text-left py-3 px-3 transition-all duration-200 ease-out cursor-pointer space-y-1.5 ${
                      isSelected
                        ? "bg-[#C5A059]/10 border-l-4 border-l-[#C5A059]"
                        : "hover:bg-[#0B0E14]/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#C5A059] font-bold">
                          {inc.incidentCode}
                        </span>
                        <span className="text-[#8A6D3B]">•</span>
                        <span className="font-sans text-[#94A3B8]">
                          {inc.sourceFeed}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-display uppercase tracking-wider">
                        {inc.isPinned && (
                          <span className="text-[#C5A059]">Pinned</span>
                        )}
                        {inc.isHidden && (
                          <span className="text-rose-300">Hidden</span>
                        )}
                        {inc.titleRewritten && (
                          <span className="text-emerald-300">
                            Calm Headline
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-serif text-sm font-semibold text-[#F3EFE6] line-clamp-2">
                      {inc.title}
                    </div>

                    {inc.titleRewritten && inc.originalTitle && (
                      <div className="font-serif text-[11px] text-[#94A3B8] line-clamp-1 italic">
                        Source: &ldquo;{inc.originalTitle}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-0.5">
                      <span className="font-display text-[10px] uppercase tracking-wider text-[#C5A059]">
                        {inc.primaryTool} · {inc.sreFailureMode}
                      </span>
                      <span className="font-mono text-[10px]">
                        [{inc.imageSourceType || "card"}]
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN (7 cols): Story & Brief Inspector */}
          <div className="lg:col-span-7 space-y-4">
            {!selectedIncident ? (
              <div className="bg-[#111726] border border-[#8A6D3B]/45 p-8 text-center font-serif text-sm text-[#94A3B8]">
                Select a story from the left list to edit its headline,
                illustration, or Craftsman&apos;s Brief.
              </div>
            ) : (
              <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-6 shadow-xl">
                {/* Selected Story Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-[#8A6D3B]/35 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-[#C5A059] font-bold">
                        {selectedIncident.incidentCode}
                      </span>
                      <span className="text-[#8A6D3B]">•</span>
                      <span className="font-sans text-[#94A3B8]">
                        {selectedIncident.sourceFeed}
                      </span>
                    </div>
                    <h2 className="font-display text-lg sm:text-xl text-[#F3EFE6] leading-snug">
                      {selectedIncident.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <a
                      href={`https://thecabcall.com/incidents/${selectedIncident.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-display text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
                    >
                      Public Brief ↗
                    </a>
                    <a
                      href={selectedIncident.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-display text-xs uppercase tracking-wider text-[#94A3B8] hover:text-[#C5A059] transition-colors"
                    >
                      Source Article ↗
                    </a>
                  </div>
                </div>

                {/* Inspector Section Tabs */}
                <div className="flex flex-wrap gap-5 border-b border-[#8A6D3B]/35 pb-2">
                  <button
                    type="button"
                    onClick={() => setStudioSection("headline")}
                    className={`pb-1.5 font-display text-xs uppercase tracking-wider cursor-pointer transition-all duration-200 ease-out ${
                      studioSection === "headline"
                        ? "border-b-2 border-[#C5A059] text-[#F3EFE6] font-bold"
                        : "text-[#94A3B8] hover:text-[#F3EFE6]"
                    }`}
                  >
                    1. Calm Headline Rewrite
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioSection("media")}
                    className={`pb-1.5 font-display text-xs uppercase tracking-wider cursor-pointer transition-all duration-200 ease-out ${
                      studioSection === "media"
                        ? "border-b-2 border-[#C5A059] text-[#F3EFE6] font-bold"
                        : "text-[#94A3B8] hover:text-[#F3EFE6]"
                    }`}
                  >
                    2. Story Illustration &amp; Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioSection("brief")}
                    className={`pb-1.5 font-display text-xs uppercase tracking-wider cursor-pointer transition-all duration-200 ease-out ${
                      studioSection === "brief"
                        ? "border-b-2 border-[#C5A059] text-[#F3EFE6] font-bold"
                        : "text-[#94A3B8] hover:text-[#F3EFE6]"
                    }`}
                  >
                    3. Craftsman&apos;s Brief &amp; Working Tools
                  </button>
                </div>

                {/* SECTION 1: CALM HEADLINE REWRITE */}
                {studioSection === "headline" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#8A6D3B]/30 pb-4 border-b border-[#8A6D3B]/30">
                      <div className="pb-3 md:pb-0 md:pr-4 space-y-1">
                        <div className="font-display text-[10px] uppercase tracking-wider text-[#94A3B8]">
                          Original Source Headline (Preserved for Disclosure)
                        </div>
                        <div className="text-sm font-serif italic text-[#F3EFE6]/90">
                          &ldquo;
                          {selectedIncident.originalTitle ||
                            selectedIncident.title}
                          &rdquo;
                        </div>
                      </div>

                      <div className="pt-3 md:pt-0 md:pl-4 space-y-1">
                        <div className="flex items-center justify-between font-display text-[10px] uppercase tracking-wider text-emerald-400">
                          <span>Published Display Headline</span>
                          <span>
                            {selectedIncident.titleRewritten
                              ? "Calm Rewrite Active"
                              : "Original Used"}
                          </span>
                        </div>
                        <div className="font-serif text-sm font-semibold text-[#F3EFE6]">
                          {selectedIncident.title}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                        Display Headline:
                      </label>
                      <input
                        type="text"
                        value={headlineDraft}
                        onChange={(e) => setHeadlineDraft(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block font-display text-xs uppercase tracking-wider text-[#94A3B8]">
                        Editorial Note (Recorded in Audit Ledger):
                      </label>
                      <input
                        type="text"
                        value={headlineReason}
                        onChange={(e) => setHeadlineReason(e.target.value)}
                        placeholder="e.g., Replaced sensationalist verb with calm factual description."
                        className="w-full px-3.5 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-serif text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    {canMutate && (
                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleRewriteTitle({})}
                          className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Save Display Headline
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            handleRewriteTitle({ autoDeescalate: true })
                          }
                          className="font-display text-xs uppercase tracking-wider text-emerald-300 hover:text-emerald-200 cursor-pointer transition-colors"
                        >
                          ⚡ Suggest Calm Headline
                        </button>
                        {selectedIncident.titleRewritten && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              handleRewriteTitle({ restoreOriginal: true })
                            }
                            className="font-display text-xs uppercase tracking-wider text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer transition-colors"
                          >
                            Restore Original Title
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 2: STORY ILLUSTRATION & BLUEPRINT CARD */}
                {studioSection === "media" && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-display text-[#C5A059] uppercase tracking-wider">
                          Current Story Illustration
                        </span>
                        <span className="font-mono text-[#94A3B8] text-[11px]">
                          Source: {selectedIncident.imageSourceType}
                        </span>
                      </div>

                      <div className="overflow-hidden bg-[#0B0E14]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${
                            selectedIncident.imageUrl ||
                            `/media/card-d1-${selectedIncident.id}.svg`
                          }${
                            (
                              selectedIncident.imageUrl ||
                              `/media/card-d1-${selectedIncident.id}.svg`
                            ).includes("?")
                              ? "&"
                              : "?"
                          }v=${imageCacheBuster}`}
                          alt={
                            selectedIncident.imageAlt || selectedIncident.title
                          }
                          className="w-full max-h-64 object-cover"
                        />
                      </div>

                      {canMutate && (
                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              handleAttachImage({ generateSvgCard: true })
                            }
                            className="px-3.5 py-1.5 bg-[#0B0E14] hover:border-[#C5A059] border border-[#8A6D3B]/50 font-display text-xs uppercase tracking-wider text-[#C5A059] cursor-pointer"
                          >
                            Use Masonic Blueprint Card
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              handleAttachImage({ extractFromSource: true })
                            }
                            className="font-display text-xs uppercase tracking-wider text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer transition-colors"
                          >
                            Extract Lead Image from Source URL
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              handleAttachImage({ clearImage: true })
                            }
                            className="font-display text-xs uppercase tracking-wider text-[#94A3B8] hover:text-red-300 cursor-pointer transition-colors"
                          >
                            Clear Image
                          </button>
                        </div>
                      )}
                    </div>

                    {canMutate && (
                      <HairlineSection className="space-y-3">
                        <div className="font-display text-xs uppercase tracking-wider text-[#C5A059]">
                          Upload Custom Illustration
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                            onChange={(e) =>
                              setUploadFile(e.target.files?.[0] || null)
                            }
                            className="text-xs font-sans text-[#F3EFE6] file:mr-3 file:px-3 file:py-1.5 file:border-0 file:bg-[#0B0E14] file:text-[#C5A059] file:font-display file:uppercase file:text-xs"
                          />
                          <button
                            type="button"
                            disabled={submitting || !uploadFile}
                            onClick={handleUploadFileToR2}
                            className="px-4 py-2 bg-[#C5A059] disabled:opacity-40 text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                          >
                            Upload &amp; Attach
                          </button>
                        </div>
                      </HairlineSection>
                    )}

                    <HairlineSection className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                            Image URL:
                          </label>
                          <input
                            type="text"
                            value={imageUrlDraft}
                            onChange={(e) => setImageUrlDraft(e.target.value)}
                            className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-mono text-[#F3EFE6]"
                          />
                        </div>
                        <div>
                          <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                            Source Type:
                          </label>
                          <select
                            value={imageSourceTypeDraft || "none"}
                            onChange={(e) =>
                              setImageSourceTypeDraft(
                                e.target.value as ImageSourceType
                              )
                            }
                            className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-sans text-[#F3EFE6]"
                          >
                            <option value="svg_card">Blueprint Card</option>
                            <option value="rss">RSS Media</option>
                            <option value="og">Article OpenGraph</option>
                            <option value="upload">Uploaded Image</option>
                            <option value="none">None</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                          Accessible Alt Text:
                        </label>
                        <input
                          type="text"
                          value={imageAltDraft}
                          onChange={(e) => setImageAltDraft(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-serif text-[#F3EFE6]"
                        />
                      </div>

                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                          Caption &amp; Attribution:
                        </label>
                        <input
                          type="text"
                          value={imageCaptionDraft}
                          onChange={(e) => setImageCaptionDraft(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-serif text-[#F3EFE6]"
                        />
                      </div>

                      {canMutate && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleAttachImage({})}
                          className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Save Illustration Settings
                        </button>
                      )}
                    </HairlineSection>
                  </div>
                )}

                {/* SECTION 3: CRAFTSMAN'S BRIEF & WORKING TOOLS */}
                {studioSection === "brief" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                          Primary Working Tool:
                        </label>
                        <select
                          value={primaryToolDraft}
                          onChange={(e) =>
                            setPrimaryToolDraft(
                              e.target.value as JevWorkingToolKey
                            )
                          }
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-sans text-[#F3EFE6]"
                        >
                          {WORKING_TOOL_OPTIONS.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                          Secondary Working Tool:
                        </label>
                        <select
                          value={secondaryToolDraft}
                          onChange={(e) =>
                            setSecondaryToolDraft(
                              e.target.value as JevWorkingToolKey
                            )
                          }
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-sans text-[#F3EFE6]"
                        >
                          {WORKING_TOOL_OPTIONS.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#F59E0B] mb-1">
                          Failure Pattern:
                        </label>
                        <select
                          value={failureModeDraft}
                          onChange={(e) =>
                            setFailureModeDraft(
                              e.target.value as JevSreFailureModeKey
                            )
                          }
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-sans text-[#F3EFE6]"
                        >
                          {FAILURE_MODE_OPTIONS.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <HairlineSection className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-display text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                          Publication State:
                        </label>
                        <select
                          value={statusDraft}
                          onChange={(e) =>
                            setStatusDraft(e.target.value as typeof statusDraft)
                          }
                          className="w-full px-2.5 py-1.5 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-sans text-[#F3EFE6]"
                        >
                          <option value="synthesized">Published</option>
                          <option value="triaged">Pending Brief</option>
                          <option value="QUARANTINED">Quarantined</option>
                          <option value="dropped">Filtered Out</option>
                          <option value="PENDING_RETRY">Pending Retry</option>
                        </select>
                      </div>

                      <label className="inline-flex items-center gap-2 font-sans text-xs text-[#C5A059] cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={isPinnedDraft}
                          onChange={(e) => setIsPinnedDraft(e.target.checked)}
                        />
                        <span>Pin to Trestleboard</span>
                      </label>

                      <label className="inline-flex items-center gap-2 font-sans text-xs text-rose-300 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={isHiddenDraft}
                          onChange={(e) => setIsHiddenDraft(e.target.checked)}
                        />
                        <span>Hide from Public</span>
                      </label>

                      <label className="inline-flex items-center gap-2 font-sans text-xs text-emerald-300 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={isLeadDraft}
                          onChange={(e) => setIsLeadDraft(e.target.checked)}
                        />
                        <span>Lead Post-Mortem</span>
                      </label>
                    </HairlineSection>

                    <div>
                      <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                        Executive Summary (Trestleboard Card Hook):
                      </label>
                      <textarea
                        rows={2}
                        value={execSummaryDraft}
                        onChange={(e) => setExecSummaryDraft(e.target.value)}
                        className="w-full max-w-prose px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm text-[#F3EFE6] leading-relaxed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                          Section I — What Happened (The Plain Facts):
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setSocraticBriefDraft(
                              formatTranscriptParagraphs(socraticBriefDraft)
                            )
                          }
                          className="font-display text-[10px] uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] cursor-pointer"
                        >
                          Format Paragraphs
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={socraticBriefDraft}
                        onChange={(e) => setSocraticBriefDraft(e.target.value)}
                        className="w-full max-w-prose px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm text-[#F3EFE6] leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-rose-400 mb-1">
                          Partisan Heat &amp; Spin (The Noise):
                        </label>
                        <textarea
                          rows={3}
                          value={noiseDraft}
                          onChange={(e) => setNoiseDraft(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm text-[#F3EFE6] leading-relaxed"
                        />
                      </div>

                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-emerald-400 mb-1">
                          The Actual Foundation (The Signal):
                        </label>
                        <textarea
                          rows={3}
                          value={signalDraft}
                          onChange={(e) => setSignalDraft(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm text-[#F3EFE6] leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                          Question for Reflection I:
                        </label>
                        <input
                          type="text"
                          value={q1Draft}
                          onChange={(e) => setQ1Draft(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm text-[#F3EFE6]"
                        />
                      </div>
                      <div>
                        <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                          Question for Reflection II:
                        </label>
                        <input
                          type="text"
                          value={q2Draft}
                          onChange={(e) => setQ2Draft(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm text-[#F3EFE6]"
                        />
                      </div>
                    </div>

                    {isLeadDraft && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059]">
                            Lead Post-Mortem Analysis:
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setLeadAnalysisDraft(
                                formatTranscriptParagraphs(leadAnalysisDraft)
                              )
                            }
                            className="font-display text-[10px] uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] cursor-pointer"
                          >
                            Format Paragraphs
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={leadAnalysisDraft}
                          onChange={(e) => setLeadAnalysisDraft(e.target.value)}
                          placeholder="Enter 2+ paragraphs separated by a blank line…"
                          className="w-full max-w-prose px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm text-[#F3EFE6] leading-relaxed"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                        Editorial Note (Recorded in Audit Ledger):
                      </label>
                      <input
                        type="text"
                        value={briefReason}
                        onChange={(e) => setBriefReason(e.target.value)}
                        placeholder="Reason for updating brief or Working Tool classification…"
                        className="w-full px-3 py-2 bg-[#0B0E14] border border-[#8A6D3B]/45 text-xs font-serif text-[#F3EFE6]"
                      />
                    </div>

                    {canMutate && (
                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleSaveBriefOverride(false)}
                          className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Save Craftsman&apos;s Brief
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleSaveBriefOverride(true)}
                          className="font-display text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] cursor-pointer transition-colors"
                        >
                          ↻ Re-Draft Brief Automatically
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Subtle Footer Link to Editorial Audit History */}
            <div className="flex items-center justify-between px-1 text-xs text-[#94A3B8]">
              <span className="font-serif italic">
                Every headline rewrite, illustration update, and brief revision
                is recorded in the immutable audit ledger.
              </span>
              <Link
                href="/admin/audit"
                className="font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors shrink-0"
              >
                Open Audit Ledger →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
