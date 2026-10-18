"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthenticatedAdminActor } from "@/pipeline/auth";
import type {
  AuditChainVerificationResult,
  AuditLedgerEntry,
} from "@/pipeline/audit";
import type { AdminEpisodeRecord } from "@/pipeline/rollup";
import type { TelemetryArticleRow } from "@/pipeline/synthesize";

interface AdminEpisodesClientProps {
  actor: AuthenticatedAdminActor;
  initialEpisodes: AdminEpisodeRecord[];
  candidateIncidents: TelemetryArticleRow[];
  initialAuditEntries: AuditLedgerEntry[];
  chainIntegrity?: AuditChainVerificationResult;
}

const TTS_VOICE_OPTIONS: Array<{
  label: string;
  provider: "gemini-tts" | "mpeg-framed";
  voice: string;
}> = [
  {
    label: "Gemini TTS — Kore (Default Host Cadence)",
    provider: "gemini-tts",
    voice: "Kore",
  },
  {
    label: "Gemini TTS — Charon (Deep Analytical)",
    provider: "gemini-tts",
    voice: "Charon",
  },
  {
    label: "Gemini TTS — Fenrir (Broadcast Baritone)",
    provider: "gemini-tts",
    voice: "Fenrir",
  },
  {
    label: "Gemini TTS — Puck (Crisp Studio)",
    provider: "gemini-tts",
    voice: "Puck",
  },
  {
    label: "Gemini TTS — Aoede (Warm Narrative)",
    provider: "gemini-tts",
    voice: "Aoede",
  },
  {
    label: "Deterministic MPEG-1 Layer 3 Framed Stream (Instant MP3)",
    provider: "mpeg-framed",
    voice: "Kore",
  },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function AdminEpisodesClient({
  actor,
  initialEpisodes,
  candidateIncidents,
  initialAuditEntries,
  chainIntegrity,
}: AdminEpisodesClientProps) {
  const router = useRouter();
  const [episodes, setEpisodes] =
    useState<AdminEpisodeRecord[]>(initialEpisodes);
  const [auditEntries, setAuditEntries] =
    useState<AuditLedgerEntry[]>(initialAuditEntries);
  const [audioCacheBuster, setAudioCacheBuster] = useState<number>(Date.now());

  // List filtering & expansion state
  const [searchQuery, setSearchQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState<
    "all" | "weekly_rollup" | "legacy_archive"
  >("all");
  const [expandedTranscripts, setExpandedTranscripts] = useState<
    Record<number, boolean>
  >({});

  // Generate New Episode Studio state
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [useCustomEpNumber, setUseCustomEpNumber] = useState(false);
  const [customEpNumber, setCustomEpNumber] = useState<number>(() => {
    const maxEp = initialEpisodes.reduce(
      (max, ep) => Math.max(max, ep.episodeNumber || 0),
      42
    );
    return maxEp + 1;
  });
  const [genWindowDays, setGenWindowDays] = useState<number>(7);
  const [genTitleOverride, setGenTitleOverride] = useState("");
  const [genSummaryOverride, setGenSummaryOverride] = useState("");
  const [genFocusNote, setGenFocusNote] = useState("");
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<number[]>([]);
  const [selectedTtsIdx, setSelectedTtsIdx] = useState<number>(0);
  const [genReason, setGenReason] = useState("");
  const [submittingGenerate, setSubmittingGenerate] = useState(false);

  // Edit Episode Drawer / Modal state
  const [editingEpisode, setEditingEpisode] =
    useState<AdminEpisodeRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editEpisodeNumber, setEditEpisodeNumber] = useState<number>(43);
  const [editPublishedAt, setEditPublishedAt] = useState("");
  const [editMode, setEditMode] = useState<"sections" | "raw">("sections");
  const [editPart1, setEditPart1] = useState("");
  const [editPart2, setEditPart2] = useState("");
  const [editPart3, setEditPart3] = useState("");
  const [editRawTranscript, setEditRawTranscript] = useState("");
  const [editRegenerateAudio, setEditRegenerateAudio] = useState(false);
  const [editTtsIdx, setEditTtsIdx] = useState<number>(0);
  const [editReason, setEditReason] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Episode Confirmation Modal state
  const [deletingEpisode, setDeletingEpisode] =
    useState<AdminEpisodeRecord | null>(null);
  const [deletePurgeAudio, setDeletePurgeAudio] = useState(true);
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Restore deleted episode from audit_ledger state
  const [restoringEventId, setRestoringEventId] = useState<string | null>(null);

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

  const nextAutoEpisodeNumber = useMemo(() => {
    const maxEp = episodes.reduce(
      (max, ep) => Math.max(max, ep.episodeNumber || 0),
      42
    );
    return maxEp + 1;
  }, [episodes]);

  const filteredEpisodes = useMemo(() => {
    return episodes.filter((ep) => {
      if (seriesFilter !== "all" && ep.series !== seriesFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ep.title.toLowerCase().includes(q) ||
        ep.slug.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.transcript.toLowerCase().includes(q) ||
        String(ep.episodeNumber).includes(q) ||
        ep.r2Key.toLowerCase().includes(q)
      );
    });
  }, [episodes, seriesFilter, searchQuery]);

  const totalStorageBytes = useMemo(
    () => episodes.reduce((acc, ep) => acc + (ep.fileSizeBytes || 0), 0),
    [episodes]
  );

  async function refreshEpisodesAndAudit() {
    try {
      const [epRes, auditRes] = await Promise.all([
        fetch("/api/admin/episodes", { cache: "no-store" }),
        fetch("/api/admin/audit?targetType=episode&limit=25", {
          cache: "no-store",
        }),
      ]);
      if (epRes.ok) {
        const epData = (await epRes.json()) as {
          episodes?: AdminEpisodeRecord[];
        };
        if (Array.isArray(epData.episodes)) {
          setEpisodes(epData.episodes);
        }
      }
      if (auditRes.ok) {
        const auditData = (await auditRes.json()) as {
          entries?: AuditLedgerEntry[];
        };
        if (Array.isArray(auditData.entries)) {
          setAuditEntries(auditData.entries);
        }
      }
      setAudioCacheBuster(Date.now());
    } catch {
      // ignore
    }
    router.refresh();
  }

  function toggleIncidentSelection(id: number) {
    setSelectedIncidentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleGenerateEpisode(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;

    setSubmittingGenerate(true);
    setBanner(null);

    const ttsSpec = TTS_VOICE_OPTIONS[selectedTtsIdx] || TTS_VOICE_OPTIONS[0];

    try {
      const res = await fetch("/api/admin/episodes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeNumber: useCustomEpNumber ? customEpNumber : undefined,
          titleOverride: genTitleOverride.trim() || undefined,
          summaryOverride: genSummaryOverride.trim() || undefined,
          editorialFocusNote: genFocusNote.trim() || undefined,
          windowDays: genWindowDays,
          incidentIds:
            selectedIncidentIds.length > 0 ? selectedIncidentIds : undefined,
          ttsVoice: ttsSpec.voice,
          ttsProvider: ttsSpec.provider,
          reason:
            genReason.trim() ||
            `On-demand generation of Episode #${
              useCustomEpNumber ? customEpNumber : nextAutoEpisodeNumber
            } from Admin Episode Studio (${genWindowDays}-day window${
              selectedIncidentIds.length > 0
                ? `, ${selectedIncidentIds.length} hand-picked incidents`
                : ""
            })`,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        episode?: AdminEpisodeRecord;
        episodes?: AdminEpisodeRecord[];
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok || !data.episode) {
        setBanner({
          type: "error",
          title: "Episode Generation Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.episodes)) {
          setEpisodes(data.episodes);
        } else {
          setEpisodes((prev) => [
            data.episode!,
            ...prev.filter((item) => item.id !== data.episode!.id),
          ]);
        }
        setExpandedTranscripts((prev) => ({
          ...prev,
          [data.episode!.id]: true,
        }));
        setShowGeneratePanel(false);
        setGenTitleOverride("");
        setGenSummaryOverride("");
        setGenFocusNote("");
        setSelectedIncidentIds([]);
        setGenReason("");
        setBanner({
          type: "success",
          title: `Episode #${data.episode.episodeNumber} Published & Audited`,
          detail: `"${data.episode.title}" (${data.episode.r2Key}, ${formatBytes(
            data.episode.fileSizeBytes
          )}) is now live on /archive and /feed.xml. Audit hash: ${
            data.auditEntry?.entryHash.slice(0, 12) || "verified"
          }…`,
        });
        await refreshEpisodesAndAudit();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Episode Generation Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingGenerate(false);
    }
  }

  function openEditModal(ep: AdminEpisodeRecord) {
    setEditingEpisode(ep);
    setEditTitle(ep.title);
    setEditSummary(ep.summary);
    setEditEpisodeNumber(ep.episodeNumber);
    setEditPublishedAt(ep.publishedAt);
    const hasThreeParts = Boolean(
      ep.transcriptSections.separatingSignalFromPanic ||
        ep.transcriptSections.forwardPosture
    );
    setEditMode(hasThreeParts ? "sections" : "raw");
    setEditPart1(ep.transcriptSections.weeklyTelemetry || "");
    setEditPart2(ep.transcriptSections.separatingSignalFromPanic || "");
    setEditPart3(ep.transcriptSections.forwardPosture || "");
    setEditRawTranscript(ep.transcript || "");
    setEditRegenerateAudio(false);
    setEditTtsIdx(0);
    setEditReason("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEpisode || !canMutate) return;

    setSubmittingEdit(true);
    setBanner(null);

    const ttsSpec = TTS_VOICE_OPTIONS[editTtsIdx] || TTS_VOICE_OPTIONS[0];

    try {
      const payload: Record<string, unknown> = {
        title: editTitle.trim(),
        summary: editSummary.trim(),
        episodeNumber: editEpisodeNumber,
        publishedAt: editPublishedAt.trim(),
        regenerateAudio: editRegenerateAudio,
        ttsVoice: ttsSpec.voice,
        ttsProvider: ttsSpec.provider,
        reason:
          editReason.trim() ||
          `Updated Episode #${editEpisodeNumber} metadata/transcript in Admin Episode Studio${
            editRegenerateAudio ? " and regenerated R2 MP3 audio" : ""
          }`,
      };

      if (editMode === "sections") {
        payload.transcriptSections = {
          weeklyTelemetry: editPart1,
          separatingSignalFromPanic: editPart2,
          forwardPosture: editPart3,
        };
      } else {
        payload.transcript = editRawTranscript;
      }

      const res = await fetch(
        `/api/admin/episodes/${encodeURIComponent(String(editingEpisode.id))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        episode?: AdminEpisodeRecord;
        audioRegenerated?: boolean;
        episodes?: AdminEpisodeRecord[];
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok || !data.episode) {
        setBanner({
          type: "error",
          title: "Failed to Update Episode",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        if (Array.isArray(data.episodes)) {
          setEpisodes(data.episodes);
        } else {
          setEpisodes((prev) =>
            prev.map((item) =>
              item.id === data.episode!.id ? data.episode! : item
            )
          );
        }
        setEditingEpisode(null);
        setBanner({
          type: "success",
          title: `Episode #${data.episode.episodeNumber} Updated & Audited`,
          detail: `Saved changes to "${data.episode.title}"${
            data.audioRegenerated
              ? ` and overwrote R2 object ${data.episode.r2Key}`
              : ""
          }. Audit hash: ${
            data.auditEntry?.entryHash.slice(0, 12) || "verified"
          }…`,
        });
        await refreshEpisodesAndAudit();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Episode Update Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingEdit(false);
    }
  }

  function openDeleteModal(ep: AdminEpisodeRecord) {
    setDeletingEpisode(ep);
    setDeletePurgeAudio(true);
    setDeleteReason("");
  }

  async function handleConfirmDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deletingEpisode || !canMutate) return;

    const finalReason = deleteReason.trim();
    if (!finalReason) {
      setBanner({
        type: "error",
        title: "Audit Reason Required",
        detail:
          "Please provide an editorial/administrative reason for deleting this episode so it can be recorded in audit_ledger.",
      });
      return;
    }

    setSubmittingDelete(true);
    setBanner(null);

    try {
      const res = await fetch(
        `/api/admin/episodes/${encodeURIComponent(String(deletingEpisode.id))}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: deletingEpisode.id,
            purgeAudio: deletePurgeAudio,
            reason: finalReason,
          }),
        }
      );

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        deletedId?: number;
        deletedSlug?: string;
        deletedEpisodeNumber?: number;
        r2Key?: string;
        audioPurged?: boolean;
        episodes?: AdminEpisodeRecord[];
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Delete Episode",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        const removedEp = deletingEpisode;
        if (Array.isArray(data.episodes)) {
          setEpisodes(data.episodes);
        } else {
          setEpisodes((prev) =>
            prev.filter((item) => item.id !== removedEp.id)
          );
        }
        setDeletingEpisode(null);
        setDeleteReason("");
        setBanner({
          type: "success",
          title: `Episode #${removedEp.episodeNumber} Deleted & Audited`,
          detail: `Removed "${removedEp.title}" from D1 (/archive & /feed.xml updated immediately)${
            data.audioPurged ? ` and purged R2 object ${removedEp.r2Key}` : ""
          }. Full snapshot saved in audit_ledger (${
            data.auditEntry?.entryHash.slice(0, 12) || "verified"
          }…) for 1-click recovery.`,
        });
        await refreshEpisodesAndAudit();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Delete Episode Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingDelete(false);
    }
  }

  async function handleRestoreDeletedEpisode(entry: AuditLedgerEntry) {
    if (!canMutate) return;
    setRestoringEventId(entry.eventId);
    setBanner(null);

    try {
      const res = await fetch("/api/admin/audit/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: entry.eventId,
          mode: "revert_to_before",
          reason: `1-click restoration of deleted episode from audit_ledger event ${entry.eventId.slice(
            0,
            8
          )} in Admin Episode Studio`,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        restoredState?: Record<string, unknown> | null;
        auditEntry?: AuditLedgerEntry;
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Episode Restore Failed",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        const restoredTitle = String(
          data.restoredState?.title || `Episode (${entry.targetId})`
        );
        setBanner({
          type: "success",
          title: "Deleted Episode Restored from Immutable Audit Ledger",
          detail: `Restored "${restoredTitle}" to D1 and R2 audio bucket. Recorded audit.replay (${
            data.auditEntry?.entryHash.slice(0, 12) || "verified"
          }…).`,
        });
        await refreshEpisodesAndAudit();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Restore Episode Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRestoringEventId(null);
    }
  }

  const weeklyRollupCount = episodes.filter(
    (e) => e.series === "weekly_rollup"
  ).length;
  const legacyArchiveCount = episodes.filter(
    (e) => e.series === "legacy_archive"
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Studio Title & Quick Actions Banner */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-[#C5A059] font-semibold">
                EPIC 6.4 // PODCAST EPISODE &amp; R2 AUDIO ADMIN STUDIO
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 font-mono text-[11px] text-emerald-300">
                D1 episodes + R2 cabcall-audio
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F3EFE6] tracking-tight">
              Podcast Episode Lifecycle &amp; R2 Audio Studio
            </h1>
            <p className="text-sm text-[#9CA3AF] max-w-3xl">
              Generate on-demand 5-minute Friday CAB Weekly Brief rollups, edit
              3-part transcripts and re-synthesize R2 MP3 audio, or delete
              episodes and purge R2 objects—with every mutation cryptographically
              recorded in <code className="text-[#C5A059]">audit_ledger</code>{" "}
              for 1-click restoration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://thecabcall.com/archive"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded border border-[#263147] hover:border-[#C5A059] bg-[#0B0E14] text-xs font-mono text-[#D6D1C7] transition-colors"
            >
              Public /archive ↗
            </a>
            <a
              href="https://thecabcall.com/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded border border-[#263147] hover:border-[#C5A059] bg-[#0B0E14] text-xs font-mono text-[#D6D1C7] transition-colors"
            >
              Live /feed.xml ↗
            </a>
            {canMutate && (
              <button
                type="button"
                onClick={() => setShowGeneratePanel((prev) => !prev)}
                className="px-4 py-2 rounded bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {showGeneratePanel
                  ? "Close Generator Studio"
                  : "+ Generate New Episode"}
              </button>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#1E2738]">
          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3.5">
            <div className="font-mono text-[11px] uppercase text-[#8E9BAE]">
              Total Live D1 Episodes
            </div>
            <div className="text-2xl font-bold font-mono text-[#F3EFE6] mt-1">
              {episodes.length}
            </div>
            <div className="text-[11px] font-mono text-[#8E9BAE] mt-0.5">
              Synced to /archive &amp; /feed.xml
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3.5">
            <div className="font-mono text-[11px] uppercase text-[#8E9BAE]">
              Friday 5-Min Rollups
            </div>
            <div className="text-2xl font-bold font-mono text-[#C5A059] mt-1">
              {weeklyRollupCount}
            </div>
            <div className="text-[11px] font-mono text-[#8E9BAE] mt-0.5">
              Next auto episode: #{nextAutoEpisodeNumber}
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3.5">
            <div className="font-mono text-[11px] uppercase text-[#8E9BAE]">
              Legacy Archive Episodes
            </div>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
              {legacyArchiveCount}
            </div>
            <div className="text-[11px] font-mono text-[#8E9BAE] mt-0.5">
              Deep-dive catalog in D1
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3.5">
            <div className="font-mono text-[11px] uppercase text-[#8E9BAE]">
              R2 Audio Footprint
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {formatBytes(totalStorageBytes)}
            </div>
            <div className="text-[11px] font-mono text-[#8E9BAE] mt-0.5">
              Bucket: cabcall-audio
            </div>
          </div>
        </div>
      </div>

      {/* Status Notification Banner */}
      {banner && (
        <div
          className={`rounded-lg border p-4 flex items-start justify-between gap-4 ${
            banner.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-100"
              : "bg-red-950/60 border-red-500/50 text-red-100"
          }`}
        >
          <div className="space-y-1">
            <div className="font-mono text-xs uppercase font-bold tracking-wider">
              {banner.type === "success" ? "✓ AUDIT & D1 SYNC COMPLETE" : "▲ OPERATION ERROR"} —{" "}
              {banner.title}
            </div>
            <div className="text-xs font-mono opacity-90">{banner.detail}</div>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs font-mono underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Generate New Episode Studio Panel */}
      {showGeneratePanel && canMutate && (
        <div className="bg-[#111622] border-2 border-[#C5A059] rounded-lg p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#263147] pb-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#C5A059] font-semibold">
                ON-DEMAND SYSTEM-2 ROLLUP &amp; R2 AUDIO GENERATOR
              </span>
              <h2 className="text-xl font-bold text-[#F3EFE6] mt-0.5">
                Generate &amp; Publish New Podcast Episode
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowGeneratePanel(false)}
              className="px-3 py-1 rounded border border-[#263147] text-xs font-mono text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleGenerateEpisode} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Episode Number */}
              <div className="bg-[#0B0E14] border border-[#263147] rounded p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs text-[#D6D1C7] font-semibold">
                    Episode Number
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#C5A059] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomEpNumber}
                      onChange={(e) => {
                        setUseCustomEpNumber(e.target.checked);
                        if (e.target.checked) {
                          setCustomEpNumber(nextAutoEpisodeNumber);
                        }
                      }}
                    />
                    <span>Custom #</span>
                  </label>
                </div>
                {useCustomEpNumber ? (
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={customEpNumber}
                    onChange={(e) =>
                      setCustomEpNumber(parseInt(e.target.value, 10) || 43)
                    }
                    className="w-full bg-[#111622] border border-[#3A4A6B] rounded px-3 py-1.5 text-sm font-mono text-[#F3EFE6]"
                  />
                ) : (
                  <div className="px-3 py-1.5 rounded bg-[#111622] border border-[#1E2738] font-mono text-sm text-[#C5A059] font-bold">
                    Auto-Increment (#{nextAutoEpisodeNumber})
                  </div>
                )}
              </div>

              {/* Telemetry Window */}
              <div className="bg-[#0B0E14] border border-[#263147] rounded p-3.5 space-y-2">
                <label className="block font-mono text-xs text-[#D6D1C7] font-semibold">
                  Telemetry Aggregation Window
                </label>
                <select
                  value={genWindowDays}
                  onChange={(e) =>
                    setGenWindowDays(parseInt(e.target.value, 10) || 7)
                  }
                  className="w-full bg-[#111622] border border-[#3A4A6B] rounded px-3 py-1.5 text-sm font-mono text-[#F3EFE6]"
                >
                  <option value={7}>Past 7 Days (Standard Weekly Rollup)</option>
                  <option value={14}>Past 14 Days (Bi-Weekly Window)</option>
                  <option value={30}>Past 30 Days (Monthly Posture Window)</option>
                </select>
              </div>

              {/* TTS Voice / Provider */}
              <div className="bg-[#0B0E14] border border-[#263147] rounded p-3.5 space-y-2">
                <label className="block font-mono text-xs text-[#D6D1C7] font-semibold">
                  TTS Voice &amp; Audio Engine
                </label>
                <select
                  value={selectedTtsIdx}
                  onChange={(e) =>
                    setSelectedTtsIdx(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full bg-[#111622] border border-[#3A4A6B] rounded px-3 py-1.5 text-sm font-mono text-[#F3EFE6]"
                >
                  {TTS_VOICE_OPTIONS.map((opt, idx) => (
                    <option key={opt.label} value={idx}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title Override & Producer Focus Note */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-xs text-[#D6D1C7]">
                  Custom Episode Title Override{" "}
                  <span className="text-[#8E9BAE]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={genTitleOverride}
                  onChange={(e) => setGenTitleOverride(e.target.value)}
                  placeholder="Leave blank to let Gemini 2.5 Flash title from dominant tool & failure mode"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs text-[#D6D1C7]">
                  Custom Show Notes Summary Override{" "}
                  <span className="text-[#8E9BAE]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={genSummaryOverride}
                  onChange={(e) => setGenSummaryOverride(e.target.value)}
                  placeholder="Leave blank to auto-generate 2-sentence show notes summary"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-mono text-xs text-[#D6D1C7]">
                Producer / Editorial Focus Directive{" "}
                <span className="text-[#8E9BAE]">
                  (optional — injected into System-2 rollup synthesis)
                </span>
              </label>
              <textarea
                rows={2}
                value={genFocusNote}
                onChange={(e) => setGenFocusNote(e.target.value)}
                placeholder="e.g., Emphasize the cross-sector pattern between municipal utility configuration drift and federal aviation failover gaps."
                className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
              />
            </div>

            {/* Hand-Pick Synthesized Incidents */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-mono text-xs text-[#D6D1C7] font-semibold">
                  Featured Incidents Selection{" "}
                  <span className="text-[#8E9BAE] font-normal">
                    (
                    {selectedIncidentIds.length === 0
                      ? "Auto-selecting top 5 systemic incidents in window"
                      : `${selectedIncidentIds.length} hand-picked incident(s) selected`}
                    )
                  </span>
                </label>
                {selectedIncidentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIncidentIds([])}
                    className="text-[11px] font-mono text-[#C5A059] underline cursor-pointer"
                  >
                    Reset to Auto Top 5
                  </button>
                )}
              </div>

              <div className="max-h-52 overflow-y-auto bg-[#0B0E14] border border-[#263147] rounded divide-y divide-[#1E2738]">
                {candidateIncidents.length === 0 ? (
                  <div className="p-3 text-xs font-mono text-[#8E9BAE]">
                    No synthesized/triaged incidents found in D1. Pipeline will
                    use deterministic telemetry fallback.
                  </div>
                ) : (
                  candidateIncidents.slice(0, 20).map((inc) => {
                    const checked = selectedIncidentIds.includes(inc.id);
                    return (
                      <label
                        key={inc.id}
                        className={`flex items-start gap-3 p-2.5 text-xs font-mono cursor-pointer transition-colors ${
                          checked
                            ? "bg-[#C5A059]/10 text-[#F3EFE6]"
                            : "hover:bg-[#111622] text-[#D6D1C7]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleIncidentSelection(inc.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[#C5A059] font-semibold">
                              #{inc.id}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-[#182032] text-[10px] text-[#9CA3AF]">
                              {inc.source_feed}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-300">
                              {Math.round(inc.is_systemic_prob * 100)}% systemic
                            </span>
                            <span className="text-[10px] text-[#8E9BAE]">
                              Tool: {inc.primary_tool} • Failure:{" "}
                              {inc.sre_failure_mode}
                            </span>
                          </div>
                          <div className="truncate mt-0.5 text-[#F3EFE6]">
                            {inc.title}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Audit Reason & Submit */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4 pt-2 border-t border-[#263147]">
              <div className="flex-1 space-y-1">
                <label className="block font-mono text-xs text-[#D6D1C7]">
                  Audit Ledger Disclosure Reason{" "}
                  <span className="text-[#8E9BAE]">(logged in episode.generate)</span>
                </label>
                <input
                  type="text"
                  value={genReason}
                  onChange={(e) => setGenReason(e.target.value)}
                  placeholder="e.g., Generated Friday 5-Minute CAB Weekly Brief rollup for publication"
                  className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <button
                type="submit"
                disabled={submittingGenerate}
                className="px-6 py-2.5 rounded bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              >
                {submittingGenerate
                  ? "Synthesizing Script & R2 MP3..."
                  : "Generate & Publish Episode"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111622] border border-[#263147] rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setSeriesFilter("all")}
            className={`px-3 py-1.5 rounded border cursor-pointer ${
              seriesFilter === "all"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#0B0E14] text-[#9CA3AF] border-[#263147] hover:text-[#F3EFE6]"
            }`}
          >
            All ({episodes.length})
          </button>
          <button
            type="button"
            onClick={() => setSeriesFilter("weekly_rollup")}
            className={`px-3 py-1.5 rounded border cursor-pointer ${
              seriesFilter === "weekly_rollup"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#0B0E14] text-[#9CA3AF] border-[#263147] hover:text-[#F3EFE6]"
            }`}
          >
            Weekly 5-Min Rollups ({weeklyRollupCount})
          </button>
          <button
            type="button"
            onClick={() => setSeriesFilter("legacy_archive")}
            className={`px-3 py-1.5 rounded border cursor-pointer ${
              seriesFilter === "legacy_archive"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#0B0E14] text-[#9CA3AF] border-[#263147] hover:text-[#F3EFE6]"
            }`}
          >
            Legacy Archive ({legacyArchiveCount})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by episode #, title, slug, R2 key, or transcript..."
            className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-1.5 text-xs font-mono text-[#F3EFE6]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs font-mono text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Live D1 Episodes List */}
      <div className="space-y-4">
        {filteredEpisodes.length === 0 ? (
          <div className="bg-[#111622] border border-[#263147] rounded-lg p-8 text-center font-mono text-sm text-[#8E9BAE]">
            No episodes match the current filter.
          </div>
        ) : (
          filteredEpisodes.map((ep) => {
            const isExpanded = Boolean(expandedTranscripts[ep.id]);
            const wordCount = countWords(ep.transcript);
            const audioSrc = `${ep.audioUrl}${
              ep.audioUrl.includes("?") ? "&" : "?"
            }v=${audioCacheBuster}`;

            return (
              <div
                key={ep.id}
                className="bg-[#111622] border border-[#263147] hover:border-[#3A4A6B] rounded-lg p-5 space-y-4 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className="px-2.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059] text-[#E5C178] font-bold">
                        EPISODE #{ep.episodeNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] uppercase font-semibold ${
                          ep.series === "weekly_rollup"
                            ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                            : "bg-sky-950/60 border-sky-500/40 text-sky-300"
                        }`}
                      >
                        {ep.series === "weekly_rollup"
                          ? "5-Min Weekly Brief"
                          : "Legacy Deep-Dive"}
                      </span>
                      <span className="text-[#8E9BAE]">
                        D1 ID: <code className="text-[#D6D1C7]">{ep.id}</code>
                      </span>
                      <span className="text-[#8E9BAE]">•</span>
                      <span className="text-[#8E9BAE]">
                        Published:{" "}
                        <code className="text-[#D6D1C7]">
                          {ep.publishedAt.slice(0, 19).replace("T", " ")} UTC
                        </code>
                      </span>
                      <span className="text-[#8E9BAE]">•</span>
                      <span className="text-[#8E9BAE]">
                        Duration:{" "}
                        <code className="text-[#D6D1C7]">
                          {ep.durationFormatted} ({ep.durationSeconds}s)
                        </code>
                      </span>
                      <span className="text-[#8E9BAE]">•</span>
                      <span className="text-[#8E9BAE]">
                        Size:{" "}
                        <code className="text-emerald-300">
                          {formatBytes(ep.fileSizeBytes)}
                        </code>
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#F3EFE6] leading-snug">
                      {ep.title}
                    </h3>

                    <p className="text-xs text-[#9CA3AF] leading-relaxed">
                      {ep.summary}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-[11px] text-[#8E9BAE]">
                      <span>
                        Slug: <code className="text-[#D6D1C7]">{ep.slug}</code>
                      </span>
                      <span>•</span>
                      <span>
                        R2 Key:{" "}
                        <code className="text-[#C5A059]">{ep.r2Key}</code>
                      </span>
                      <span>•</span>
                      <span>
                        Transcript:{" "}
                        <code className="text-[#D6D1C7]">{wordCount} words</code>
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTranscripts((prev) => ({
                          ...prev,
                          [ep.id]: !prev[ep.id],
                        }))
                      }
                      className="px-3 py-1.5 rounded border border-[#263147] hover:border-[#C5A059] bg-[#0B0E14] text-xs font-mono text-[#D6D1C7] cursor-pointer"
                    >
                      {isExpanded ? "Hide Transcript ▲" : "Inspect Transcript ▼"}
                    </button>

                    {canMutate && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(ep)}
                          className="px-3 py-1.5 rounded border border-[#C5A059]/60 hover:border-[#C5A059] bg-[#C5A059]/10 text-xs font-mono text-[#E5C178] font-semibold cursor-pointer"
                        >
                          Edit Episode &amp; Transcript
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(ep)}
                          className="px-3 py-1.5 rounded border border-red-500/50 hover:border-red-400 bg-red-950/40 hover:bg-red-900/50 text-xs font-mono text-red-200 font-semibold cursor-pointer"
                        >
                          Delete Episode
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline MP3 Audio Preview Bar */}
                <div className="bg-[#0B0E14] border border-[#1E2738] rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#D6D1C7]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="uppercase text-[11px] text-[#C5A059] font-semibold">
                      Inline R2 Audio Preview:
                    </span>
                    <code className="text-[11px] text-[#8E9BAE]">
                      {ep.audioUrl}
                    </code>
                  </div>

                  <div className="flex items-center gap-3 flex-1 sm:max-w-md justify-end">
                    <audio
                      controls
                      preload="none"
                      src={audioSrc}
                      className="h-8 w-full max-w-xs"
                    />
                    <a
                      href={ep.audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded border border-[#263147] hover:border-[#C5A059] font-mono text-[11px] text-[#9CA3AF] hover:text-[#F3EFE6] shrink-0"
                    >
                      Raw MP3 ↗
                    </a>
                  </div>
                </div>

                {/* Expandable 3-Part Transcript Drawer */}
                {isExpanded && (
                  <div className="bg-[#0B0E14] border border-[#263147] rounded p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#1E2738] pb-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-[#C5A059] font-semibold">
                        Full Episode Transcript ({wordCount} words)
                      </span>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => openEditModal(ep)}
                          className="text-xs font-mono text-[#C5A059] underline cursor-pointer"
                        >
                          Open in 3-Part Editor →
                        </button>
                      )}
                    </div>

                    {ep.transcriptSections.separatingSignalFromPanic ||
                    ep.transcriptSections.forwardPosture ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                        <div className="bg-[#111622] border border-[#1E2738] rounded p-3 space-y-1.5">
                          <div className="font-mono text-[11px] text-[#C5A059] font-bold">
                            [00:00 — THE WEEKLY TELEMETRY] (
                            {countWords(ep.transcriptSections.weeklyTelemetry)}{" "}
                            w)
                          </div>
                          <p className="text-[#D6D1C7] leading-relaxed whitespace-pre-wrap">
                            {ep.transcriptSections.weeklyTelemetry}
                          </p>
                        </div>

                        <div className="bg-[#111622] border border-[#1E2738] rounded p-3 space-y-1.5">
                          <div className="font-mono text-[11px] text-[#C5A059] font-bold">
                            [01:15 — SEPARATING SIGNAL FROM PANIC] (
                            {countWords(
                              ep.transcriptSections.separatingSignalFromPanic
                            )}{" "}
                            w)
                          </div>
                          <p className="text-[#D6D1C7] leading-relaxed whitespace-pre-wrap">
                            {ep.transcriptSections.separatingSignalFromPanic}
                          </p>
                        </div>

                        <div className="bg-[#111622] border border-[#1E2738] rounded p-3 space-y-1.5">
                          <div className="font-mono text-[11px] text-[#C5A059] font-bold">
                            [03:30 — THE FORWARD POSTURE] (
                            {countWords(ep.transcriptSections.forwardPosture)}{" "}
                            w)
                          </div>
                          <p className="text-[#D6D1C7] leading-relaxed whitespace-pre-wrap">
                            {ep.transcriptSections.forwardPosture}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-xs font-mono text-[#D6D1C7] whitespace-pre-wrap leading-relaxed">
                        {ep.transcript}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Episode & Transcript Modal / Drawer */}
      {editingEpisode && canMutate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111622] border-2 border-[#C5A059] rounded-lg max-w-4xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#263147] pb-3">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-[#C5A059] font-semibold">
                  EDIT EPISODE &amp; 3-PART TRANSCRIPT STUDIO
                </span>
                <h2 className="text-xl font-bold text-[#F3EFE6]">
                  Editing Episode #{editingEpisode.episodeNumber} (D1 ID:{" "}
                  {editingEpisode.id})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingEpisode(null)}
                className="px-3 py-1 rounded border border-[#263147] text-xs font-mono text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
              >
                ✕ Cancel
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Episode #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editEpisodeNumber}
                    onChange={(e) =>
                      setEditEpisodeNumber(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Episode Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Show Notes Summary
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Published Timestamp (ISO-8601)
                  </label>
                  <input
                    type="text"
                    value={editPublishedAt}
                    onChange={(e) => setEditPublishedAt(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                  <div className="text-[10px] font-mono text-[#8E9BAE] mt-1">
                    R2 Key: <code className="text-[#C5A059]">{editingEpisode.r2Key}</code>
                  </div>
                </div>
              </div>

              {/* Transcript Editor Mode Toggle */}
              <div className="space-y-3 pt-2 border-t border-[#263147]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#F3EFE6]">
                    Transcript Editor
                  </span>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setEditMode("sections")}
                      className={`px-3 py-1 rounded border cursor-pointer ${
                        editMode === "sections"
                          ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                          : "bg-[#0B0E14] text-[#9CA3AF] border-[#263147]"
                      }`}
                    >
                      3-Part Structured ([00:00] / [01:15] / [03:30])
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode("raw")}
                      className={`px-3 py-1 rounded border cursor-pointer ${
                        editMode === "raw"
                          ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                          : "bg-[#0B0E14] text-[#9CA3AF] border-[#263147]"
                      }`}
                    >
                      Raw Full Transcript
                    </button>
                  </div>
                </div>

                {editMode === "sections" ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between font-mono text-[11px] mb-1">
                        <span className="text-[#C5A059] font-bold">
                          Part 1: [00:00 — THE WEEKLY TELEMETRY]
                        </span>
                        <span className="text-[#8E9BAE]">
                          {countWords(editPart1)} words (target ~180w)
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={editPart1}
                        onChange={(e) => setEditPart1(e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#263147] rounded p-3 text-xs font-mono text-[#F3EFE6] leading-relaxed"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-mono text-[11px] mb-1">
                        <span className="text-[#C5A059] font-bold">
                          Part 2: [01:15 — SEPARATING SIGNAL FROM PANIC]
                        </span>
                        <span className="text-[#8E9BAE]">
                          {countWords(editPart2)} words (target ~350w)
                        </span>
                      </div>
                      <textarea
                        rows={6}
                        value={editPart2}
                        onChange={(e) => setEditPart2(e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#263147] rounded p-3 text-xs font-mono text-[#F3EFE6] leading-relaxed"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-mono text-[11px] mb-1">
                        <span className="text-[#C5A059] font-bold">
                          Part 3: [03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]
                        </span>
                        <span className="text-[#8E9BAE]">
                          {countWords(editPart3)} words (target ~220w)
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={editPart3}
                        onChange={(e) => setEditPart3(e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#263147] rounded p-3 text-xs font-mono text-[#F3EFE6] leading-relaxed"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between font-mono text-[11px] mb-1">
                      <span className="text-[#C5A059] font-bold">
                        Full Raw Transcript
                      </span>
                      <span className="text-[#8E9BAE]">
                        {countWords(editRawTranscript)} words
                      </span>
                    </div>
                    <textarea
                      rows={12}
                      value={editRawTranscript}
                      onChange={(e) => setEditRawTranscript(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#263147] rounded p-3 text-xs font-mono text-[#F3EFE6] leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* R2 Audio Re-Synthesis Option */}
              <div className="bg-[#0B0E14] border border-[#263147] rounded p-3.5 space-y-3">
                <label className="flex items-center gap-2.5 font-mono text-xs text-[#F3EFE6] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRegenerateAudio}
                    onChange={(e) => setEditRegenerateAudio(e.target.checked)}
                  />
                  <span className="font-semibold text-[#C5A059]">
                    Re-synthesize &amp; overwrite R2 MP3 audio ({editingEpisode.r2Key})
                    from edited transcript
                  </span>
                </label>

                {editRegenerateAudio && (
                  <div className="pl-6">
                    <label className="block font-mono text-[11px] text-[#8E9BAE] mb-1">
                      Select TTS Voice / Audio Generator
                    </label>
                    <select
                      value={editTtsIdx}
                      onChange={(e) =>
                        setEditTtsIdx(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full sm:w-96 bg-[#111622] border border-[#3A4A6B] rounded px-3 py-1.5 text-xs font-mono text-[#F3EFE6]"
                    >
                      {TTS_VOICE_OPTIONS.map((opt, idx) => (
                        <option key={opt.label} value={idx}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Audit Reason & Save */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4 pt-2 border-t border-[#263147]">
                <div className="flex-1">
                  <label className="block font-mono text-xs text-[#D6D1C7] mb-1">
                    Audit Disclosure Reason (logged in <code>episode.update</code>)
                  </label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g., Refined Proportionality Check section in transcript and re-synthesized MP3"
                    className="w-full bg-[#0B0E14] border border-[#263147] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingEpisode(null)}
                    className="px-4 py-2 rounded border border-[#263147] font-mono text-xs text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="px-5 py-2 rounded bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    {submittingEdit
                      ? editRegenerateAudio
                        ? "Re-Synthesizing & Saving..."
                        : "Saving Changes..."
                      : "Save Episode & Log Audit"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Episode & Purge R2 Audio Confirmation Modal */}
      {deletingEpisode && canMutate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111622] border-2 border-red-500/70 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#263147] pb-3">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-red-400 font-bold">
                  CONFIRM EPISODE DELETION &amp; R2 AUDIO PURGE
                </span>
                <h2 className="text-lg font-bold text-[#F3EFE6] mt-0.5">
                  Delete Episode #{deletingEpisode.episodeNumber}?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeletingEpisode(null)}
                className="px-2.5 py-1 rounded border border-[#263147] text-xs font-mono text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#0B0E14] border border-[#263147] rounded p-3.5 space-y-1.5 font-mono text-xs">
              <div className="text-[#F3EFE6] font-bold">
                {deletingEpisode.title}
              </div>
              <div className="text-[#8E9BAE]">
                D1 ID: <span className="text-[#D6D1C7]">{deletingEpisode.id}</span> •
                Slug: <span className="text-[#D6D1C7]">{deletingEpisode.slug}</span>
              </div>
              <div className="text-[#8E9BAE]">
                R2 Object Key:{" "}
                <span className="text-[#C5A059]">{deletingEpisode.r2Key}</span> (
                {formatBytes(deletingEpisode.fileSizeBytes)})
              </div>
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <label className="flex items-start gap-2.5 bg-red-950/30 border border-red-500/30 rounded p-3 font-mono text-xs text-red-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deletePurgeAudio}
                  onChange={(e) => setDeletePurgeAudio(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold">
                    Also purge <code>{deletingEpisode.r2Key}</code> from Cloudflare
                    R2 (<code>cabcall-audio</code>)
                  </div>
                  <div className="text-[11px] text-red-200/80 mt-0.5">
                    Removes the binary MP3 object from R2 storage and immediately
                    updates <code>/archive</code> and <code>/feed.xml</code>.
                  </div>
                </div>
              </label>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs text-[#D6D1C7] font-semibold">
                  Mandatory Audit Disclosure Reason (logged in{" "}
                  <code>episode.delete</code>)
                </label>
                <input
                  type="text"
                  required
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder='e.g., Superseded by re-recorded Episode #44'
                  className="w-full bg-[#0B0E14] border border-[#3A4A6B] rounded px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    `Superseded by re-recorded Episode #${deletingEpisode.episodeNumber}`,
                    "Admin verification test episode cleanup",
                    "Editorial transcript revision & audio replacement",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDeleteReason(preset)}
                      className="px-2 py-0.5 rounded bg-[#0B0E14] border border-[#263147] hover:border-[#C5A059] font-mono text-[10px] text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded p-3 font-mono text-[11px] text-emerald-200">
                <strong>Immutable Recovery Guarantee:</strong> The complete
                episode record (including full transcript, summary, and metadata)
                is preserved in <code>audit_ledger.before_state_json</code> and
                can be restored in 1 click at any time.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#263147]">
                <button
                  type="button"
                  onClick={() => setDeletingEpisode(null)}
                  className="px-4 py-2 rounded border border-[#263147] font-mono text-xs text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelete}
                  className="px-5 py-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {submittingDelete
                    ? "Deleting & Purging R2..."
                    : "Confirm Delete & Log Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Episode Audit Trail & 1-Click Deleted Episode Recovery */}
      <div className="bg-[#111622] border border-[#263147] rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#263147] pb-3">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-[#C5A059] font-semibold">
              IMMUTABLE EPISODE AUDIT TRAIL &amp; 1-CLICK SNAPSHOT RECOVERY
            </span>
            <h2 className="text-lg font-bold text-[#F3EFE6]">
              Recent Episode Lifecycle Events (<code>target_type = episode</code>)
            </h2>
          </div>
          <Link
            href="/admin/audit?targetType=episode"
            className="text-xs font-mono text-[#C5A059] hover:underline"
          >
            Open Full Audit Replay Studio →
          </Link>
        </div>

        {auditEntries.length === 0 ? (
          <div className="text-xs font-mono text-[#8E9BAE] py-4">
            No episode audit events recorded yet. Generate, edit, or delete an
            episode above to see live hash-chained audit entries.
          </div>
        ) : (
          <div className="space-y-2.5">
            {auditEntries.map((entry) => {
              const isDelete = entry.actionType === "episode.delete";
              const beforeTitle =
                (entry.beforeState?.title as string | undefined) ||
                (entry.afterState?.title as string | undefined) ||
                `Episode ID ${entry.targetId}`;

              return (
                <div
                  key={entry.eventId}
                  className="bg-[#0B0E14] border border-[#1E2738] rounded p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 font-mono text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                          entry.actionType === "episode.delete"
                            ? "bg-red-950/60 border-red-500/40 text-red-300"
                            : entry.actionType === "episode.generate"
                            ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                            : "bg-sky-950/60 border-sky-500/40 text-sky-300"
                        }`}
                      >
                        {entry.actionType}
                      </span>
                      <span className="text-[#F3EFE6] font-semibold">
                        {beforeTitle}
                      </span>
                      <span className="text-[#8E9BAE]">
                        ({entry.timestamp.slice(0, 19).replace("T", " ")} UTC)
                      </span>
                    </div>

                    <div className="text-[#9CA3AF]">
                      Reason: <span className="text-[#D6D1C7]">{entry.reason}</span>
                    </div>

                    <div className="text-[10px] text-[#8E9BAE]">
                      Actor: {entry.actorEmail} ({entry.authMethod}) • SHA-256:{" "}
                      <code className="text-[#C5A059]">
                        {entry.entryHash.slice(0, 16)}…
                      </code>
                    </div>
                  </div>

                  {isDelete && canMutate && (
                    <button
                      type="button"
                      disabled={restoringEventId === entry.eventId}
                      onClick={() => handleRestoreDeletedEpisode(entry)}
                      className="px-3.5 py-1.5 rounded bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-200 font-mono text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {restoringEventId === entry.eventId
                        ? "Restoring Snapshot..."
                        : "↺ 1-Click Restore Deleted Episode"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
