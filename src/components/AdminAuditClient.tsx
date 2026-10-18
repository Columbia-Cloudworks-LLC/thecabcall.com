"use client";

import React, { useMemo, useState } from "react";
import type { AuthenticatedAdminActor } from "@/pipeline/auth";
import type {
  AuditChainVerificationResult,
  AuditDisclosureBundle,
  AuditLedgerEntry,
  AuditReplayResult,
} from "@/pipeline/audit";

interface AdminAuditClientProps {
  actor: AuthenticatedAdminActor;
  initialEntries: AuditLedgerEntry[];
  initialTotal: number;
  initialChainIntegrity: AuditChainVerificationResult;
  initialSelectedEventId?: string;
  initialFilters?: {
    actionType?: string;
    targetType?: string;
    targetId?: string;
    actorEmail?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  };
}

const KNOWN_ACTION_TYPES = [
  "all",
  "system.bootstrap",
  "user.invite",
  "user.revoke",
  "user.role_change",
  "user.update",
  "auth.unauthorized_attempt",
  "episode.generate",
  "episode.update",
  "episode.delete",
  "feed.create",
  "feed.update",
  "feed.delete",
  "filter.create",
  "filter.update",
  "filter.delete",
  "incident.rewrite_title",
  "incident.attach_image",
  "incident.override_brief",
  "incident.status_change",
  "outbound_feed.update",
  "pipeline_transform.update",
  "pipeline.run_ingest",
  "pipeline.run_synthesize",
  "audit.replay",
];

const KNOWN_TARGET_TYPES = [
  "all",
  "audit_ledger",
  "user",
  "episode",
  "ingest_feed",
  "ingest_filter",
  "incident_article",
  "outbound_feed",
  "pipeline_transform",
  "system_settings",
  "pipeline",
];

type FieldDiffStatus = "added" | "removed" | "modified" | "unchanged";

interface FieldDiffRow {
  key: string;
  status: FieldDiffStatus;
  beforeVal: string;
  afterVal: string;
}

