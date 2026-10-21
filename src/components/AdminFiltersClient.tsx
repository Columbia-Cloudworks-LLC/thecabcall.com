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
  FilterDryRunResult,
  IngestFeedRecord,
  IngestFilterMatchTarget,
  IngestFilterRecord,
  IngestFilterType,
  SystemSettingsMap,
} from "@/pipeline/ingest";

interface AdminFiltersClientProps {
  actor: AuthenticatedAdminActor;
  initialFilters: IngestFilterRecord[];
  initialThresholds: SystemSettingsMap;
  initialFeeds: IngestFeedRecord[];
  initialAuditEntries?: AuditLedgerEntry[];
  chainIntegrity?: AuditChainVerificationResult;
  embedded?: boolean;
}

const FILTER_TYPES: {
  value: IngestFilterType;
  label: string;
  badgeColor: string;
  desc: string;
}[] = [
  {
    value: "Drop_Keyword_Regex",
    label: "Exclude Keywords / Phrases",
    badgeColor: "bg-red-950/60 border-red-500/40 text-red-300",
    desc: "Filters out matching stories before case briefs are drafted",
  },
  {
    value: "Boost_Systemic_Prob",
    label: "Boost Topic Relevance",
    badgeColor: "bg-emerald-950/60 border-emerald-500/40 text-emerald-300",
    desc: "Raises the relevance score for high-priority topics",
  },
  {
    value: "Force_Working_Tool",
    label: "Assign Working Tool",
    badgeColor: "bg-[#C5A059]/20 border-[#C5A059] text-[#C5A059]",
    desc: "Assigns a primary Working Tool when keywords match",
  },
  {
    value: "Block_Source_Pattern",
    label: "Block URL Pattern",
    badgeColor: "bg-amber-950/60 border-amber-500/40 text-amber-300",
    desc: "Excludes matching URL paths or sections",
  },
  {
    value: "Require_Keyword_Regex",
    label: "Require Keywords",
    badgeColor: "bg-sky-950/60 border-sky-500/40 text-sky-300",
    desc: "Requires matching keywords to be present in the story",
  },
];

const WORKING_TOOL_KEYS = [
  { value: "square", label: "The Square (Policy & Governance Alignment)" },
  { value: "plumb", label: "The Plumb (Integrity & Conduct Under Pressure)" },
  {
    value: "twenty_four_inch_gauge",
    label: "24-Inch Gauge (Resource & Maintenance Allocation)",
  },
  {
    value: "common_gavel",
    label: "Common Gavel (Stripping Theater & Blame-Shifting)",
  },
  { value: "level", label: "The Level (Shared Accountability)" },
  { value: "trowel", label: "The Trowel (Cross-Silo Coordination)" },
];

