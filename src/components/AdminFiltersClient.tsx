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
  initialAuditEntries: AuditLedgerEntry[];
  chainIntegrity?: AuditChainVerificationResult;
}

const FILTER_TYPES: {
  value: IngestFilterType;
  label: string;
  badgeColor: string;
  desc: string;
}[] = [
  {
    value: "Drop_Keyword_Regex",
    label: "Drop Keyword / Regex",
    badgeColor: "bg-red-950/60 border-red-500/40 text-red-300",
    desc: "Drops matching dispatches before System-2 synthesis",
  },
  {
    value: "Boost_Systemic_Prob",
    label: "Boost Systemic Probability",
    badgeColor: "bg-emerald-950/60 border-emerald-500/40 text-emerald-300",
    desc: "Adjusts Jev systemic probability by configured delta (e.g. +0.18)",
  },
  {
    value: "Force_Working_Tool",
    label: "Force Working Tool",
    badgeColor: "bg-[#C5A059]/20 border-[#C5A059] text-[#E5C178]",
    desc: "Assigns a primary Masonic Working Tool when pattern matches",
  },
  {
    value: "Block_Source_Pattern",
    label: "Block Source URL Pattern",
    badgeColor: "bg-amber-950/60 border-amber-500/40 text-amber-300",
    desc: "Blocks matching URL paths or query parameters",
  },
  {
    value: "Require_Keyword_Regex",
    label: "Require Keyword / Regex",
    badgeColor: "bg-sky-950/60 border-sky-500/40 text-sky-300",
    desc: "Requires pattern to be present or drops the item",
  },
];

const WORKING_TOOL_KEYS = [
  { value: "square", label: "The Square (Policy / Constitutional Drift)" },
  { value: "plumb", label: "The Plumb (Integrity & Conduct Under Pressure)" },
  {
    value: "twenty_four_inch_gauge",
    label: "24-Inch Gauge (Resource & Maintenance Allocation)",
  },
  {
    value: "common_gavel",
    label: "Common Gavel (Stripping Theater & Blame-Shifting)",
  },
  { value: "level", label: "The Level (Asymmetric Accountability)" },
  { value: "trowel", label: "The Trowel (Cross-Silo Trust & Coordination)" },
];