function formatDiffValue(val: unknown): string {
  if (val === undefined) return "— (absent)";
  if (val === null) return "null";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function computeFieldDiffs(
  beforeState: Record<string, unknown> | null,
  afterState: Record<string, unknown> | null
): FieldDiffRow[] {
  const keys = new Set<string>();
  if (beforeState) {
    Object.keys(beforeState).forEach((k) => keys.add(k));
  }
  if (afterState) {
    Object.keys(afterState).forEach((k) => keys.add(k));
  }

  const rows: FieldDiffRow[] = [];
  for (const key of Array.from(keys).sort()) {
    const hasBefore =
      beforeState !== null &&
      Object.prototype.hasOwnProperty.call(beforeState, key);
    const hasAfter =
      afterState !== null &&
      Object.prototype.hasOwnProperty.call(afterState, key);

    const bRaw = hasBefore ? beforeState![key] : undefined;
    const aRaw = hasAfter ? afterState![key] : undefined;

    const beforeVal = formatDiffValue(bRaw);
    const afterVal = formatDiffValue(aRaw);

    let status: FieldDiffStatus = "unchanged";
    if (!hasBefore && hasAfter) {
      status = "added";
    } else if (hasBefore && !hasAfter) {
      status = "removed";
    } else if (JSON.stringify(bRaw) !== JSON.stringify(aRaw)) {
      status = "modified";
    }

    rows.push({
      key,
      status,
      beforeVal,
      afterVal,
    });
  }

  return rows;
}

export function AdminAuditClient({
  actor,
  initialEntries,
  initialTotal,
  initialChainIntegrity,
  initialSelectedEventId,
  initialFilters,
}: AdminAuditClientProps) {
  const [entries, setEntries] = useState<AuditLedgerEntry[]>(initialEntries);
  const [total, setTotal] = useState<number>(initialTotal);
  const [chainIntegrity, setChainIntegrity] =
    useState<AuditChainVerificationResult>(initialChainIntegrity);

  // Filter state
  const [actionType, setActionType] = useState(
    initialFilters?.actionType || "all"
  );
  const [targetType, setTargetType] = useState(
    initialFilters?.targetType || "all"
  );
  const [targetId, setTargetId] = useState(initialFilters?.targetId || "");
  const [actorEmail, setActorEmail] = useState(
    initialFilters?.actorEmail || ""
  );
  const [search, setSearch] = useState(initialFilters?.search || "");
  const [fromDate, setFromDate] = useState(initialFilters?.fromDate || "");
  const [toDate, setToDate] = useState(initialFilters?.toDate || "");
  const [loadingList, setLoadingList] = useState(false);
  const [verifyingChain, setVerifyingChain] = useState(false);

  // Selected entry for Side-by-Side Diff & Replay Studio
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialSelectedEventId || initialEntries[0]?.eventId || null
  );
  const [showUnchangedFields, setShowUnchangedFields] = useState(true);

  // Replay confirmation modal state
  const [replayModal, setReplayModal] = useState<{
    entry: AuditLedgerEntry;
    mode: "revert_to_before" | "reapply_after";
  } | null>(null);
  const [replayReason, setReplayReason] = useState("");
  const [executingReplay, setExecutingReplay] = useState(false);

  // Inline Disclosure Report Preview Modal
  const [disclosurePreview, setDisclosurePreview] =
    useState<AuditDisclosureBundle | null>(null);
  const [loadingDisclosure, setLoadingDisclosure] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedHashKey, setCopiedHashKey] = useState<string | null>(null);

  // Feedback toast / alert
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    title: string;
    detail: string;
  } | null>(null);

  const canReplay = actor.role === "owner" || actor.role === "admin";

  const selectedEntry = useMemo(() => {
    if (!selectedEventId) return entries[0] || null;
    return (
      entries.find((e) => e.eventId === selectedEventId) || entries[0] || null
    );
  }, [entries, selectedEventId]);

  const fieldDiffs = useMemo(() => {
    if (!selectedEntry) return [];
    return computeFieldDiffs(
      selectedEntry.beforeState,
      selectedEntry.afterState
    );
  }, [selectedEntry]);

  const visibleFieldDiffs = useMemo(() => {
    if (showUnchangedFields) return fieldDiffs;
    return fieldDiffs.filter((d) => d.status !== "unchanged");
  }, [fieldDiffs, showUnchangedFields]);

  const actionTypeOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_ACTION_TYPES);
    entries.forEach((e) => set.add(e.actionType));
    return Array.from(set);
  }, [entries]);

  const targetTypeOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_TARGET_TYPES);
    entries.forEach((e) => set.add(e.targetType));
    return Array.from(set);
  }, [entries]);

  function buildFilterQueryString(overrides?: {
    actionType?: string;
    targetType?: string;
    targetId?: string;
    actorEmail?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }): string {
    const params = new URLSearchParams();
    const act = overrides ? overrides.actionType : actionType;
    const tgt = overrides ? overrides.targetType : targetType;
    const tid = overrides ? overrides.targetId : targetId;
    const actEmail = overrides ? overrides.actorEmail : actorEmail;
    const q = overrides ? overrides.search : search;
    const fd = overrides ? overrides.fromDate : fromDate;
    const td = overrides ? overrides.toDate : toDate;

    if (act && act !== "all") params.set("actionType", act);
    if (tgt && tgt !== "all") params.set("targetType", tgt);
    if (tid && tid.trim()) params.set("targetId", tid.trim());
    if (actEmail && actEmail.trim()) params.set("actorEmail", actEmail.trim());
    if (q && q.trim()) params.set("search", q.trim());
    if (fd && fd.trim()) params.set("fromDate", fd.trim());
    if (td && td.trim()) params.set("toDate", td.trim());
    params.set("limit", "200");
    return params.toString();
  }

  async function fetchFilteredEntries(overrides?: {
    actionType?: string;
    targetType?: string;
    targetId?: string;
    actorEmail?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    setLoadingList(true);
    try {
      const qs = buildFilterQueryString(overrides);
      const res = await fetch(`/api/admin/audit${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          entries?: AuditLedgerEntry[];
          total?: number;
          chainIntegrity?: AuditChainVerificationResult;
        };
        if (Array.isArray(data.entries)) {
          setEntries(data.entries);
          if (
            data.entries.length > 0 &&
            (!selectedEventId ||
              !data.entries.some((e) => e.eventId === selectedEventId))
          ) {
            setSelectedEventId(data.entries[0].eventId);
          }
        }
        if (typeof data.total === "number") {
          setTotal(data.total);
        }
        if (data.chainIntegrity) {
          setChainIntegrity(data.chainIntegrity);
        }
      }
    } catch (err) {
      setStatusBanner({
        type: "error",
        title: "Failed to query audit ledger",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoadingList(false);
    }
  }

  async function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    await fetchFilteredEntries();
  }

  async function handleResetFilters() {
    setActionType("all");
    setTargetType("all");
    setTargetId("");
    setActorEmail("");
    setSearch("");
    setFromDate("");
    setToDate("");
    await fetchFilteredEntries({
      actionType: "all",
      targetType: "all",
      targetId: "",
      actorEmail: "",
      search: "",
      fromDate: "",
      toDate: "",
    });
  }

  async function handleVerifyChainNow() {
    setVerifyingChain(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/admin/audit/verify", {
        cache: "no-store",
      });
      const data = (await res.json()) as AuditChainVerificationResult;
      setChainIntegrity(data);
      if (data.valid) {
        setStatusBanner({
          type: "success",
          title:
            "Cryptographic SHA-256 Chain Verification Passed (100% Intact)",
          detail: `Recomputed SHA-256 digests across all ${
            data.totalEntries
          } entries from GENESIS (${data.genesisHash?.slice(
            0,
            16
          )}…) to HEAD (${data.headHash?.slice(0, 16)}…). Verified at ${
            data.verifiedAt
          }.`,
        });
      } else {
        setStatusBanner({
          type: "error",
          title: "Cryptographic Chain Integrity Violation Detected",
          detail:
            data.error ||
            `Mismatch at ledger ID #${data.brokenAtId} (${data.brokenAtEventId})`,
        });
      }
    } catch (err) {
      setStatusBanner({
        type: "error",
        title: "Verification Request Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setVerifyingChain(false);
    }
  }

  function openReplayModal(
    entry: AuditLedgerEntry,
    mode: "revert_to_before" | "reapply_after"
  ) {
    const defaultReason =
      mode === "revert_to_before"
        ? `Revert ${entry.targetType}:${entry.targetId} to prior state before event #${entry.id} (${entry.actionType})`
        : `Re-apply after_state of event #${entry.id} (${entry.actionType}) on ${entry.targetType}:${entry.targetId}`;
    setReplayReason(defaultReason);
    setReplayModal({ entry, mode });
  }

  async function handleConfirmReplay(e: React.FormEvent) {
    e.preventDefault();
    if (!replayModal) return;

    setExecutingReplay(true);
    setStatusBanner(null);

    try {
      const res = await fetch("/api/admin/audit/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: replayModal.entry.eventId,
          mode: replayModal.mode,
          reason:
            replayReason.trim() ||
            `State replay (${replayModal.mode}) of ${replayModal.entry.eventId}`,
        }),
      });

      const data = (await res.json()) as AuditReplayResult & {
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setStatusBanner({
          type: "error",
          title: "Audit State Replay Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        setStatusBanner({
          type: "success",
          title: `State Replay Executed (${data.mode.toUpperCase()} → ${data.appliedOperation.toUpperCase()})`,
          detail: `Target ${data.targetType}:${
            data.targetId
          } restored and recorded as new immutable audit.replay event #${
            data.auditEntry.id
          } (${data.auditEntry.entryHash.slice(0, 16)}…).`,
        });
        setReplayModal(null);
        setReplayReason("");
        await fetchFilteredEntries();
        if (data.auditEntry?.eventId) {
          setSelectedEventId(data.auditEntry.eventId);
        }
      }
    } catch (err) {
      setStatusBanner({
        type: "error",
        title: "Audit State Replay Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExecutingReplay(false);
    }
  }

  async function handlePreviewDisclosure() {
    setLoadingDisclosure(true);
    try {
      const qs = buildFilterQueryString();
      const res = await fetch(
        `/api/admin/audit/export?format=json${qs ? `&${qs}` : ""}`,
        {
          cache: "no-store",
        }
      );
      if (res.ok) {
        const bundle = (await res.json()) as AuditDisclosureBundle;
        setDisclosurePreview(bundle);
        setCopiedMarkdown(false);
      }
    } catch (err) {
      setStatusBanner({
        type: "error",
        title: "Failed to generate disclosure preview",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoadingDisclosure(false);
    }
  }

  function copyHash(key: string, value: string | null | undefined) {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedHashKey(key);
    setTimeout(() => setCopiedHashKey(null), 2000);
  }

  const exportQuerySuffix = useMemo(() => {
    const qs = buildFilterQueryString();
    return qs ? `&${qs}` : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionType, targetType, targetId, actorEmail, search, fromDate, toDate]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Cryptographic Chain Verifier Banner */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 rounded-md p-6 space-y-4 shadow-lg">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-[#C5A059]/60"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#C5A059]/60"
        />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs uppercase tracking-widest text-[#C5A059] font-semibold">
                SETTINGS &amp; AUDIT // IMMUTABLE AUDIT LEDGER
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-sm border font-mono text-xs font-bold ${
                  chainIntegrity.valid
                    ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-300"
                    : "bg-red-950/80 border-red-500 text-red-200"
                }`}
              >
                <span>{chainIntegrity.valid ? "●" : "▲"}</span>
                <span>
                  {chainIntegrity.valid
                    ? "SHA-256 HASH CHAIN VERIFIED"
                    : "HASH CHAIN INTEGRITY VIOLATION"}
                </span>
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3EFE6] tracking-wide">
              Audit Trail Explorer, Diff Inspector &amp; State Replay Studio
            </h1>
            <p className="font-serif text-sm text-[#E5E0D8]/85 max-w-3xl">
              Every administrative and editorial mutation is protected by SQLite{" "}
              <code className="text-[#C5A059] font-mono text-xs">BEFORE UPDATE</code> and{" "}
              <code className="text-[#C5A059] font-mono text-xs">BEFORE DELETE</code> immutability
              triggers and chained from <code className="text-emerald-300 font-mono text-xs">GENESIS</code>{" "}
              via SHA-256 digests. Inspect field-level diffs, deterministically
              revert or re-apply state, or export signed public disclosure
              reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={verifyingChain}
              onClick={handleVerifyChainNow}
              className="px-4 py-2.5 rounded-sm bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/50 text-emerald-200 font-mono text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {verifyingChain
                ? "Recomputing SHA-256 Chain…"
                : "✓ Re-Verify SHA-256 Chain"}
            </button>

            <button
              type="button"
              disabled={loadingDisclosure}
              onClick={handlePreviewDisclosure}
              className="px-3.5 py-2.5 rounded-sm bg-[#0B0E14] hover:bg-[#111726] border border-[#8A6D3B]/45 hover:border-[#C5A059] text-[#F3EFE6] font-mono text-xs transition-colors cursor-pointer"
            >
              {loadingDisclosure ? "Building Report…" : "Preview Disclosure"}
            </button>

            <a
              href={`/api/admin/audit/export?format=md${exportQuerySuffix}`}
              className="px-3.5 py-2.5 rounded-sm bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-mono text-xs font-bold uppercase transition-colors"
            >
              Export .MD
            </a>

            <a
              href={`/api/admin/audit/export?format=json${exportQuerySuffix}`}
              className="px-3.5 py-2.5 rounded-sm border border-[#C5A059]/60 hover:border-[#C5A059] text-[#C5A059] font-mono text-xs font-semibold uppercase transition-colors"
            >
              Export .JSON
            </a>
          </div>
        </div>

        {/* Cryptographic Chain Digest Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#8A6D3B]/35 font-mono text-xs">
          <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-3">
            <div className="text-[10px] uppercase text-[#9CA3AF]">
              Total Chained Entries
            </div>
            <div className="text-lg font-bold text-[#F3EFE6] mt-0.5">
              {chainIntegrity.totalEntries} Entries
            </div>
            <div className="text-[10px] text-emerald-300 mt-0.5">
              Triggers: trg_audit_ledger_no_update / delete
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-[#9CA3AF]">
                GENESIS Entry Digest (Row #1)
              </span>
              <button
                type="button"
                onClick={() =>
                  copyHash("genesis", chainIntegrity.genesisHash || "GENESIS")
                }
                className="text-[10px] text-[#C5A059] hover:underline cursor-pointer"
              >
                {copiedHashKey === "genesis" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div
              className="text-xs text-[#E5E0D8] mt-1 truncate"
              title={chainIntegrity.genesisHash || "GENESIS"}
            >
              {chainIntegrity.genesisHash || "GENESIS"}
            </div>
            <div className="text-[10px] text-[#9CA3AF] mt-0.5">
              prev_hash: GENESIS
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase text-[#9CA3AF]">
                Current HEAD Digest
              </span>
              <button
                type="button"
                onClick={() => copyHash("head", chainIntegrity.headHash)}
                className="text-[10px] text-[#C5A059] hover:underline cursor-pointer"
              >
                {copiedHashKey === "head" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div
              className="text-xs text-emerald-300 mt-1 truncate"
              title={chainIntegrity.headHash}
            >
              {chainIntegrity.headHash}
            </div>
            <div className="text-[10px] text-[#9CA3AF] mt-0.5 truncate">
              HEAD Time: {chainIntegrity.headTimestamp || "—"}
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-3">
            <div className="text-[10px] uppercase text-[#9CA3AF]">
              Chain Verification Timestamp
            </div>
            <div className="text-xs text-[#F3EFE6] mt-1">
              {chainIntegrity.verifiedAt.replace("T", " ").slice(0, 19)} UTC
            </div>
            <div className="text-[10px] text-emerald-300 mt-0.5">
              Web Crypto SHA-256 Digest Match
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusBanner && (
        <div
          className={`p-4 rounded-sm border font-mono text-xs flex items-start justify-between gap-4 ${
            statusBanner.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/40 border-red-500/40 text-red-200"
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider">
              {statusBanner.title}
            </div>
            <div className="text-[#E5E0D8]">{statusBanner.detail}</div>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="underline text-xs shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Filterable Event Log Controls */}
      <form
        onSubmit={handleApplyFilters}
        className="bg-[#111726] border border-[#8A6D3B]/45 rounded-md p-5 space-y-4 shadow-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-xs uppercase tracking-wider text-[#C5A059] font-semibold">
            Filter Audit Trail Events ({entries.length} shown of {total} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-sm border border-[#8A6D3B]/45 hover:border-[#C5A059] font-mono text-xs text-[#9CA3AF] hover:text-[#F3EFE6] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              type="submit"
              disabled={loadingList}
              className="px-4 py-1.5 rounded-sm bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-mono text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingList ? "Filtering…" : "Apply Filters"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 font-mono text-xs">
          <div>
            <label className="block text-[10px] uppercase text-[#9CA3AF] mb-1">
              Action Type
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 px-2.5 py-2 text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
            >
              {actionTypeOptions.map((act) => (
                <option key={act} value={act}>
                  {act === "all" ? "All Action Types" : act}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#9CA3AF] mb-1">
              Target Type
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="w-full rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 px-2.5 py-2 text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
            >
              {targetTypeOptions.map((tgt) => (
                <option key={tgt} value={tgt}>
                  {tgt === "all" ? "All Target Types" : tgt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#9CA3AF] mb-1">
              Actor Email
            </label>
            <input
              type="text"
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              placeholder="e.g. system@thecabcall.com"
              className="w-full rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 px-2.5 py-2 text-[#F3EFE6] placeholder-[#9CA3AF]/60 focus:border-[#C5A059] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#9CA3AF] mb-1">
              Target ID
            </label>
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="e.g. cabcall-db or slug"
              className="w-full rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 px-2.5 py-2 text-[#F3EFE6] placeholder-[#9CA3AF]/60 focus:border-[#C5A059] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#9CA3AF] mb-1">
              From Date (ISO)
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 px-2.5 py-2 text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-[#9CA3AF] mb-1">
              To Date (ISO)
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 px-2.5 py-2 text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase text-[#9CA3AF] mb-1">
            Full-Text Search (Event UUID, Reason, Before/After JSON State)
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search across event_id, disclosure reason, before_state_json, after_state_json…"
            className="w-full rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 font-mono text-xs text-[#F3EFE6] placeholder-[#9CA3AF]/60 focus:border-[#C5A059] focus:outline-none"
          />
        </div>
      </form>

      {/* 3. Master-Detail Grid: Event Table (Left) + Side-by-Side Diff & Replay Studio (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Filterable Event Log Table (5 cols on xl) */}
        <div className="xl:col-span-5 bg-[#111726] border border-[#8A6D3B]/45 rounded-md overflow-hidden shadow-md">
          <div className="p-4 border-b border-[#8A6D3B]/35 bg-[#0B0E14] flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase text-[#F3EFE6]">
              Hash-Chained Event Log ({entries.length})
            </span>
            <span className="font-mono text-[11px] text-[#9CA3AF]">
              Click any row to inspect &amp; replay
            </span>
          </div>

          <div className="divide-y divide-[#8A6D3B]/25 max-h-[820px] overflow-y-auto">
            {entries.length === 0 ? (
              <div className="p-8 text-center font-mono text-xs text-[#9CA3AF]">
                No audit ledger events match the current filter criteria.
              </div>
            ) : (
              entries.map((entry) => {
                const isSelected = selectedEntry?.eventId === entry.eventId;
                return (
                  <button
                    key={entry.eventId}
                    type="button"
                    onClick={() => setSelectedEventId(entry.eventId)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer block ${
                      isSelected
                        ? "bg-[#0B0E14] border-l-4 border-l-[#C5A059]"
                        : "hover:bg-[#0B0E14]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#F3EFE6]">
                          #{entry.id}
                        </span>
                        <span className="px-2 py-0.5 rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 font-mono text-[11px] text-[#C5A059] font-semibold">
                          {entry.actionType}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#9CA3AF]">
                        {entry.timestamp.replace("T", " ").slice(0, 19)} UTC
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                      <span className="text-[#E5E0D8]">
                        Target:{" "}
                        <strong className="text-[#F3EFE6]">
                          {entry.targetType}:{entry.targetId}
                        </strong>
                      </span>
                      <span className="text-[#9CA3AF]">
                        {entry.actorEmail} ({entry.authMethod})
                      </span>
                    </div>

                    {entry.reason && (
                      <p className="mt-1.5 font-serif text-xs text-[#E5E0D8]/80 line-clamp-2">
                        {entry.reason}
                      </p>
                    )}

                    <div className="mt-2 pt-2 border-t border-[#8A6D3B]/20 flex items-center justify-between font-mono text-[10px] text-[#9CA3AF]">
                      <span>
                        prev:{" "}
                        {entry.prevHash === "GENESIS"
                          ? "GENESIS"
                          : `${entry.prevHash.slice(0, 10)}…`}
                      </span>
                      <span className="text-emerald-300">
                        hash: {entry.entryHash.slice(0, 12)}…
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Side-by-Side Diff & Replay Drawer (7 cols on xl) */}
        <div className="xl:col-span-7 bg-[#111726] border border-[#8A6D3B]/45 rounded-md overflow-hidden shadow-md">
          {!selectedEntry ? (
            <div className="p-12 text-center font-mono text-xs text-[#9CA3AF]">
              Select an audit ledger event on the left to inspect its SHA-256
              chain link, before/after state diff, and replay options.
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Inspector Header & Replay Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-[#8A6D3B]/35">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs uppercase text-[#C5A059] font-bold">
                      EVENT #{selectedEntry.id} INSPECTOR
                    </span>
                    <span className="px-2 py-0.5 rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 font-mono text-xs text-[#F3EFE6] font-semibold">
                      {selectedEntry.actionType}
                    </span>
                    <span className="font-mono text-xs text-[#9CA3AF]">
                      {selectedEntry.timestamp}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[#9CA3AF]">
                    UUID:{" "}
                    <span className="text-[#F3EFE6]">
                      {selectedEntry.eventId}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[#9CA3AF]">
                    Target:{" "}
                    <span className="text-[#C5A059] font-semibold">
                      {selectedEntry.targetType}
                    </span>{" "}
                    /{" "}
                    <span className="text-[#F3EFE6]">
                      {selectedEntry.targetId}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[#9CA3AF]">
                    Actor:{" "}
                    <span className="text-[#F3EFE6]">
                      {selectedEntry.actorEmail}
                    </span>{" "}
                    ({selectedEntry.actorRole.toUpperCase()} via{" "}
                    {selectedEntry.authMethod}
                    {selectedEntry.actorIpHash
                      ? ` • ${selectedEntry.actorIpHash}`
                      : ""}
                    )
                  </div>
                </div>

                {/* Deterministic Revert / Replay Buttons */}
                {selectedEntry.actionType !== "system.bootstrap" && canReplay && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        openReplayModal(selectedEntry, "revert_to_before")
                      }
                      className="px-3.5 py-2 rounded-sm bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/50 text-amber-200 font-mono text-xs font-semibold transition-colors cursor-pointer"
                    >
                      ↺ Revert to Before State
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openReplayModal(selectedEntry, "reapply_after")
                      }
                      className="px-3.5 py-2 rounded-sm bg-[#0B0E14] hover:bg-[#111726] border border-[#8A6D3B]/45 hover:border-[#C5A059] text-[#F3EFE6] font-mono text-xs font-semibold transition-colors cursor-pointer"
                    >
                      ↻ Re-Apply After State
                    </button>
                  </div>
                )}
              </div>

              {/* Disclosure Reason Box */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] font-semibold">
                  Editorial / Governance Disclosure Justification (reason)
                </div>
                <p className="font-serif text-sm text-[#F3EFE6] mt-1">
                  {selectedEntry.reason ||
                    "No explicit reason recorded for this event."}
                </p>
              </div>

              {/* Cryptographic Chain Provenance Box */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-4 space-y-2 font-mono text-xs">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                  Cryptographic SHA-256 Chain Link
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-[#9CA3AF]">
                      Previous Entry Hash (prev_hash)
                    </div>
                    <div className="text-[#E5E0D8] break-all mt-0.5">
                      {selectedEntry.prevHash}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#9CA3AF]">
                      Entry SHA-256 Digest (entry_hash)
                    </div>
                    <div className="text-emerald-300 break-all mt-0.5">
                      {selectedEntry.entryHash}
                    </div>
                  </div>
                </div>
              </div>

              {/* Field-Level Diff Inspector */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-xs uppercase tracking-wider text-[#C5A059] font-semibold">
                    Field-Level State Diff ({fieldDiffs.length} fields)
                  </div>
                  <label className="inline-flex items-center gap-2 font-mono text-xs text-[#9CA3AF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showUnchangedFields}
                      onChange={(e) => setShowUnchangedFields(e.target.checked)}
                      className="rounded-sm border-[#8A6D3B]/45 bg-[#0B0E14] accent-[#C5A059]"
                    />
                    <span>Show Unchanged Fields</span>
                  </label>
                </div>

                {visibleFieldDiffs.length === 0 ? (
                  <div className="p-4 rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/35 font-mono text-xs text-[#9CA3AF]">
                    No field differences to display.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#8A6D3B]/35 rounded-sm">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="bg-[#0B0E14] border-b border-[#8A6D3B]/35 text-[10px] uppercase text-[#9CA3AF]">
                          <th className="py-2.5 px-3">Field</th>
                          <th className="py-2.5 px-3">Delta</th>
                          <th className="py-2.5 px-3">Before State</th>
                          <th className="py-2.5 px-3">After State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#8A6D3B]/20">
                        {visibleFieldDiffs.map((row) => (
                          <tr
                            key={row.key}
                            className={
                              row.status === "added"
                                ? "bg-emerald-950/20"
                                : row.status === "removed"
                                ? "bg-red-950/20"
                                : row.status === "modified"
                                ? "bg-amber-950/20"
                                : "bg-[#0B0E14]"
                            }
                          >
                            <td className="py-2.5 px-3 font-semibold text-[#F3EFE6] align-top whitespace-nowrap">
                              {row.key}
                            </td>
                            <td className="py-2.5 px-3 align-top whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-bold ${
                                  row.status === "added"
                                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                                    : row.status === "removed"
                                    ? "bg-red-950/80 text-red-300 border border-red-500/40"
                                    : row.status === "modified"
                                    ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                                    : "bg-[#111726] text-[#9CA3AF]"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-red-200/90 align-top whitespace-pre-wrap break-all max-w-[240px]">
                              {row.beforeVal}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-200/90 align-top whitespace-pre-wrap break-all max-w-[240px]">
                              {row.afterVal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Side-by-Side Raw JSON Snapshots */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-3">
                  <div className="font-mono text-[10px] uppercase text-red-300 font-semibold mb-2">
                    before_state_json (Prior Snapshot)
                  </div>
                  <pre className="font-mono text-[11px] text-[#E5E0D8] overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                    {selectedEntry.beforeState
                      ? JSON.stringify(selectedEntry.beforeState, null, 2)
                      : "null (Created new entity — no prior state)"}
                  </pre>
                </div>

                <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-3">
                  <div className="font-mono text-[10px] uppercase text-emerald-300 font-semibold mb-2">
                    after_state_json (Post-Mutation Snapshot)
                  </div>
                  <pre className="font-mono text-[11px] text-[#E5E0D8] overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                    {selectedEntry.afterState
                      ? JSON.stringify(selectedEntry.afterState, null, 2)
                      : "null (Entity deleted)"}
                  </pre>
                </div>
              </div>

              {/* Deterministic Replay Command Payload */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/35 rounded-sm p-3">
                <div className="font-mono text-[10px] uppercase text-[#9CA3AF] font-semibold mb-1">
                  Deterministic Replay Command (replay_command_json)
                </div>
                <pre className="font-mono text-[11px] text-[#9CA3AF] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedEntry.replayCommand, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm State Replay / Revert Modal */}
      {replayModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReplay}
            className="bg-[#111726] border-2 border-[#C5A059] rounded-md max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-[#C5A059] font-bold">
                DETERMINISTIC AUDIT STATE REPLAY
              </span>
              <button
                type="button"
                onClick={() => setReplayModal(null)}
                className="font-mono text-xs text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <h3 className="font-display text-xl font-bold text-[#F3EFE6]">
              {replayModal.mode === "revert_to_before"
                ? `Revert Event #${replayModal.entry.id} to Prior State`
                : `Re-Apply Event #${replayModal.entry.id} After State`}
            </h3>

            <p className="font-serif text-xs text-[#E5E0D8]">
              This operation will restore{" "}
              <strong className="font-mono text-[#F3EFE6]">
                {replayModal.entry.targetType}:{replayModal.entry.targetId}
              </strong>{" "}
              in Cloudflare D1 to its{" "}
              <code className="text-[#C5A059] font-mono">
                {replayModal.mode === "revert_to_before"
                  ? "before_state_json"
                  : "after_state_json"}
              </code>{" "}
              snapshot and append a new cryptographically hash-chained{" "}
              <code className="text-emerald-300 font-mono">audit.replay</code> record to{" "}
              <code className="font-mono">audit_ledger</code>.
            </p>

            <div>
              <label className="block font-mono text-xs uppercase text-[#9CA3AF] mb-1.5">
                Mandatory Disclosure Reason for Audit Ledger
              </label>
              <textarea
                rows={3}
                required
                value={replayReason}
                onChange={(e) => setReplayReason(e.target.value)}
                className="w-full rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 p-3 font-mono text-xs text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReplayModal(null)}
                className="px-4 py-2 rounded-sm border border-[#8A6D3B]/45 font-mono text-xs text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={executingReplay}
                className="px-4 py-2 rounded-sm bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-mono text-xs font-bold uppercase cursor-pointer disabled:opacity-50"
              >
                {executingReplay
                  ? "Executing Replay…"
                  : "Confirm & Append Audit Record"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Public Disclosure Report Preview Modal */}
      {disclosurePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-[#C5A059] rounded-md max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#8A6D3B]/35 flex flex-wrap items-center justify-between gap-2 bg-[#0B0E14]">
              <div>
                <div className="font-mono text-xs uppercase text-[#C5A059] font-bold">
                  SIGNED PUBLIC DISCLOSURE REPORT PREVIEW
                </div>
                <div className="font-mono text-[11px] text-[#9CA3AF]">
                  Bundle Signature SHA-256:{" "}
                  <span className="text-emerald-300">
                    {disclosurePreview.bundleSignatureHash}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      disclosurePreview.markdownReport
                    );
                    setCopiedMarkdown(true);
                  }}
                  className="px-3 py-1.5 rounded-sm bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase cursor-pointer"
                >
                  {copiedMarkdown ? "Copied Markdown!" : "Copy Markdown"}
                </button>
                <button
                  type="button"
                  onClick={() => setDisclosurePreview(null)}
                  className="px-3 py-1.5 rounded-sm border border-[#8A6D3B]/45 font-mono text-xs text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
                >
                  Close ✕
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-[#0B0E14]">
              <pre className="font-mono text-xs text-[#E5E0D8] whitespace-pre-wrap">
                {disclosurePreview.markdownReport}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