export function AdminFiltersClient({
  actor,
  initialFilters,
  initialThresholds,
  initialFeeds,
  embedded = false,
}: AdminFiltersClientProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<IngestFilterRecord[]>(initialFilters);
  const [, setThresholds] = useState<SystemSettingsMap>(initialThresholds);

  // Filter table tab
  const [selectedTypeTab, setSelectedTypeTab] = useState<string>("all");

  // Minimum Relevance Score slider state
  const [minSysProb, setMinSysProb] = useState<number>(
    initialThresholds.jevMinSystemicProb
  );
  const [minConf, setMinConf] = useState<number>(
    initialThresholds.jevMinConfidence
  );
  const [maxNetNew, setMaxNetNew] = useState<number>(
    initialThresholds.maxNetNewPerRun
  );
  const [thresholdReason, setThresholdReason] = useState("");
  const [savingThresholds, setSavingThresholds] = useState(false);

  // Create new filter form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] =
    useState<IngestFilterType>("Drop_Keyword_Regex");
  const [newTarget, setNewTarget] =
    useState<IngestFilterMatchTarget>("title_and_excerpt");
  const [newPattern, setNewPattern] = useState("");
  const [newScopeFeedId, setNewScopeFeedId] = useState<string>("");
  const [newActionValue, setNewActionValue] = useState("drop");
  const [newReason, setNewReason] = useState("");
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Dry-run tester state
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<FilterDryRunResult | null>(
    null
  );
  const [customTestHeadline, setCustomTestHeadline] = useState("");
  const [customTestExcerpt, setCustomTestExcerpt] = useState("");

  // Edit filter modal state
  const [editingFilter, setEditingFilter] =
    useState<IngestFilterRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] =
    useState<IngestFilterType>("Drop_Keyword_Regex");
  const [editTarget, setEditTarget] =
    useState<IngestFilterMatchTarget>("title_and_excerpt");
  const [editPattern, setEditPattern] = useState("");
  const [editScopeFeedId, setEditScopeFeedId] = useState<string>("");
  const [editActionValue, setEditActionValue] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editReason, setEditReason] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete confirmation modal state
  const [deletingFilter, setDeletingFilter] =
    useState<IngestFilterRecord | null>(null);
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

  function handleNewTypeChange(nextType: IngestFilterType) {
    setNewType(nextType);
    if (nextType === "Boost_Systemic_Prob") {
      setNewActionValue("+0.18");
    } else if (nextType === "Force_Working_Tool") {
      setNewActionValue("square");
    } else if (nextType === "Block_Source_Pattern") {
      setNewTarget("url");
      setNewActionValue("drop");
    } else {
      setNewActionValue("drop");
    }
  }

  async function handleSaveThresholds(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;

    setSavingThresholds(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/filters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_thresholds",
          jevMinSystemicProb: minSysProb,
          jevMinConfidence: minConf,
          maxNetNewPerRun: maxNetNew,
          reason:
            thresholdReason.trim() ||
            `Updated Minimum Relevance Score to ${Math.round(
              minSysProb * 100
            )}% (classification confidence >= ${Math.round(minConf * 100)}%)`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        thresholds?: SystemSettingsMap;
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Relevance Settings Update Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (data.thresholds) {
          setThresholds(data.thresholds);
          setMinSysProb(data.thresholds.jevMinSystemicProb);
          setMinConf(data.thresholds.jevMinConfidence);
          setMaxNetNew(data.thresholds.maxNetNewPerRun);
        }
        setThresholdReason("");
        setBanner({
          type: "success",
          title: "Relevance Thresholds Saved",
          detail: `Minimum Relevance Score set to ${Math.round(
            minSysProb * 100
          )}% and recorded in the audit ledger.`,
        });
        router.refresh();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Threshold Save Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSavingThresholds(false);
    }
  }

  async function handleRunDryRun(includeCandidateFromForm = false) {
    setRunningDryRun(true);
    setBanner(null);
    try {
      const payload: Record<string, unknown> = {
        minSystemicProbOverride: minSysProb,
        limit: 18,
      };

      if (includeCandidateFromForm && newPattern.trim()) {
        payload.candidateFilter = {
          name: newName.trim() || "Candidate Rule Preview",
          filterType: newType,
          matchTarget: newTarget,
          pattern: newPattern.trim(),
          actionValue: newActionValue,
          scopeFeedId: newScopeFeedId ? Number(newScopeFeedId) : null,
        };
      }

      if (customTestHeadline.trim()) {
        payload.customSamples = [
          {
            title: customTestHeadline.trim(),
            excerpt: customTestExcerpt.trim() || customTestHeadline.trim(),
            sourceFeed: "Custom Sample Headline",
            sourceUrl: "https://thecabcall.com/admin/filters/dry-run",
          },
        ];
      }

      const res = await fetch("/api/admin/filters/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as FilterDryRunResult & {
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Filter Preview Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        setDryRunResult(data);
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Filter Preview Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunningDryRun(false);
    }
  }

  async function handleCreateFilter(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;

    setSubmittingCreate(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          filterType: newType,
          matchTarget: newTarget,
          pattern: newPattern.trim(),
          scopeFeedId: newScopeFeedId ? Number(newScopeFeedId) : null,
          actionValue: newActionValue.trim(),
          enabled: true,
          reason:
            newReason.trim() ||
            `Added editorial filter rule "${newName.trim()}"`,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filter?: IngestFilterRecord;
        filters?: IngestFilterRecord[];
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Create Filter Rule",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.filters)) {
          setFilters(data.filters);
        } else if (data.filter) {
          setFilters((prev) => [...prev, data.filter!]);
        }
        setNewName("");
        setNewDesc("");
        setNewPattern("");
        setNewReason("");
        setBanner({
          type: "success",
          title: `Created Filter Rule "${data.filter?.name}"`,
          detail: "Rule saved and recorded in the audit ledger.",
        });
        router.refresh();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Create Filter Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingCreate(false);
    }
  }

  function openEditModal(filter: IngestFilterRecord) {
    setEditingFilter(filter);
    setEditName(filter.name);
    setEditDesc(filter.description);
    setEditType(filter.filterType);
    setEditTarget(filter.matchTarget);
    setEditPattern(filter.pattern);
    setEditScopeFeedId(
      filter.scopeFeedId !== null ? String(filter.scopeFeedId) : ""
    );
    setEditActionValue(filter.actionValue || "drop");
    setEditEnabled(filter.enabled);
    setEditReason("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingFilter || !canMutate) return;

    setSubmittingEdit(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/filters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_filter",
          id: editingFilter.id,
          name: editName.trim(),
          description: editDesc.trim(),
          filterType: editType,
          matchTarget: editTarget,
          pattern: editPattern.trim(),
          scopeFeedId: editScopeFeedId ? Number(editScopeFeedId) : null,
          actionValue: editActionValue.trim(),
          enabled: editEnabled,
          reason:
            editReason.trim() ||
            `Updated editorial filter rule "${editName.trim()}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filter?: IngestFilterRecord;
        filters?: IngestFilterRecord[];
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Update Rule",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.filters)) {
          setFilters(data.filters);
        }
        setEditingFilter(null);
        setBanner({
          type: "success",
          title: `Updated Rule "${data.filter?.name}"`,
          detail: "Changes saved and recorded in the audit ledger.",
        });
        router.refresh();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Update Filter Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingEdit(false);
    }
  }

  async function handleToggleFilterEnabled(filter: IngestFilterRecord) {
    if (!canMutate) return;
    setBanner(null);
    try {
      const nextEnabled = !filter.enabled;
      const res = await fetch("/api/admin/filters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_filter",
          id: filter.id,
          enabled: nextEnabled,
          reason: `${nextEnabled ? "Enabled" : "Paused"} filter rule "${
            filter.name
          }"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filters?: IngestFilterRecord[];
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Toggle Rule Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.filters)) {
          setFilters(data.filters);
        }
        setBanner({
          type: "success",
          title: `${nextEnabled ? "Enabled" : "Paused"} "${filter.name}"`,
          detail: "Rule status updated and recorded in the audit ledger.",
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
    if (!deletingFilter || !canMutate) return;

    setSubmittingDelete(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/filters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deletingFilter.id,
          reason:
            deleteReason.trim() ||
            `Removed editorial filter rule "${deletingFilter.name}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filters?: IngestFilterRecord[];
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Remove Rule Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.filters)) {
          setFilters(data.filters);
        } else {
          setFilters((prev) => prev.filter((f) => f.id !== deletingFilter.id));
        }
        const removedName = deletingFilter.name;
        setDeletingFilter(null);
        setDeleteReason("");
        setBanner({
          type: "success",
          title: `Removed Rule "${removedName}"`,
          detail:
            "Full snapshot preserved in the audit ledger for 1-click restoration.",
        });
        router.refresh();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Remove Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingDelete(false);
    }
  }

  const visibleFilters =
    selectedTypeTab === "all"
      ? filters
      : filters.filter((f) => f.filterType === selectedTypeTab);

  const feedNameById = new Map<number, string>(
    initialFeeds.map((f) => [f.id, f.name])
  );

  function getFilterTypeBadge(type: IngestFilterType) {
    const spec = FILTER_TYPES.find((t) => t.value === type);
    return (
      <span
        className={`inline-block px-2 py-0.5 border font-display text-[10px] uppercase tracking-wider font-semibold ${
          spec?.badgeColor || "bg-[#0B0E14] border-[#8A6D3B]/45 text-[#94A3B8]"
        }`}
      >
        {spec?.label || type}
      </span>
    );
  }

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
              Editorial &amp; Feeds • Editorial Tone &amp; Filtering
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6]">
              Editorial Tone &amp; Filtering Rules
            </h1>
            <p className="font-serif text-sm text-[#94A3B8] max-w-2xl">
              Configure the Minimum Relevance Score, keyword exclusion rules,
              topic relevance boosts, and Working Tool assignments.
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

      {/* Top Row: Minimum Relevance Score Slider + Add New Filtering Rule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Minimum Relevance Score Control */}
        <div className="lg:col-span-5 relative bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
            <div>
              <h2 className="font-display text-base sm:text-lg text-[#F3EFE6] tracking-wide">
                Story Relevance Thresholds
              </h2>
              <p className="font-serif text-xs text-[#94A3B8]">
                Stories scoring below the Minimum Relevance Score are filtered
                out as low-signal noise.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-[#C5A059]/15 border border-[#C5A059] font-display text-xs font-bold text-[#C5A059]">
              ≥ {Math.round(minSysProb * 100)}%
            </span>
          </div>

          <form onSubmit={handleSaveThresholds} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-display uppercase tracking-wider text-[#F3EFE6]">
                  Minimum Relevance Score
                </label>
                <span className="font-mono text-[#C5A059] font-bold">
                  {Math.round(minSysProb * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={0.95}
                step={0.01}
                value={minSysProb}
                onChange={(e) => setMinSysProb(parseFloat(e.target.value))}
                className="w-full accent-[#C5A059] cursor-pointer"
              />
              <div className="flex justify-between font-sans text-[11px] text-[#94A3B8]">
                <span>50% (Broad)</span>
                <span>70% (Recommended)</span>
                <span>95% (Strict)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Minimum Classification Confidence
                </label>
                <input
                  type="number"
                  step={0.05}
                  min={0.3}
                  max={0.95}
                  value={minConf}
                  onChange={(e) =>
                    setMinConf(
                      Math.min(
                        0.95,
                        Math.max(0.3, Number(e.target.value) || 0.5)
                      )
                    )
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Max Stories / Fetch (1–50)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxNetNew}
                  onChange={(e) =>
                    setMaxNetNew(
                      Math.min(50, Math.max(1, Number(e.target.value) || 10))
                    )
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>
            </div>

            <div>
              <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                Editorial Note (Recorded in Audit Ledger)
              </label>
              <input
                type="text"
                value={thresholdReason}
                onChange={(e) => setThresholdReason(e.target.value)}
                placeholder="e.g. Tighten relevance threshold during high-volume news week"
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!canMutate || savingThresholds}
                className="flex-1 py-2.5 px-4 bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer"
              >
                {savingThresholds ? "Saving…" : "Save Relevance Settings"}
              </button>
              <button
                type="button"
                disabled={runningDryRun}
                onClick={() => handleRunDryRun(false)}
                className="px-3.5 py-2.5 bg-[#0B0E14] hover:border-[#C5A059] border border-[#8A6D3B]/55 font-display text-xs uppercase tracking-wider text-[#C5A059] cursor-pointer"
              >
                Preview @ {Math.round(minSysProb * 100)}%
              </button>
            </div>
          </form>
        </div>

        {/* Right: Create New Filtering Rule */}
        <div className="lg:col-span-7 relative bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
            <div>
              <h2 className="font-display text-base sm:text-lg text-[#F3EFE6] tracking-wide">
                Add Filtering or Routing Rule
              </h2>
              <p className="font-serif text-xs text-[#94A3B8]">
                Exclude noisy keywords, boost key topics, or assign a Working
                Tool when patterns match.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateFilter} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Exclude Celebrity & Sports Gossip"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6]"
                />
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Rule Action *
                </label>
                <select
                  value={newType}
                  onChange={(e) =>
                    handleNewTypeChange(e.target.value as IngestFilterType)
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6]"
                >
                  {FILTER_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>
                      {ft.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Check Field
                </label>
                <select
                  value={newTarget}
                  onChange={(e) =>
                    setNewTarget(e.target.value as IngestFilterMatchTarget)
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6]"
                >
                  <option value="title_and_excerpt">Headline &amp; Excerpt</option>
                  <option value="title">Headline Only</option>
                  <option value="excerpt">Excerpt Only</option>
                  <option value="url">Story URL</option>
                </select>
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Source Scope
                </label>
                <select
                  value={newScopeFeedId}
                  onChange={(e) => setNewScopeFeedId(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6]"
                >
                  <option value="">All Monitored Sources</option>
                  {initialFeeds.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      Only: {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Effect Value
                </label>
                {newType === "Force_Working_Tool" ? (
                  <select
                    value={newActionValue}
                    onChange={(e) => setNewActionValue(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-sans text-[#F3EFE6]"
                  >
                    {WORKING_TOOL_KEYS.map((wt) => (
                      <option key={wt.value} value={wt.value}>
                        {wt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newActionValue}
                    onChange={(e) => setNewActionValue(e.target.value)}
                    placeholder={
                      newType === "Boost_Systemic_Prob" ? "+0.18" : "drop"
                    }
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                Keywords or Pattern *
              </label>
              <input
                type="text"
                required
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. \b(wordle|horoscope|box office)\b or comma-separated keywords"
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#C5A059]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Rule Description
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Explains why this pattern is excluded or boosted"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Editorial Note (Recorded in Audit Ledger)
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Reason recorded in audit log"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={!canMutate || submittingCreate}
                className="flex-1 py-2.5 px-4 bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer"
              >
                {submittingCreate ? "Saving Rule…" : "+ Add Filtering Rule"}
              </button>
              <button
                type="button"
                disabled={runningDryRun}
                onClick={() => handleRunDryRun(true)}
                className="px-4 py-2.5 bg-[#0B0E14] hover:border-[#C5A059] border border-[#8A6D3B]/55 font-display text-xs uppercase tracking-wider text-[#C5A059] font-semibold cursor-pointer"
              >
                {runningDryRun ? "Testing…" : "Test Rule on Recent Stories"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Interactive Rule Tester */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#8A6D3B]/35 pb-4">
          <div>
            <h2 className="font-display text-base sm:text-lg text-[#F3EFE6] tracking-wide">
              Test Filtering Rules Against Recent Headlines
            </h2>
            <p className="font-serif text-xs text-[#94A3B8]">
              Preview how your active rules and Minimum Relevance Score evaluate
              recent stories or a custom sample headline.
            </p>
          </div>
          <button
            type="button"
            disabled={runningDryRun}
            onClick={() => handleRunDryRun(Boolean(newPattern.trim()))}
            className="px-4 py-2 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 border border-[#C5A059] font-display text-xs uppercase tracking-wider text-[#C5A059] font-bold cursor-pointer shrink-0"
          >
            {runningDryRun
              ? "Evaluating Headlines…"
              : "▶ Test Rules Against Recent Headlines"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#0B0E14] border border-[#8A6D3B]/40 p-3.5">
          <div className="md:col-span-5">
            <label className="block font-display text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
              Sample Headline (Optional)
            </label>
            <input
              type="text"
              value={customTestHeadline}
              onChange={(e) => setCustomTestHeadline(e.target.value)}
              placeholder="e.g. Inspector General Audit Finds Skipped FAA Failover Checks"
              className="w-full bg-[#111726] border border-[#8A6D3B]/45 px-2.5 py-1.5 text-xs font-serif text-[#F3EFE6]"
            />
          </div>
          <div className="md:col-span-5">
            <label className="block font-display text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
              Sample Excerpt (Optional)
            </label>
            <input
              type="text"
              value={customTestExcerpt}
              onChange={(e) => setCustomTestExcerpt(e.target.value)}
              placeholder="Enter sample paragraph to test keyword matching…"
              className="w-full bg-[#111726] border border-[#8A6D3B]/45 px-2.5 py-1.5 text-xs font-serif text-[#F3EFE6]"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              disabled={runningDryRun}
              onClick={() => handleRunDryRun(Boolean(newPattern.trim()))}
              className="w-full py-1.5 px-3 bg-[#111726] hover:border-[#C5A059] border border-[#8A6D3B]/55 font-display text-xs uppercase tracking-wider text-[#C5A059] cursor-pointer"
            >
              Test Sample
            </button>
          </div>
        </div>

        {dryRunResult && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="px-3 py-1 bg-[#0B0E14] border border-[#8A6D3B]/45 font-sans text-[#F3EFE6]">
                Evaluated: <strong>{dryRunResult.totalTested}</strong> stories
              </span>
              <span className="px-3 py-1 bg-emerald-950/60 border border-emerald-500/40 font-sans text-emerald-300">
                Accepted: <strong>{dryRunResult.triagedCount}</strong> (≥{" "}
                {Math.round(
                  dryRunResult.thresholds.jevMinSystemicProb * 100
                )}
                %)
              </span>
              <span className="px-3 py-1 bg-red-950/60 border border-red-500/40 font-sans text-red-300">
                Filtered Out: <strong>{dryRunResult.droppedCount}</strong>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[360px] border border-[#8A6D3B]/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#0B0E14] sticky top-0 font-display text-[11px] uppercase tracking-wider text-[#94A3B8] border-b border-[#8A6D3B]/35">
                  <tr>
                    <th className="py-2.5 px-3">Outcome</th>
                    <th className="py-2.5 px-3">Headline &amp; Source</th>
                    <th className="py-2.5 px-3">Relevance Score</th>
                    <th className="py-2.5 px-3">Working Tool</th>
                    <th className="py-2.5 px-3">Matched Rules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8A6D3B]/25 bg-[#0B0E14]/60">
                  {dryRunResult.results.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#111726]">
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 border font-display text-[10px] font-bold uppercase tracking-wider ${
                            item.finalOutcome === "triaged"
                              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                              : "bg-red-950/60 border-red-500/40 text-red-300"
                          }`}
                        >
                          {item.finalOutcome === "triaged"
                            ? "Accepted"
                            : "Filtered"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-serif text-sm text-[#F3EFE6]">
                          {item.title}
                        </div>
                        <div className="text-[11px] font-sans text-[#94A3B8]">
                          {item.sourceFeed}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className="text-[#94A3B8]">
                          {Math.round(item.baseSystemicProb * 100)}%
                        </span>{" "}
                        →{" "}
                        <span
                          className={`font-bold ${
                            item.adjustedSystemicProb >= item.thresholdApplied
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          {Math.round(item.adjustedSystemicProb * 100)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-display text-xs text-[#C5A059]">
                        {item.finalPrimaryTool}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.matchedFilters.length === 0 ? (
                          <span className="font-serif italic text-xs text-[#94A3B8]">
                            No rule match
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {item.matchedFilters.map((mf, mIdx) => (
                              <div
                                key={mIdx}
                                className="font-sans text-[11px] text-[#F3EFE6]"
                              >
                                <span className="text-[#C5A059] font-semibold">
                                  [{mf.filterName}]
                                </span>{" "}
                                {mf.effect}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Configured Filtering Rules Table */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#8A6D3B]/35 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-base sm:text-lg text-[#F3EFE6] tracking-wide">
              Active Filtering &amp; Routing Rules ({visibleFilters.length} of{" "}
              {filters.length})
            </h2>
            <p className="font-serif text-xs text-[#94A3B8]">
              Evaluated on every newsroom fetch before drafting case briefs.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTypeTab("all")}
              className={`px-2.5 py-1 border font-display text-[10px] uppercase tracking-wider cursor-pointer ${
                selectedTypeTab === "all"
                  ? "bg-[#C5A059] border-[#C5A059] text-[#0B0E14] font-bold"
                  : "bg-[#0B0E14] border-[#8A6D3B]/40 text-[#94A3B8]"
              }`}
            >
              All ({filters.length})
            </button>
            {FILTER_TYPES.map((ft) => {
              const count = filters.filter(
                (f) => f.filterType === ft.value
              ).length;
              return (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => setSelectedTypeTab(ft.value)}
                  className={`px-2.5 py-1 border font-display text-[10px] uppercase tracking-wider cursor-pointer ${
                    selectedTypeTab === ft.value
                      ? "bg-[#C5A059] border-[#C5A059] text-[#0B0E14] font-bold"
                      : "bg-[#0B0E14] border-[#8A6D3B]/40 text-[#94A3B8]"
                  }`}
                >
                  {ft.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#8A6D3B]/35 bg-[#0B0E14]/90 font-display text-[11px] uppercase tracking-wider text-[#94A3B8]">
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Rule Name &amp; Action</th>
                <th className="py-3 px-4">Field &amp; Scope</th>
                <th className="py-3 px-4">Keywords / Pattern</th>
                <th className="py-3 px-4">Effect</th>
                <th className="py-3 px-4">Matches</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8A6D3B]/25 text-xs">
              {visibleFilters.map((filter) => (
                <tr
                  key={filter.id}
                  className={`hover:bg-[#0B0E14]/50 transition-colors ${
                    !filter.enabled ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => handleToggleFilterEnabled(filter)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-display text-[10px] uppercase tracking-wider font-semibold cursor-pointer ${
                        filter.enabled
                          ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                          : "bg-[#0B0E14] border-[#8A6D3B]/40 text-[#94A3B8]"
                      }`}
                    >
                      <span>{filter.enabled ? "●" : "⏸"}</span>
                      <span>{filter.enabled ? "Active" : "Paused"}</span>
                    </button>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-display text-sm text-[#F3EFE6]">
                      {filter.name}
                    </div>
                    <div className="mt-1">
                      {getFilterTypeBadge(filter.filterType)}
                    </div>
                    {filter.description && (
                      <div className="font-serif text-xs text-[#94A3B8] mt-1 max-w-xs">
                        {filter.description}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-sans text-xs">
                    <div className="text-[#F3EFE6]">
                      {filter.matchTarget.replace(/_/g, " ")}
                    </div>
                    <div className="text-[#94A3B8] text-[11px] mt-0.5">
                      {filter.scopeFeedId
                        ? `Source: ${
                            feedNameById.get(filter.scopeFeedId) ||
                            `#${filter.scopeFeedId}`
                          }`
                        : "All Monitored Sources"}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#C5A059] max-w-xs break-all">
                    <code className="bg-[#0B0E14] border border-[#8A6D3B]/40 px-2 py-1 block">
                      {filter.pattern}
                    </code>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#F3EFE6]">
                    {filter.actionValue || "drop"}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[#C5A059] font-semibold">
                    {filter.hitCount}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    {canMutate && (
                      <div className="inline-flex items-center gap-1.5 font-display text-[10px] uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => openEditModal(filter)}
                          className="px-2.5 py-1 bg-[#0B0E14] hover:border-[#C5A059] border border-[#8A6D3B]/45 text-[#F3EFE6] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingFilter(filter);
                            setDeleteReason("");
                          }}
                          className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-200 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subtle Footer Link to Filter Audit History */}
      <div className="flex items-center justify-between pt-1 text-xs text-[#94A3B8]">
        <span className="font-serif italic">
          All filtering rules and relevance threshold adjustments are recorded
          in the immutable audit ledger.
        </span>
        <Link
          href="/admin/audit?targetType=ingest_filter"
          className="font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
        >
          View Filtering Audit History →
        </Link>
      </div>

      {/* Edit Filter Modal */}
      {editingFilter && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-[#C5A059] max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
              <h3 className="font-display text-lg text-[#F3EFE6]">
                Edit Filtering Rule — {editingFilter.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingFilter(null)}
                className="text-xs font-display text-[#94A3B8] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs text-[#F3EFE6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Rule Action
                  </label>
                  <select
                    value={editType}
                    onChange={(e) =>
                      setEditType(e.target.value as IngestFilterType)
                    }
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs text-[#F3EFE6]"
                  >
                    {FILTER_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Check Field
                  </label>
                  <select
                    value={editTarget}
                    onChange={(e) =>
                      setEditTarget(e.target.value as IngestFilterMatchTarget)
                    }
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs text-[#F3EFE6]"
                  >
                    <option value="title_and_excerpt">
                      Headline &amp; Excerpt
                    </option>
                    <option value="title">Headline Only</option>
                    <option value="excerpt">Excerpt Only</option>
                    <option value="url">Story URL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Keywords or Pattern *
                </label>
                <input
                  type="text"
                  required
                  value={editPattern}
                  onChange={(e) => setEditPattern(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#C5A059]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                    Effect Value
                  </label>
                  <input
                    type="text"
                    value={editActionValue}
                    onChange={(e) => setEditActionValue(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>

                <div>
                  <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                    Source Scope
                  </label>
                  <select
                    value={editScopeFeedId}
                    onChange={(e) => setEditScopeFeedId(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs text-[#F3EFE6]"
                  >
                    <option value="">All Monitored Sources</option>
                    {initialFeeds.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        Only: {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="edit-filter-enabled"
                  type="checkbox"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                />
                <label
                  htmlFor="edit-filter-enabled"
                  className="font-sans text-xs text-[#F3EFE6]"
                >
                  Rule Enabled
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
                  placeholder="Reason for updating this rule"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFilter(null)}
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

      {/* Delete Filter Confirmation Modal */}
      {deletingFilter && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-red-500/60 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-display text-lg text-[#F3EFE6]">
              Remove Rule &ldquo;{deletingFilter.name}&rdquo;?
            </h3>
            <p className="font-serif text-xs text-[#94A3B8]">
              This removes the filtering rule. A complete snapshot is preserved
              in the audit ledger for 1-click restoration.
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
                  placeholder="e.g. Consolidated into broader keyword exclusion rule"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingFilter(null)}
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