export function AdminFiltersClient({
  actor,
  initialFilters,
  initialThresholds,
  initialFeeds,
  initialAuditEntries,
  chainIntegrity,
}: AdminFiltersClientProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<IngestFilterRecord[]>(initialFilters);
  const [thresholds, setThresholds] =
    useState<SystemSettingsMap>(initialThresholds);
  const [auditEntries, setAuditEntries] =
    useState<AuditLedgerEntry[]>(initialAuditEntries);

  // Filter table tab
  const [selectedTypeTab, setSelectedTypeTab] = useState<string>("all");

  // Global Jev threshold slider state
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

  async function refreshAuditLog() {
    try {
      const res = await fetch("/api/admin/audit?limit=25", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { entries?: AuditLedgerEntry[] };
        if (Array.isArray(data.entries)) {
          setAuditEntries(
            data.entries.filter(
              (e) =>
                e.targetType === "ingest_filter" ||
                e.targetType === "system_settings"
            )
          );
        }
      }
    } catch {
      // ignore
    }
    router.refresh();
  }

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
            `Adjusted Jev systemic probability threshold to ${minSysProb.toFixed(
              2
            )} (confidence >= ${minConf.toFixed(
              2
            )}, maxNetNew = ${maxNetNew})`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        thresholds?: SystemSettingsMap;
        auditEntry?: AuditLedgerEntry;
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Threshold Update Failed",
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
          title: "Global Jev Thresholds Updated & Audited",
          detail: `jev_min_systemic_prob = ${minSysProb.toFixed(
            2
          )} committed to D1 system_settings (${data.auditEntry?.entryHash.slice(
            0,
            12
          )}…).`,
        });
        await refreshAuditLog();
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
            excerpt:
              customTestExcerpt.trim() || customTestHeadline.trim(),
            sourceFeed: "Admin Custom Dry-Run Headline",
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
          title: "Filter Dry-Run Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        setDryRunResult(data);
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Dry-Run Error",
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
            `Added triage filter rule "${newName.trim()}" (${newType})`,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filter?: IngestFilterRecord;
        filters?: IngestFilterRecord[];
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Create Triage Filter",
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
          title: `Created Filter "${data.filter?.name}"`,
          detail: `Recorded filter.create in audit_ledger (${data.auditEntry?.entryHash.slice(
            0,
            12
          )}…).`,
        });
        await refreshAuditLog();
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
            `Updated triage filter rule "${editName.trim()}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filter?: IngestFilterRecord;
        filters?: IngestFilterRecord[];
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Update Filter",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.filters)) {
          setFilters(data.filters);
        }
        setEditingFilter(null);
        setBanner({
          type: "success",
          title: `Updated Filter "${data.filter?.name}"`,
          detail: `Recorded filter.update in audit_ledger (${data.auditEntry?.entryHash.slice(
            0,
            12
          )}…).`,
        });
        await refreshAuditLog();
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
          reason: `${nextEnabled ? "Enabled" : "Paused"} triage filter "${filter.name}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filters?: IngestFilterRecord[];
        auditEntry?: AuditLedgerEntry;
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Toggle Filter Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.filters)) {
          setFilters(data.filters);
        }
        setBanner({
          type: "success",
          title: `${nextEnabled ? "Enabled" : "Paused"} "${filter.name}"`,
          detail: `Recorded filter.update in audit_ledger (${data.auditEntry?.entryHash.slice(
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
            `Deleted triage filter "${deletingFilter.name}"`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filters?: IngestFilterRecord[];
        auditEntry?: AuditLedgerEntry;
      };
      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Delete Filter Failed",
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
          title: `Deleted Filter "${removedName}"`,
          detail: `Recorded filter.delete with full before_state_json in audit_ledger (${data.auditEntry?.entryHash.slice(
            0,
            12
          )}…).`,
        });
        await refreshAuditLog();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Delete Error",
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
        className={`inline-block px-2 py-0.5 rounded border font-mono text-[10px] font-semibold ${
          spec?.badgeColor || "bg-slate-900 border-slate-600 text-slate-300"
        }`}
      >
        {spec?.label || type}
      </span>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#263147] pb-6">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[#C5A059]">
            STAGE 2 &amp; 3 TRIAGE GATE // D1 INGEST_FILTERS &amp; JEV THRESHOLDS
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F3EFE6] mt-1">
            Triage Filter Rules &amp; Jev Systemic Gate Thresholds
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1 max-w-3xl">
            Manage keyword/regex noise drop rules, institutional signal boost
            rules, working-tool routing overrides, and the global TypeSafe Jev (
            <code>jev-1.14.0</code>) systemic probability gate threshold—backed
            by the immutable SHA-256 audit ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/feeds"
            className="px-3.5 py-2 rounded-md bg-[#151C2C] hover:bg-[#1D263B] border border-[#2E3C56] font-mono text-xs text-[#E5C178] transition-colors"
          >
            ← Manage Inbound Feeds
          </Link>
          <Link
            href="/admin/audit?targetType=ingest_filter"
            className="px-3.5 py-2 rounded-md bg-[#111622] hover:bg-[#182032] border border-[#263147] font-mono text-xs text-[#D6D1C7] transition-colors"
          >
            Inspect Filter Audit Log ({chainIntegrity?.totalEntries ?? "—"})
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

      {/* Top Row: Global Jev Systemic Threshold Slider + Add New Filter Rule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Global Jev Systemic Probability Threshold Control */}
        <div className="lg:col-span-5 bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#263147] pb-3">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#F3EFE6]">
                System-1 Jev Gate Thresholds
              </h2>
              <p className="text-xs font-mono text-[#8E9BAE]">
                Stored in D1 <code>system_settings</code> • Emits{" "}
                <code>settings.threshold_update</code>
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#C5A059]/20 border border-[#C5A059] font-mono text-xs font-bold text-[#E5C178]">
              ≥ {Math.round(minSysProb * 100)}%
            </span>
          </div>

          <form onSubmit={handleSaveThresholds} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <label className="text-[#D6D1C7]">
                  Min Systemic Probability (<code>jev_min_systemic_prob</code>)
                </label>
                <span className="text-[#E5C178] font-bold">
                  {minSysProb.toFixed(2)} ({Math.round(minSysProb * 100)}%)
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
              <div className="flex justify-between font-mono text-[10px] text-[#8E9BAE]">
                <span>0.50 (Permissive)</span>
                <span>0.70 (CAB Baseline)</span>
                <span>0.95 (Strict High-Sev)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Min Tool Confidence (0.30–0.95)
                </label>
                <input
                  type="number"
                  step={0.05}
                  min={0.3}
                  max={0.95}
                  value={minConf}
                  onChange={(e) =>
                    setMinConf(
                      Math.min(0.95, Math.max(0.3, Number(e.target.value) || 0.5))
                    )
                  }
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Max Net-New / Run (1–50)
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
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                Audit Justification Reason
              </label>
              <input
                type="text"
                value={thresholdReason}
                onChange={(e) => setThresholdReason(e.target.value)}
                placeholder="e.g. Tighten systemic triage gate during high-volume news cycle"
                className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!canMutate || savingThresholds}
                className="flex-1 py-2.5 px-4 rounded bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {savingThresholds
                  ? "Committing…"
                  : "Commit Thresholds & Audit"}
              </button>
              <button
                type="button"
                disabled={runningDryRun}
                onClick={() => handleRunDryRun(false)}
                className="px-3.5 py-2.5 rounded bg-[#182032] hover:bg-[#222D45] border border-[#3A4A6B] font-mono text-xs text-[#E5C178] cursor-pointer"
              >
                Dry-Run @ {minSysProb.toFixed(2)}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Create New Triage Filter Rule */}
        <div className="lg:col-span-7 bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#263147] pb-3">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#F3EFE6]">
                Add New Triage Filter Rule
              </h2>
              <p className="text-xs font-mono text-[#8E9BAE]">
                Supports regular expressions (e.g.{" "}
                <code>\b(wordle|horoscope)\b</code>) or comma-separated keywords
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-[#182032] border border-[#2E3C56] font-mono text-[11px] text-[#D6D1C7]">
              Emits <code>filter.create</code>
            </span>
          </div>

          <form onSubmit={handleCreateFilter} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Crypto Pump & Meme Coin Drop"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Filter Type *
                </label>
                <select
                  value={newType}
                  onChange={(e) =>
                    handleNewTypeChange(e.target.value as IngestFilterType)
                  }
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
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
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Match Target
                </label>
                <select
                  value={newTarget}
                  onChange={(e) =>
                    setNewTarget(e.target.value as IngestFilterMatchTarget)
                  }
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                >
                  <option value="title_and_excerpt">Title + Excerpt</option>
                  <option value="title">Headline Title Only</option>
                  <option value="excerpt">Excerpt Body Only</option>
                  <option value="url">Article URL</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Feed Scope
                </label>
                <select
                  value={newScopeFeedId}
                  onChange={(e) => setNewScopeFeedId(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                >
                  <option value="">All Inbound Feeds (Global)</option>
                  {initialFeeds.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      Only: {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Action Value
                </label>
                {newType === "Force_Working_Tool" ? (
                  <select
                    value={newActionValue}
                    onChange={(e) => setNewActionValue(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
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
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                Keyword List or Regular Expression Pattern *
              </label>
              <input
                type="text"
                required
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. \b(dogecoin|memecoin|airdrop|nft floor)\b or comma-separated keywords"
                className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#E5C178]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Operational Description
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Explains why this pattern is filtered or boosted"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Audit Justification Reason
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Reason recorded in public disclosure log"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={!canMutate || submittingCreate}
                className="flex-1 py-2.5 px-4 rounded bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {submittingCreate
                  ? "Saving Rule…"
                  : "+ Create Filter Rule & Audit"}
              </button>
              <button
                type="button"
                disabled={runningDryRun}
                onClick={() => handleRunDryRun(true)}
                className="px-4 py-2.5 rounded bg-[#182032] hover:bg-[#222D45] border border-[#3A4A6B] font-mono text-xs text-[#E5C178] font-semibold cursor-pointer"
              >
                {runningDryRun
                  ? "Running Dry-Run…"
                  : "Dry-Run Preview Candidate Pattern"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Interactive Filter Dry-Run Tester Studio */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#263147] pb-4">
          <div>
            <h2 className="text-lg font-serif font-bold text-[#F3EFE6]">
              Interactive Filter Dry-Run Tester
            </h2>
            <p className="text-xs font-mono text-[#8E9BAE]">
              Non-destructively evaluates all {filters.filter((f) => f.enabled).length}{" "}
              active filters (plus any candidate rule above) against live D1
              dispatches &amp; synthetic control headlines
            </p>
          </div>
          <button
            type="button"
            disabled={runningDryRun}
            onClick={() => handleRunDryRun(Boolean(newPattern.trim()))}
            className="px-4 py-2 rounded bg-[#C5A059]/20 hover:bg-[#C5A059]/30 border border-[#C5A059] font-mono text-xs text-[#E5C178] font-bold cursor-pointer shrink-0"
          >
            {runningDryRun
              ? "Evaluating Corpus…"
              : "▶ Run Filter Dry-Run Against Recent Headlines"}
          </button>
        </div>

        {/* Optional Custom Sample Input for Dry-Run */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#0B0E14] border border-[#263147] rounded p-3.5">
          <div className="md:col-span-5">
            <label className="block font-mono text-[11px] text-[#8E9BAE] mb-1">
              Optional Custom Test Headline
            </label>
            <input
              type="text"
              value={customTestHeadline}
              onChange={(e) => setCustomTestHeadline(e.target.value)}
              placeholder="e.g. Inspector General Audit Finds Skipped FAA Failover Checks"
              className="w-full bg-[#111622] border border-[#263147] rounded px-2.5 py-1.5 text-xs font-mono text-[#F3EFE6]"
            />
          </div>
          <div className="md:col-span-5">
            <label className="block font-mono text-[11px] text-[#8E9BAE] mb-1">
              Optional Custom Test Excerpt
            </label>
            <input
              type="text"
              value={customTestExcerpt}
              onChange={(e) => setCustomTestExcerpt(e.target.value)}
              placeholder="Enter sample paragraph to test keyword/regex matching and Jev boost…"
              className="w-full bg-[#111622] border border-[#263147] rounded px-2.5 py-1.5 text-xs font-mono text-[#F3EFE6]"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              disabled={runningDryRun}
              onClick={() => handleRunDryRun(Boolean(newPattern.trim()))}
              className="w-full py-1.5 px-3 rounded bg-[#182032] hover:bg-[#222D45] border border-[#3A4A6B] font-mono text-xs text-[#E5C178] cursor-pointer"
            >
              Test Sample
            </button>
          </div>
        </div>

        {dryRunResult && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <span className="px-3 py-1 rounded bg-[#0B0E14] border border-[#263147] text-[#D6D1C7]">
                Tested: <strong>{dryRunResult.totalTested}</strong> items
              </span>
              <span className="px-3 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                Triaged:{" "}
                <strong>{dryRunResult.triagedCount}</strong> (≥{" "}
                {dryRunResult.thresholds.jevMinSystemicProb.toFixed(2)})
              </span>
              <span className="px-3 py-1 rounded bg-red-950/60 border border-red-500/40 text-red-300">
                Dropped as Noise: <strong>{dryRunResult.droppedCount}</strong>
              </span>
              {dryRunResult.candidateFilterSummary && (
                <span className="px-3 py-1 rounded bg-[#C5A059]/20 border border-[#C5A059] text-[#E5C178]">
                  Candidate Rule &ldquo;
                  {dryRunResult.candidateFilterSummary.name}&rdquo; Matched:{" "}
                  <strong>
                    {dryRunResult.candidateFilterSummary.matchCount}
                  </strong>{" "}
                  items
                </span>
              )}
            </div>

            <div className="overflow-x-auto max-h-[380px] border border-[#263147] rounded">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#0B0E14] sticky top-0 font-mono text-[11px] uppercase text-[#8E9BAE] border-b border-[#263147]">
                  <tr>
                    <th className="py-2.5 px-3">Verdict</th>
                    <th className="py-2.5 px-3">Headline &amp; Source</th>
                    <th className="py-2.5 px-3">Systemic Prob</th>
                    <th className="py-2.5 px-3">Primary Tool</th>
                    <th className="py-2.5 px-3">Matched Filter Rules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#263147]/60 bg-[#0E131D]">
                  {dryRunResult.results.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#151D2D]">
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                            item.finalOutcome === "triaged"
                              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                              : "bg-red-950/60 border-red-500/40 text-red-300"
                          }`}
                        >
                          {item.finalOutcome}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#F3EFE6]">
                          {item.title}
                        </div>
                        <div className="text-[11px] font-mono text-[#8E9BAE]">
                          {item.sourceFeed}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className="text-[#8E9BAE]">
                          {item.baseSystemicProb.toFixed(2)}
                        </span>{" "}
                        →{" "}
                        <span
                          className={`font-bold ${
                            item.adjustedSystemicProb >= item.thresholdApplied
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          {item.adjustedSystemicProb.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#E5C178]">
                        {item.finalPrimaryTool}
                      </td>
                      <td className="py-2.5 px-3">
                        {item.matchedFilters.length === 0 ? (
                          <span className="font-mono text-[11px] text-[#64748B]">
                            No filter match (pure Jev score)
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {item.matchedFilters.map((mf, mIdx) => (
                              <div
                                key={mIdx}
                                className="font-mono text-[11px] text-[#D6D1C7]"
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

      {/* Configured Triage Filters Table */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#263147] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-serif font-bold text-[#F3EFE6]">
              Configured Triage Filter Rules ({visibleFilters.length} of{" "}
              {filters.length})
            </h2>
            <p className="text-xs font-mono text-[#8E9BAE]">
              Evaluated on every ingestion pass before and after TypeSafe Jev
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTypeTab("all")}
              className={`px-2.5 py-1 rounded border font-mono text-[11px] cursor-pointer ${
                selectedTypeTab === "all"
                  ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E5C178]"
                  : "bg-[#0B0E14] border-[#263147] text-[#9CA3AF]"
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
                  className={`px-2.5 py-1 rounded border font-mono text-[11px] cursor-pointer ${
                    selectedTypeTab === ft.value
                      ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E5C178]"
                      : "bg-[#0B0E14] border-[#263147] text-[#9CA3AF]"
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
              <tr className="border-b border-[#263147] bg-[#0B0E14]/80 font-mono text-[11px] uppercase text-[#8E9BAE]">
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Rule Name &amp; Type</th>
                <th className="py-3 px-4">Target &amp; Scope</th>
                <th className="py-3 px-4">Pattern (Regex / Keywords)</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Hits</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263147]/60 text-xs">
              {visibleFilters.map((filter) => (
                <tr
                  key={filter.id}
                  className={`hover:bg-[#161D2B]/60 transition-colors ${
                    !filter.enabled ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-3.5 px-4 font-mono">
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => handleToggleFilterEnabled(filter)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
                        filter.enabled
                          ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900 border-slate-600 text-slate-400"
                      }`}
                    >
                      <span>{filter.enabled ? "●" : "⏸"}</span>
                      <span>{filter.enabled ? "ACTIVE" : "PAUSED"}</span>
                    </button>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#F3EFE6]">
                      {filter.name}
                    </div>
                    <div className="mt-1">
                      {getFilterTypeBadge(filter.filterType)}
                    </div>
                    {filter.description && (
                      <div className="text-[11px] text-[#8E9BAE] mt-1 max-w-xs">
                        {filter.description}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    <div className="text-[#D6D1C7]">{filter.matchTarget}</div>
                    <div className="text-[#8E9BAE] mt-0.5">
                      {filter.scopeFeedId
                        ? `Feed: ${
                            feedNameById.get(filter.scopeFeedId) ||
                            `#${filter.scopeFeedId}`
                          }`
                        : "Global (All Feeds)"}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#E5C178] max-w-xs break-all">
                    <code className="bg-[#0B0E14] border border-[#263147] px-2 py-1 rounded block">
                      {filter.pattern}
                    </code>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#F3EFE6]">
                    {filter.actionValue || "drop"}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-sky-300 font-semibold">
                    {filter.hitCount}
                  </td>

                  <td className="py-3.5 px-4 text-right font-mono">
                    {canMutate && (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(filter)}
                          className="px-2.5 py-1 rounded bg-[#111622] hover:bg-[#1B2436] border border-[#263147] text-[11px] text-[#D6D1C7] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingFilter(filter);
                            setDeleteReason("");
                          }}
                          className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-[11px] text-red-200 cursor-pointer"
                        >
                          Delete
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

      {/* Recent Filter & Threshold Audit Ledger Entries */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#263147] pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-[#F3EFE6]">
              Recent Filter &amp; Threshold Audit Trail
            </h2>
            <p className="text-xs font-mono text-[#8E9BAE]">
              All filter creations, updates, deletions, and threshold changes
              are recorded in <code>audit_ledger</code>
            </p>
          </div>
          <Link
            href="/admin/audit?targetType=ingest_filter"
            className="font-mono text-xs text-[#C5A059] hover:underline"
          >
            Open in Replay Studio →
          </Link>
        </div>

        {auditEntries.length === 0 ? (
          <div className="text-xs font-mono text-[#8E9BAE] py-4">
            No filter or threshold mutations recorded yet beyond baseline seed.
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
                      {entry.targetType} #{entry.targetId}
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

      {/* Edit Filter Modal */}
      {editingFilter && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111622] border border-[#C5A059] rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#263147] pb-3">
              <h3 className="text-lg font-serif font-bold text-[#F3EFE6]">
                Edit Triage Filter #{editingFilter.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingFilter(null)}
                className="text-xs font-mono text-[#8E9BAE] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Filter Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) =>
                      setEditType(e.target.value as IngestFilterType)
                    }
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  >
                    {FILTER_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Match Target
                  </label>
                  <select
                    value={editTarget}
                    onChange={(e) =>
                      setEditTarget(e.target.value as IngestFilterMatchTarget)
                    }
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  >
                    <option value="title_and_excerpt">Title + Excerpt</option>
                    <option value="title">Headline Title Only</option>
                    <option value="excerpt">Excerpt Body Only</option>
                    <option value="url">Article URL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Pattern (Regex or Keywords) *
                </label>
                <input
                  type="text"
                  required
                  value={editPattern}
                  onChange={(e) => setEditPattern(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#E5C178]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Action Value
                  </label>
                  <input
                    type="text"
                    value={editActionValue}
                    onChange={(e) => setEditActionValue(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Scope Feed
                  </label>
                  <select
                    value={editScopeFeedId}
                    onChange={(e) => setEditScopeFeedId(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  >
                    <option value="">All Inbound Feeds</option>
                    {initialFeeds.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        Only: {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
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
                  className="font-mono text-xs text-[#D6D1C7]"
                >
                  Rule Enabled
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
                  placeholder="Reason for updating this filter rule"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFilter(null)}
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

      {/* Delete Filter Confirmation Modal */}
      {deletingFilter && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111622] border border-red-500/60 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-serif font-bold text-[#F3EFE6]">
              Delete Filter Rule &ldquo;{deletingFilter.name}&rdquo;?
            </h3>
            <p className="text-xs text-[#9CA3AF]">
              This deletes the rule from <code>ingest_filters</code> and records
              a <code>filter.delete</code> entry in <code>audit_ledger</code>{" "}
              with its full <code>before_state_json</code> so it can be restored
              anytime via Audit Replay.
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
                  placeholder="e.g. Consolidated into broader noise exclusion regex"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingFilter(null)}
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
