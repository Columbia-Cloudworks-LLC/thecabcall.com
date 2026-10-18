"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
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
import type { JevSreFailureModeKey, JevWorkingToolKey } from "@/pipeline/jev";

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
  initialAuditEntries: AuditLedgerEntry[];
  chainIntegrity?: AuditChainVerificationResult;
  defaultTab?: "incidents" | "transforms";
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
    title: "Automated De-Alarmist Headline Rewriting",
    subtitle:
      "During System-2 synthesis, detects sensationalist/clickbait headlines (ALL-CAPS, partisan slam verbs, panic framing) and rewrites them into calm, factual SRE post-incident titles while preserving original_title in audit_ledger.",
    badge: "System-2 Headline Gate",
  },
  auto_extract_rss_images: {
    title: "Automated RSS & OpenGraph Visual Media Extraction",
    subtitle:
      "Extracts <media:content>, <media:thumbnail>, image <enclosure>, and inline <img> tags from inbound RSS/Atom items on ingest.",
    badge: "Inbound Media Extractor",
  },
  auto_generate_fallback_cards: {
    title: "Masonic Blueprint + SRE Telemetry SVG Fallback Cards",
    subtitle:
      "Automatically attaches a deterministic 1200x630 blueprint SVG card (/media/card-d1-<id>.svg) featuring the Working Tool and SRE Failure Mode when an incident has no source photo.",
    badge: "Blueprint Card Renderer",
  },
  custom_system2_directive: {
    title: "Custom System-2 Editorial Prompt Directive",
    subtitle:
      "Injects an additional editorial governance instruction into Gemini 2.5 Flash System-2 synthesis prompts across all newly synthesized briefs.",
    badge: "System-2 Prompt Governance",
  },
};

export function AdminIncidentsClient({
  actor,
  initialIncidents,
  initialTransforms,
  initialCounts,
  initialAuditEntries,
  defaultTab = "incidents",
}: AdminIncidentsClientProps) {
  const canMutate = actor.role !== "auditor";

  const [activeTab, setActiveTab] = useState<"incidents" | "transforms">(
    defaultTab
  );
  const [incidents, setIncidents] =
    useState<AdminIncidentRecord[]>(initialIncidents);
  const [transforms, setTransforms] =
    useState<PipelineTransformRecord[]>(initialTransforms);
  const [counts, setCounts] = useState(initialCounts);
  const [auditEntries, setAuditEntries] =
    useState<AuditLedgerEntry[]>(initialAuditEntries);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [rewrittenOnly, setRewrittenOnly] = useState<boolean>(false);

  // Active selected incident for studio editing
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

  async function refreshAuditAndIncidents(selectId?: number) {
    try {
      const [incRes, auditRes] = await Promise.all([
        fetch("/api/admin/incidents?limit=100", { cache: "no-store" }),
        fetch("/api/admin/audit?limit=25", { cache: "no-store" }),
      ]);
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
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (Array.isArray(auditData.entries)) {
          setAuditEntries(auditData.entries);
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
              ? "Restored original source headline from Admin Incident Studio."
              : options.autoDeescalate
              ? "Triggered Gemini System-2 de-alarmist headline neutralization."
              : "Manual editorial headline de-escalation in Admin Incident Studio."),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Headline rewrite failed");
      }

      setBanner({
        type: "success",
        title: options.restoreOriginal
          ? "Original Headline Restored & Audited"
          : "Headline Neutralized & Recorded in Audit Ledger",
        detail: `Display Title: "${
          data.incident?.title || headlineDraft
        }" • Original Title Preserved: "${
          data.incident?.originalTitle || selectedIncident.originalTitle
        }"`,
      });
      await refreshAuditAndIncidents(selectedIncident.id);
    } catch (err) {
      setBanner({
        type: "error",
        title: "Headline Rewrite Error",
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
              ? `Extracted OpenGraph / source article image for ${selectedIncident.incidentCode}`
              : options.generateSvgCard
              ? `Attached Masonic Blueprint + SRE Telemetry SVG Card for ${selectedIncident.incidentCode}`
              : options.clearImage
              ? `Cleared attached visual media for ${selectedIncident.incidentCode}`
              : `Updated incident visual media for ${selectedIncident.incidentCode}`),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Image attachment failed");
      }

      setImageCacheBuster(Date.now());
      setBanner({
        type: "success",
        title: "Incident Visual Media Updated & Audited",
        detail: `Attached [${
          data.incident?.imageSourceType || "media"
        }] ${data.incident?.imageUrl || "(cleared)"} to ${
          selectedIncident.incidentCode
        }.`,
      });
      await refreshAuditAndIncidents(selectedIncident.id);
    } catch (err) {
      setBanner({
        type: "error",
        title: "Visual Media Attachment Error",
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
          `Uploaded custom R2 visual media (${uploadFile.name}) for ${selectedIncident.incidentCode}`
      );

      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "R2 media upload failed");
      }

      setImageCacheBuster(Date.now());
      setUploadFile(null);
      setBanner({
        type: "success",
        title: "Media Uploaded to R2 & Attached to Incident",
        detail: `Stored ${data.mediaKey} (${Math.round(
          (data.byteLength || 0) / 1024
        )} KB) and attached ${data.mediaUrl} to ${selectedIncident.incidentCode}.`,
      });
      await refreshAuditAndIncidents(selectedIncident.id);
    } catch (err) {
      setBanner({
        type: "error",
        title: "R2 Media Upload Error",
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
                  `Re-triggered System-2 Gemini synthesis for ${selectedIncident.incidentCode}.`,
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
                  `Editorial brief & classification override for ${selectedIncident.incidentCode}.`,
              }
        ),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Incident brief update failed");
      }

      setBanner({
        type: "success",
        title: resynthesize
          ? "System-2 Gemini Re-Synthesis Completed & Audited"
          : "Incident Brief, Classification & Visibility Saved",
        detail: `Updated ${selectedIncident.incidentCode} (${
          data.incident?.primaryTool || primaryToolDraft
        } · ${data.incident?.sreFailureMode || failureModeDraft}).`,
      });
      await refreshAuditAndIncidents(selectedIncident.id);
    } catch (err) {
      setBanner({
        type: "error",
        title: "Incident Brief Update Error",
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
            `Updated pipeline transform "${transform.transformKey}" (enabled=${nextEnabled}).`,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Failed to update pipeline transform");
      }

      if (Array.isArray(data.transforms)) {
        setTransforms(data.transforms);
      }
      setBanner({
        type: "success",
        title: "Pipeline Transform Rule Updated & Audited",
        detail: `${transform.transformKey} is now ${
          nextEnabled ? "ENABLED" : "DISABLED"
        } (Audit Event: ${data.auditEventId?.slice(0, 12) || "logged"}).`,
      });
      await refreshAuditAndIncidents();
    } catch (err) {
      setBanner({
        type: "error",
        title: "Transform Update Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReplayAuditEvent(eventId: string) {
    setSubmitting(true);
    setBanner(null);
    try {
      const response = await fetch("/api/admin/audit/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          mode: "rollback",
          reason: `Reverted editorial mutation ${eventId} from Admin Incident Studio.`,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Audit rollback failed");
      }
      setBanner({
        type: "success",
        title: "Editorial Mutation Rolled Back via Audit Ledger",
        detail: `Restored previous state from event ${eventId}.`,
      });
      await refreshAuditAndIncidents();
    } catch (err) {
      setBanner({
        type: "error",
        title: "Audit Rollback Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Studio Header */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-[#C5A059] font-semibold">
                EPIC 6.6 // EDITORIAL PIPELINE &amp; INCIDENT STUDIO
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 font-mono text-[11px] text-emerald-300">
                Headline De-Escalation + R2 Media + Brief Overrides
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F3EFE6] tracking-tight">
              Incident Editorial Studio &amp; Pipeline Transforms
            </h1>
            <p className="text-sm text-[#9CA3AF] max-w-3xl">
              Neutralize alarmist source headlines while preserving{" "}
              <code className="text-[#C5A059]">original_title</code> in the
              audit trail, attach RSS/OpenGraph/R2 images or Masonic Blueprint
              SVG cards, and override Socratic briefs or Working Tool
              classifications.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("incidents")}
              className={`px-4 py-2 rounded font-mono text-xs font-semibold uppercase tracking-wider border transition-colors cursor-pointer ${
                activeTab === "incidents"
                  ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059]"
                  : "bg-[#0B0E14] text-[#D6D1C7] border-[#263147] hover:border-[#C5A059]"
              }`}
            >
              Incident Studio ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("transforms")}
              className={`px-4 py-2 rounded font-mono text-xs font-semibold uppercase tracking-wider border transition-colors cursor-pointer ${
                activeTab === "transforms"
                  ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059]"
                  : "bg-[#0B0E14] text-[#D6D1C7] border-[#263147] hover:border-[#C5A059]"
              }`}
            >
              Pipeline Transforms ({transforms.filter((t) => t.enabled).length}/
              {transforms.length})
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-[#1E2738]">
          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3">
            <div className="font-mono text-[10px] uppercase text-[#8E9BAE]">
              Synthesized Public
            </div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
              {counts.synthesized}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3">
            <div className="font-mono text-[10px] uppercase text-[#8E9BAE]">
              Titles Neutralized
            </div>
            <div className="text-xl font-bold text-[#C5A059] font-mono mt-0.5">
              {counts.rewritten}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3">
            <div className="font-mono text-[10px] uppercase text-[#8E9BAE]">
              With Visual Media
            </div>
            <div className="text-xl font-bold text-sky-400 font-mono mt-0.5">
              {counts.withImage}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3">
            <div className="font-mono text-[10px] uppercase text-[#8E9BAE]">
              Pinned to Top
            </div>
            <div className="text-xl font-bold text-[#F3EFE6] font-mono mt-0.5">
              {counts.pinned}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3">
            <div className="font-mono text-[10px] uppercase text-[#8E9BAE]">
              Triaged Queue
            </div>
            <div className="text-xl font-bold text-amber-300 font-mono mt-0.5">
              {counts.triaged}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3">
            <div className="font-mono text-[10px] uppercase text-[#8E9BAE]">
              Quarantined / Hidden
            </div>
            <div className="text-xl font-bold text-rose-400 font-mono mt-0.5">
              {counts.quarantined + counts.hidden}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-4 rounded-lg border font-mono text-xs flex items-start justify-between gap-4 ${
            banner.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
              : banner.type === "error"
              ? "bg-red-950/60 border-red-500/50 text-red-200"
              : "bg-sky-950/60 border-sky-500/50 text-sky-200"
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider">
              {banner.title}
            </div>
            <div className="text-[#D6D1C7]">{banner.detail}</div>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === "transforms" ? (
        /* PIPELINE TRANSFORMS STUDIO */
        <div className="space-y-6">
          <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#1E2738] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#F3EFE6]">
                  Automated Editorial &amp; Media Pipeline Transforms
                </h2>
                <p className="text-xs text-[#9CA3AF]">
                  Configure deterministic &amp; System-2 transforms executed
                  automatically during RSS ingestion and Gemini synthesis.
                </p>
              </div>
              <input
                type="text"
                value={transformReason}
                onChange={(e) => setTransformReason(e.target.value)}
                placeholder="Audit reason for transform change (optional)…"
                className="px-3 py-1.5 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6] w-full sm:w-80"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {transforms.map((t) => {
                const meta = TRANSFORM_LABELS[t.transformKey] || {
                  title: t.transformKey,
                  subtitle: "Pipeline transform configuration rule",
                  badge: "Pipeline Rule",
                };
                const isCustomDirective =
                  t.transformKey === "custom_system2_directive";

                return (
                  <div
                    key={t.transformKey}
                    className="bg-[#0B0E14] border border-[#263147] rounded-lg p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#C5A059]">
                            {meta.title}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#182032] border border-[#2E3C56] font-mono text-[10px] text-[#9CA3AF]">
                            {meta.badge}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                              t.enabled
                                ? "bg-emerald-950/70 border border-emerald-500/40 text-emerald-300"
                                : "bg-slate-900 border border-slate-700 text-slate-400"
                            }`}
                          >
                            {t.enabled ? "ENABLED" : "DISABLED"}
                          </span>
                        </div>
                        <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-3xl">
                          {meta.subtitle}
                        </p>
                        <div className="font-mono text-[11px] text-[#8E9BAE]">
                          Key: <code>{t.transformKey}</code> • Last updated{" "}
                          {t.updatedAt.slice(0, 16).replace("T", " ")} UTC
                        </div>
                      </div>

                      {canMutate && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleToggleTransform(t, !t.enabled)}
                          className={`px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                            t.enabled
                              ? "bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-200"
                              : "bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-200"
                          }`}
                        >
                          {t.enabled ? "Disable Rule" : "Enable Rule"}
                        </button>
                      )}
                    </div>

                    {isCustomDirective && (
                      <div className="pt-3 border-t border-[#1E2738] space-y-2.5">
                        <label className="block font-mono text-[11px] uppercase text-[#C5A059]">
                          Custom System-2 Prompt Directive (Appended to Gemini
                          System Instruction):
                        </label>
                        <textarea
                          rows={3}
                          value={customDirectiveText}
                          onChange={(e) =>
                            setCustomDirectiveText(e.target.value)
                          }
                          placeholder="e.g., Emphasize concrete failure recovery timelines and avoid speculative policy prescriptions."
                          className="w-full px-3 py-2 rounded bg-[#111622] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
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
                              className="px-4 py-1.5 rounded bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                            >
                              Save Custom System-2 Directive
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
        </div>
      ) : (
        /* INCIDENT & EDITORIAL STUDIO (2-Column Master/Detail) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (5 cols): Filterable Incident Roster */}
          <div className="lg:col-span-5 bg-[#111622] border border-[#263147] rounded-lg p-4 space-y-4">
            <div className="space-y-3 border-b border-[#1E2738] pb-3">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs uppercase tracking-wider text-[#C5A059] font-bold">
                  D1 Incident Queue ({filteredIncidents.length})
                </h2>
                <label className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rewrittenOnly}
                    onChange={(e) => setRewrittenOnly(e.target.checked)}
                    className="rounded border-[#263147]"
                  />
                  <span>Neutralized Only</span>
                </label>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search headline, original title, #CAB code, feed…"
                className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
              />

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "ALL", label: "All" },
                  { id: "synthesized", label: "Synthesized" },
                  { id: "triaged", label: "Triaged" },
                  { id: "QUARANTINED", label: "Quarantined" },
                  { id: "dropped", label: "Dropped" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase cursor-pointer border ${
                      statusFilter === tab.id
                        ? "bg-[#C5A059]/20 border-[#C5A059] text-[#F3EFE6]"
                        : "bg-[#0B0E14] border-[#263147] text-[#9CA3AF]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 max-h-[760px] overflow-y-auto pr-1">
              {filteredIncidents.map((inc) => {
                const isSelected = inc.id === selectedIncidentId;
                return (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => selectIncidentForEdit(inc)}
                    className={`w-full text-left p-3.5 rounded-md border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? "bg-[#182032] border-[#C5A059] shadow-sm"
                        : "bg-[#0B0E14] border-[#1E2738] hover:border-[#3A4A6B]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#C5A059] font-bold">
                          {inc.incidentCode}
                        </span>
                        <span className="text-[#8E9BAE]">•</span>
                        <span className="text-[#D6D1C7]">{inc.sourceFeed}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {inc.isPinned && (
                          <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/20 text-[#C5A059]">
                            PINNED
                          </span>
                        )}
                        {inc.isHidden && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300">
                            HIDDEN
                          </span>
                        )}
                        {inc.titleRewritten && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                            NEUTRALIZED
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded uppercase ${
                            inc.status === "synthesized"
                              ? "bg-emerald-950/60 text-emerald-300"
                              : inc.status === "triaged"
                              ? "bg-amber-950/60 text-amber-300"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {inc.status}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-[#F3EFE6] line-clamp-2">
                      {inc.title}
                    </div>

                    {inc.titleRewritten && inc.originalTitle && (
                      <div className="font-mono text-[10px] text-[#9CA3AF] line-clamp-1 italic">
                        Orig: &ldquo;{inc.originalTitle}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center justify-between font-mono text-[10px] text-[#8E9BAE] pt-1">
                      <span>
                        {inc.primaryTool} · {inc.sreFailureMode}
                      </span>
                      <span className="text-sky-400">
                        [{inc.imageSourceType || "none"}]
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN (7 cols): Active Incident Editorial Studio */}
          <div className="lg:col-span-7 space-y-6">
            {!selectedIncident ? (
              <div className="bg-[#111622] border border-[#263147] rounded-lg p-8 text-center font-mono text-xs text-[#9CA3AF]">
                Select an incident from the left roster to open the Editorial
                Studio.
              </div>
            ) : (
              <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-6">
                {/* Selected Incident Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-[#1E2738] pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className="text-[#C5A059] font-bold">
                        {selectedIncident.incidentCode}
                      </span>
                      <span>•</span>
                      <span className="text-[#D6D1C7]">
                        {selectedIncident.sourceFeed}
                      </span>
                      <span>•</span>
                      <span className="text-[#8E9BAE]">
                        D1 ID #{selectedIncident.id}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-[#F3EFE6]">
                      {selectedIncident.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/incidents/${selectedIncident.slug}`}
                      target="_blank"
                      className="px-3 py-1.5 rounded border border-[#263147] hover:border-[#C5A059] bg-[#0B0E14] font-mono text-xs text-[#C5A059]"
                    >
                      Public Brief ↗
                    </Link>
                    <a
                      href={selectedIncident.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded border border-[#263147] hover:border-[#C5A059] bg-[#0B0E14] font-mono text-xs text-[#D6D1C7]"
                    >
                      Source URL ↗
                    </a>
                  </div>
                </div>

                {/* Studio Section Sub-Tabs */}
                <div className="flex flex-wrap gap-2 border-b border-[#1E2738] pb-3">
                  <button
                    type="button"
                    onClick={() => setStudioSection("headline")}
                    className={`px-3.5 py-2 rounded font-mono text-xs font-semibold cursor-pointer border ${
                      studioSection === "headline"
                        ? "bg-[#C5A059]/20 border-[#C5A059] text-[#F3EFE6]"
                        : "bg-[#0B0E14] border-[#263147] text-[#9CA3AF]"
                    }`}
                  >
                    1. De-Alarmist Headline Rewriter
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioSection("media")}
                    className={`px-3.5 py-2 rounded font-mono text-xs font-semibold cursor-pointer border ${
                      studioSection === "media"
                        ? "bg-[#C5A059]/20 border-[#C5A059] text-[#F3EFE6]"
                        : "bg-[#0B0E14] border-[#263147] text-[#9CA3AF]"
                    }`}
                  >
                    2. Image &amp; Blueprint Card Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioSection("brief")}
                    className={`px-3.5 py-2 rounded font-mono text-xs font-semibold cursor-pointer border ${
                      studioSection === "brief"
                        ? "bg-[#C5A059]/20 border-[#C5A059] text-[#F3EFE6]"
                        : "bg-[#0B0E14] border-[#263147] text-[#9CA3AF]"
                    }`}
                  >
                    3. Socratic Brief &amp; Lens Override
                  </button>
                </div>

                {/* SECTION 1: DE-ALARMIST HEADLINE REWRITER */}
                {studioSection === "headline" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded bg-[#0B0E14] border border-[#263147] space-y-1">
                        <div className="font-mono text-[10px] uppercase text-[#8E9BAE]">
                          Immutable Original Source Headline (original_title)
                        </div>
                        <div className="text-sm font-serif italic text-[#D6D1C7]">
                          &ldquo;
                          {selectedIncident.originalTitle ||
                            selectedIncident.title}
                          &rdquo;
                        </div>
                      </div>

                      <div className="p-3.5 rounded bg-[#0B0E14] border border-emerald-500/40 space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px] uppercase text-emerald-400">
                          <span>Active Public Display Headline</span>
                          <span>
                            {selectedIncident.titleRewritten
                              ? "NEUTRALIZED"
                              : "UNCHANGED"}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-[#F3EFE6]">
                          {selectedIncident.title}
                        </div>
                        {selectedIncident.titleRewriteReason && (
                          <div className="font-mono text-[10px] text-[#9CA3AF] pt-1">
                            Rationale: {selectedIncident.titleRewriteReason}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-xs uppercase text-[#C5A059]">
                        Neutralized Display Headline Override:
                      </label>
                      <input
                        type="text"
                        value={headlineDraft}
                        onChange={(e) => setHeadlineDraft(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded bg-[#0B0E14] border border-[#263147] text-sm text-[#F3EFE6]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block font-mono text-xs uppercase text-[#8E9BAE]">
                        Editorial De-Escalation Rationale (Recorded in
                        audit_ledger):
                      </label>
                      <input
                        type="text"
                        value={headlineReason}
                        onChange={(e) => setHeadlineReason(e.target.value)}
                        placeholder="e.g., Stripped sensationalist 'SLAMMED' framing in favor of neutral operational description."
                        className="w-full px-3.5 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                      />
                    </div>

                    {canMutate && (
                      <div className="flex flex-wrap items-center gap-2.5 pt-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleRewriteTitle({})}
                          className="px-4 py-2 rounded bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Save Neutralized Headline
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            handleRewriteTitle({ autoDeescalate: true })
                          }
                          className="px-4 py-2 rounded bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-200 font-mono text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                          ⚡ Auto-Neutralize with Gemini 2.5 Flash
                        </button>
                        {selectedIncident.titleRewritten && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() =>
                              handleRewriteTitle({ restoreOriginal: true })
                            }
                            className="px-3.5 py-2 rounded bg-[#0B0E14] hover:border-[#C5A059] border border-[#263147] text-[#D6D1C7] font-mono text-xs cursor-pointer"
                          >
                            Restore Original Title
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 2: VISUAL MEDIA & BLUEPRINT CARD STUDIO */}
                {studioSection === "media" && (
                  <div className="space-y-5">
                    {/* Live Preview */}
                    <div className="p-4 rounded bg-[#0B0E14] border border-[#263147] space-y-3">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-[#C5A059] uppercase">
                          Active Incident Visual Preview
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#182032] text-sky-300 text-[11px]">
                          Source Type: {selectedIncident.imageSourceType}
                        </span>
                      </div>

                      <div className="overflow-hidden rounded border border-[#1E2738] bg-[#111622]">
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

                      <div className="flex flex-wrap gap-2 pt-1">
                        {canMutate && (
                          <>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                handleAttachImage({ generateSvgCard: true })
                              }
                              className="px-3.5 py-1.5 rounded bg-[#182032] hover:border-[#C5A059] border border-[#2E3C56] font-mono text-xs text-[#C5A059] cursor-pointer"
                            >
                              Use Masonic/SRE Blueprint SVG Card
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                handleAttachImage({ extractFromSource: true })
                              }
                              className="px-3.5 py-1.5 rounded bg-sky-950/60 hover:bg-sky-900/70 border border-sky-500/40 font-mono text-xs text-sky-200 cursor-pointer"
                            >
                              Extract OG/Lead Image from Source URL
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                handleAttachImage({ clearImage: true })
                              }
                              className="px-3 py-1.5 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 font-mono text-xs text-red-200 cursor-pointer"
                            >
                              Clear Image
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* R2 File Upload */}
                    {canMutate && (
                      <div className="p-4 rounded bg-[#0B0E14] border border-[#263147] space-y-3">
                        <div className="font-mono text-xs uppercase text-[#C5A059]">
                          Upload Custom Image to Cloudflare R2 (cabcall-audio
                          /media/*)
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                            onChange={(e) =>
                              setUploadFile(e.target.files?.[0] || null)
                            }
                            className="text-xs font-mono text-[#D6D1C7] file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-[#182032] file:text-[#C5A059] file:font-mono file:text-xs"
                          />
                          <button
                            type="button"
                            disabled={submitting || !uploadFile}
                            onClick={handleUploadFileToR2}
                            className="px-4 py-2 rounded bg-[#C5A059] disabled:opacity-40 text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                          >
                            Upload &amp; Attach to Incident
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Manual Image URL / Alt / Caption */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                            Image URL (/media/... or https://...):
                          </label>
                          <input
                            type="text"
                            value={imageUrlDraft}
                            onChange={(e) => setImageUrlDraft(e.target.value)}
                            className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                          />
                        </div>
                        <div>
                          <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                            Source Type:
                          </label>
                          <select
                            value={imageSourceTypeDraft || "none"}
                            onChange={(e) =>
                              setImageSourceTypeDraft(
                                e.target.value as ImageSourceType
                              )
                            }
                            className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                          >
                            <option value="svg_card">svg_card</option>
                            <option value="rss">rss</option>
                            <option value="og">og</option>
                            <option value="upload">upload</option>
                            <option value="none">none</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                          Accessible Image Alt Text (image_alt):
                        </label>
                        <input
                          type="text"
                          value={imageAltDraft}
                          onChange={(e) => setImageAltDraft(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                        />
                      </div>

                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                          Editorial Caption &amp; Attribution (image_caption):
                        </label>
                        <input
                          type="text"
                          value={imageCaptionDraft}
                          onChange={(e) => setImageCaptionDraft(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                        />
                      </div>

                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                          Audit Reason:
                        </label>
                        <input
                          type="text"
                          value={imageReason}
                          onChange={(e) => setImageReason(e.target.value)}
                          placeholder="Reason for attaching/updating visual media…"
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                        />
                      </div>

                      {canMutate && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleAttachImage({})}
                          className="px-4 py-2 rounded bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Save Image Metadata &amp; Attachment
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 3: SOCRATIC BRIEF & LENS OVERRIDE */}
                {studioSection === "brief" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                          Primary Working Tool:
                        </label>
                        <select
                          value={primaryToolDraft}
                          onChange={(e) =>
                            setPrimaryToolDraft(
                              e.target.value as JevWorkingToolKey
                            )
                          }
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                        >
                          {WORKING_TOOL_OPTIONS.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                          Secondary Working Tool:
                        </label>
                        <select
                          value={secondaryToolDraft}
                          onChange={(e) =>
                            setSecondaryToolDraft(
                              e.target.value as JevWorkingToolKey
                            )
                          }
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                        >
                          {WORKING_TOOL_OPTIONS.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#F59E0B] mb-1">
                          SRE Failure Mode:
                        </label>
                        <select
                          value={failureModeDraft}
                          onChange={(e) =>
                            setFailureModeDraft(
                              e.target.value as JevSreFailureModeKey
                            )
                          }
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                        >
                          {FAILURE_MODE_OPTIONS.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Status, Pin, Hide, Lead Post-Mortem */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 rounded bg-[#0B0E14] border border-[#263147]">
                      <div>
                        <label className="block font-mono text-[10px] uppercase text-[#8E9BAE] mb-1">
                          Pipeline Status:
                        </label>
                        <select
                          value={statusDraft}
                          onChange={(e) =>
                            setStatusDraft(e.target.value as typeof statusDraft)
                          }
                          className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                        >
                          <option value="synthesized">synthesized</option>
                          <option value="triaged">triaged</option>
                          <option value="QUARANTINED">QUARANTINED</option>
                          <option value="dropped">dropped</option>
                          <option value="PENDING_RETRY">PENDING_RETRY</option>
                        </select>
                      </div>

                      <label className="inline-flex items-center gap-2 font-mono text-xs text-[#C5A059] cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={isPinnedDraft}
                          onChange={(e) => setIsPinnedDraft(e.target.checked)}
                        />
                        <span>Pin to Trestleboard</span>
                      </label>

                      <label className="inline-flex items-center gap-2 font-mono text-xs text-rose-300 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={isHiddenDraft}
                          onChange={(e) => setIsHiddenDraft(e.target.checked)}
                        />
                        <span>Hide from Public</span>
                      </label>

                      <label className="inline-flex items-center gap-2 font-mono text-xs text-emerald-300 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={isLeadDraft}
                          onChange={(e) => setIsLeadDraft(e.target.checked)}
                        />
                        <span>Lead Post-Mortem</span>
                      </label>
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                        Executive Summary (2 Factual Sentences for Trestleboard
                        Card):
                      </label>
                      <textarea
                        rows={2}
                        value={execSummaryDraft}
                        onChange={(e) => setExecSummaryDraft(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                        Section I — What Happened (The Plain Facts):
                      </label>
                      <textarea
                        rows={3}
                        value={socraticBriefDraft}
                        onChange={(e) => setSocraticBriefDraft(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-mono text-[11px] uppercase text-rose-400 mb-1">
                          Partisan Heat &amp; Spin (The Noise):
                        </label>
                        <textarea
                          rows={3}
                          value={noiseDraft}
                          onChange={(e) => setNoiseDraft(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                        />
                      </div>

                      <div>
                        <label className="block font-mono text-[11px] uppercase text-emerald-400 mb-1">
                          The Actual Foundation (The Signal):
                        </label>
                        <textarea
                          rows={3}
                          value={signalDraft}
                          onChange={(e) => setSignalDraft(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                          Socratic Question Q1:
                        </label>
                        <input
                          type="text"
                          value={q1Draft}
                          onChange={(e) => setQ1Draft(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                          Socratic Question Q2:
                        </label>
                        <input
                          type="text"
                          value={q2Draft}
                          onChange={(e) => setQ2Draft(e.target.value)}
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                        />
                      </div>
                    </div>

                    {isLeadDraft && (
                      <div>
                        <label className="block font-mono text-[11px] uppercase text-[#C5A059] mb-1">
                          Lead Post-Mortem Multi-Paragraph Analysis:
                        </label>
                        <textarea
                          rows={4}
                          value={leadAnalysisDraft}
                          onChange={(e) => setLeadAnalysisDraft(e.target.value)}
                          placeholder="Enter 2+ paragraphs separated by a blank line for the Featured Lead Post-Mortem slot…"
                          className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs text-[#F3EFE6]"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block font-mono text-[11px] uppercase text-[#8E9BAE] mb-1">
                        Internal Editorial Notes &amp; Audit Reason:
                      </label>
                      <input
                        type="text"
                        value={briefReason}
                        onChange={(e) => setBriefReason(e.target.value)}
                        placeholder="Reason for overriding brief or classification…"
                        className="w-full px-3 py-2 rounded bg-[#0B0E14] border border-[#263147] text-xs font-mono text-[#F3EFE6]"
                      />
                    </div>

                    {canMutate && (
                      <div className="flex flex-wrap items-center gap-2.5 pt-2">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleSaveBriefOverride(false)}
                          className="px-4 py-2 rounded bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Save Brief &amp; Classification Override
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleSaveBriefOverride(true)}
                          className="px-4 py-2 rounded bg-sky-950/70 hover:bg-sky-900/80 border border-sky-500/40 text-sky-200 font-mono text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                          ↻ Re-Trigger System-2 Gemini Synthesis
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recent Editorial & Transform Audit Ledger Trail */}
            <div className="bg-[#111622] border border-[#263147] rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E2738] pb-2.5">
                <span className="font-mono text-xs uppercase tracking-wider text-[#C5A059] font-bold">
                  Recent Editorial &amp; Media Audit Trail (SHA-256 Chained)
                </span>
                <Link
                  href="/admin/audit"
                  className="font-mono text-xs text-[#C5A059] hover:underline"
                >
                  Open Full Audit Ledger →
                </Link>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auditEntries
                  .filter(
                    (e) =>
                      e.actionType.startsWith("incident.") ||
                      e.actionType.startsWith("pipeline_transform.")
                  )
                  .slice(0, 10)
                  .map((entry) => (
                    <div
                      key={entry.eventId}
                      className="p-3 rounded bg-[#0B0E14] border border-[#1E2738] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[#C5A059] font-bold">
                            {entry.actionType}
                          </span>
                          <span className="text-[#8E9BAE]">
                            target #{entry.targetId}
                          </span>
                          <span className="text-[10px] text-emerald-400">
                            {entry.entryHash.slice(0, 10)}…
                          </span>
                        </div>
                        <div className="text-[#D6D1C7] text-[11px]">
                          {entry.reason}
                        </div>
                      </div>
                      {canMutate && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleReplayAuditEvent(entry.eventId)}
                          className="px-2.5 py-1 rounded border border-[#263147] hover:border-[#C5A059] text-[11px] text-[#C5A059] shrink-0 cursor-pointer"
                        >
                          Rollback State
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
