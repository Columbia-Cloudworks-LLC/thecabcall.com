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

function formatCleanDate(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso.slice(0, 10);
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AdminEpisodesClient({
  actor,
  initialEpisodes,
  candidateIncidents,
}: AdminEpisodesClientProps) {
  const router = useRouter();
  const [episodes, setEpisodes] =
    useState<AdminEpisodeRecord[]>(initialEpisodes);
  const [audioCacheBuster, setAudioCacheBuster] = useState<number>(Date.now());

  // List filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState<
    "all" | "weekly_rollup" | "legacy_archive"
  >("all");

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

  // Slide-out Episode Inspector Drawer state
  const [inspectingEpisode, setInspectingEpisode] =
    useState<AdminEpisodeRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editExtendedNotes, setEditExtendedNotes] = useState("");
  const [editExternalSourcesJson, setEditExternalSourcesJson] = useState("[]");
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

  // Technical metadata & Danger Zone collapsible sections inside Inspector Drawer
  const [showTechMetadata, setShowTechMetadata] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [deletePurgeAudio, setDeletePurgeAudio] = useState(true);
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
        String(ep.episodeNumber).includes(q)
      );
    });
  }, [episodes, seriesFilter, searchQuery]);

  async function refreshEpisodes() {
    try {
      const epRes = await fetch("/api/admin/episodes", { cache: "no-store" });
      if (epRes.ok) {
        const epData = (await epRes.json()) as {
          episodes?: AdminEpisodeRecord[];
        };
        if (Array.isArray(epData.episodes)) {
          setEpisodes(epData.episodes);
          if (inspectingEpisode) {
            const updated = epData.episodes.find(
              (item) => item.id === inspectingEpisode.id
            );
            if (updated) {
              setInspectingEpisode(updated);
            }
          }
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

  function openInspectorDrawer(ep: AdminEpisodeRecord) {
    setInspectingEpisode(ep);
    setEditTitle(ep.title);
    setEditSummary(ep.summary);
    setEditExtendedNotes(ep.extendedNotes || "");
    setEditExternalSourcesJson(
      JSON.stringify(ep.externalSources || [], null, 2)
    );
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
    setShowTechMetadata(false);
    setShowDangerZone(false);
    setDeletePurgeAudio(true);
    setDeleteReason("");
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
            } from Podcast Studio (${genWindowDays}-day window${
              selectedIncidentIds.length > 0
                ? `, ${selectedIncidentIds.length} hand-picked stories`
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
        setShowGeneratePanel(false);
        setGenTitleOverride("");
        setGenSummaryOverride("");
        setGenFocusNote("");
        setSelectedIncidentIds([]);
        setGenReason("");
        openInspectorDrawer(data.episode);
        setBanner({
          type: "success",
          title: `Episode #${data.episode.episodeNumber} Published`,
          detail: `"${data.episode.title}" (${formatBytes(
            data.episode.fileSizeBytes
          )}) is now live on /archive and /podcast.xml.`,
        });
        await refreshEpisodes();
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

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!inspectingEpisode || !canMutate) return;

    setSubmittingEdit(true);
    setBanner(null);

    const ttsSpec = TTS_VOICE_OPTIONS[editTtsIdx] || TTS_VOICE_OPTIONS[0];

    try {
      let parsedExternalSources = inspectingEpisode.externalSources || [];
      if (editExternalSourcesJson.trim()) {
        try {
          const parsed = JSON.parse(editExternalSourcesJson);
          if (Array.isArray(parsed)) {
            parsedExternalSources = parsed;
          }
        } catch {
          // keep previous if invalid JSON
        }
      }

      const payload: Record<string, unknown> = {
        title: editTitle.trim(),
        summary: editSummary.trim(),
        extendedNotes: editExtendedNotes.trim() || null,
        externalSources: parsedExternalSources,
        episodeNumber: editEpisodeNumber,
        publishedAt: editPublishedAt.trim(),
        regenerateAudio: editRegenerateAudio,
        ttsVoice: ttsSpec.voice,
        ttsProvider: ttsSpec.provider,
        reason:
          editReason.trim() ||
          `Updated Episode #${editEpisodeNumber} notes/transcript in Podcast Studio${
            editRegenerateAudio ? " and re-recorded MP3 audio" : ""
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
        `/api/admin/episodes/${encodeURIComponent(
          String(inspectingEpisode.id)
        )}`,
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
        setInspectingEpisode(data.episode);
        setBanner({
          type: "success",
          title: `Episode #${data.episode.episodeNumber} Saved`,
          detail: `Saved updates to "${data.episode.title}"${
            data.audioRegenerated ? " and updated the MP3 audio stream" : ""
          }.`,
        });
        await refreshEpisodes();
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

  async function handleConfirmDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!inspectingEpisode || !canMutate) return;

    const finalReason = deleteReason.trim();
    if (!finalReason) {
      setBanner({
        type: "error",
        title: "Audit Reason Required",
        detail:
          "Please provide an editorial reason for deleting this episode so it is recorded in the audit ledger.",
      });
      return;
    }

    setSubmittingDelete(true);
    setBanner(null);

    try {
      const res = await fetch(
        `/api/admin/episodes/${encodeURIComponent(
          String(inspectingEpisode.id)
        )}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: inspectingEpisode.id,
            purgeAudio: deletePurgeAudio,
            reason: finalReason,
          }),
        }
      );

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        audioPurged?: boolean;
        episodes?: AdminEpisodeRecord[];
      };

      if (!res.ok || !data.ok) {
        setBanner({
          type: "error",
          title: "Failed to Delete Episode",
          detail: data.error || `HTTP ${res.status}`,
        });
      } else {
        const removedEp = inspectingEpisode;
        if (Array.isArray(data.episodes)) {
          setEpisodes(data.episodes);
        } else {
          setEpisodes((prev) =>
            prev.filter((item) => item.id !== removedEp.id)
          );
        }
        setInspectingEpisode(null);
        setDeleteReason("");
        setBanner({
          type: "success",
          title: `Episode #${removedEp.episodeNumber} Deleted`,
          detail: `Removed "${removedEp.title}" from the archive. Full snapshot saved in the audit ledger for 1-click restoration.`,
        });
        await refreshEpisodes();
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

  const weeklyRollupCount = episodes.filter(
    (e) => e.series === "weekly_rollup"
  ).length;
  const legacyArchiveCount = episodes.filter(
    (e) => e.series === "legacy_archive"
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Podcast Studio Header Banner */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 shadow-xl">
        <span className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l border-[#C5A059]/75" />
        <span className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r border-[#C5A059]/75" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b border-l border-[#C5A059]/75" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b border-r border-[#C5A059]/75" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
                Podcast Studio • Audio &amp; Transcripts
              </span>
              <span className="px-2 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/45 font-sans text-[11px] text-[#94A3B8]">
                {episodes.length} episodes ({weeklyRollupCount} Weekly Briefs •{" "}
                {legacyArchiveCount} Legacy Archive)
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] tracking-wide">
              Podcast Studio
            </h1>
            <p className="font-serif text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
              Select any episode below to listen, refine show notes and
              transcripts in the slide-out inspector, or produce a new weekly
              episode.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://thecabcall.com/archive"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 border border-[#8A6D3B]/50 hover:border-[#C5A059] bg-[#0B0E14] text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out"
            >
              Public Archive ↗
            </a>
            <a
              href="https://thecabcall.com/podcast.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 border border-[#8A6D3B]/50 hover:border-[#C5A059] bg-[#0B0E14] text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out"
            >
              Podcast RSS ↗
            </a>
            {canMutate && (
              <button
                type="button"
                onClick={() => setShowGeneratePanel((prev) => !prev)}
                className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer"
              >
                {showGeneratePanel
                  ? "Close Episode Producer"
                  : "+ Produce New Episode"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Notification Banner */}
      {banner && (
        <div
          className={`border p-4 flex items-start justify-between gap-4 ${
            banner.type === "success"
              ? "bg-emerald-950/50 border-emerald-500/45 text-emerald-100"
              : "bg-red-950/50 border-red-500/50 text-red-100"
          }`}
        >
          <div className="space-y-1">
            <div className="font-display text-xs uppercase font-bold tracking-wider">
              {banner.title}
            </div>
            <div className="font-serif text-sm text-[#F3EFE6]/90">
              {banner.detail}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="font-display text-[11px] uppercase tracking-wider underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Produce New Episode Panel */}
      {showGeneratePanel && canMutate && (
        <div className="relative bg-[#111726] border-2 border-[#C5A059] p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-4">
            <div>
              <span className="font-display text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
                Weekly Broadcast Producer
              </span>
              <h2 className="font-display text-xl text-[#F3EFE6] mt-0.5">
                Produce &amp; Publish New Podcast Episode
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowGeneratePanel(false)}
              className="px-3 py-1 border border-[#8A6D3B]/45 text-xs font-display uppercase tracking-wider text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleGenerateEpisode} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Episode Number */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-display text-xs uppercase tracking-wider text-[#F3EFE6]">
                    Episode Number
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-sans text-xs text-[#C5A059] cursor-pointer">
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
                    className="w-full bg-[#111726] border border-[#8A6D3B]/50 px-3 py-1.5 text-sm font-mono text-[#F3EFE6]"
                  />
                ) : (
                  <div className="px-3 py-1.5 bg-[#111726] border border-[#8A6D3B]/35 font-mono text-sm text-[#C5A059] font-bold">
                    Auto (#{nextAutoEpisodeNumber})
                  </div>
                )}
              </div>

              {/* Story Window */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/40 p-3.5 space-y-2">
                <label className="block font-display text-xs uppercase tracking-wider text-[#F3EFE6]">
                  Story Window
                </label>
                <select
                  value={genWindowDays}
                  onChange={(e) =>
                    setGenWindowDays(parseInt(e.target.value, 10) || 7)
                  }
                  className="w-full bg-[#111726] border border-[#8A6D3B]/50 px-3 py-1.5 text-xs font-sans text-[#F3EFE6]"
                >
                  <option value={7}>Past 7 Days (Standard Weekly Brief)</option>
                  <option value={14}>Past 14 Days (Bi-Weekly Window)</option>
                  <option value={30}>Past 30 Days (Monthly Window)</option>
                </select>
              </div>

              {/* Voice Cadence */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/40 p-3.5 space-y-2">
                <label className="block font-display text-xs uppercase tracking-wider text-[#F3EFE6]">
                  Host Voice &amp; Audio Engine
                </label>
                <select
                  value={selectedTtsIdx}
                  onChange={(e) =>
                    setSelectedTtsIdx(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full bg-[#111726] border border-[#8A6D3B]/50 px-3 py-1.5 text-xs font-sans text-[#F3EFE6]"
                >
                  {TTS_VOICE_OPTIONS.map((opt, idx) => (
                    <option key={opt.label} value={idx}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Custom Title Override{" "}
                  <span className="text-[#94A3B8] normal-case font-serif italic">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={genTitleOverride}
                  onChange={(e) => setGenTitleOverride(e.target.value)}
                  placeholder="Leave blank to title automatically from the week's lead brief"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Custom Summary Override{" "}
                  <span className="text-[#94A3B8] normal-case font-serif italic">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={genSummaryOverride}
                  onChange={(e) => setGenSummaryOverride(e.target.value)}
                  placeholder="Leave blank to auto-draft 2-sentence episode summary"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                Editorial Focus Note{" "}
                <span className="text-[#94A3B8] normal-case font-serif italic">
                  (optional guidance for the weekly script)
                </span>
              </label>
              <textarea
                rows={2}
                value={genFocusNote}
                onChange={(e) => setGenFocusNote(e.target.value)}
                placeholder="e.g., Highlight the common thread between municipal utility maintenance and aviation failover readiness."
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
              />
            </div>

            {/* Featured Stories Selection */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-display text-xs uppercase tracking-wider text-[#F3EFE6]">
                  Featured Stories{" "}
                  <span className="text-[#94A3B8] font-serif italic normal-case">
                    (
                    {selectedIncidentIds.length === 0
                      ? "Auto-selecting top 5 stories in window"
                      : `${selectedIncidentIds.length} story(s) selected`}
                    )
                  </span>
                </label>
                {selectedIncidentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIncidentIds([])}
                    className="text-xs font-display uppercase tracking-wider text-[#C5A059] underline cursor-pointer"
                  >
                    Reset to Auto Top 5
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto bg-[#0B0E14] border border-[#8A6D3B]/40 divide-y divide-[#8A6D3B]/25">
                {candidateIncidents.slice(0, 15).map((inc) => {
                  const checked = selectedIncidentIds.includes(inc.id);
                  return (
                    <label
                      key={inc.id}
                      className={`flex items-start gap-3 p-2.5 text-xs cursor-pointer transition-colors ${
                        checked
                          ? "bg-[#C5A059]/15 text-[#F3EFE6]"
                          : "hover:bg-[#111726] text-[#94A3B8]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIncidentSelection(inc.id)}
                        className="mt-0.5 accent-[#C5A059]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-sm text-[#F3EFE6] truncate">
                          {inc.title}
                        </div>
                        <div className="text-[11px] font-sans text-[#94A3B8] mt-0.5">
                          {inc.source_feed} • Tool: {inc.primary_tool}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4 pt-3 border-t border-[#8A6D3B]/35">
              <div className="flex-1 space-y-1">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Editorial Note (Recorded in Audit Ledger)
                </label>
                <input
                  type="text"
                  value={genReason}
                  onChange={(e) => setGenReason(e.target.value)}
                  placeholder="e.g., Produced Friday Weekly Brief for publication"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <button
                type="submit"
                disabled={submittingGenerate}
                className="px-6 py-2.5 bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer shrink-0"
              >
                {submittingGenerate
                  ? "Producing Audio & Transcript…"
                  : "Produce & Publish Episode"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111726] border border-[#8A6D3B]/45 p-4">
        <div className="flex flex-wrap items-center gap-2 font-display text-xs uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setSeriesFilter("all")}
            className={`px-3 py-1.5 border transition-all duration-200 ease-out cursor-pointer ${
              seriesFilter === "all"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/40 hover:text-[#F3EFE6]"
            }`}
          >
            All Episodes ({episodes.length})
          </button>
          <button
            type="button"
            onClick={() => setSeriesFilter("weekly_rollup")}
            className={`px-3 py-1.5 border transition-all duration-200 ease-out cursor-pointer ${
              seriesFilter === "weekly_rollup"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/40 hover:text-[#F3EFE6]"
            }`}
          >
            Weekly Briefs ({weeklyRollupCount})
          </button>
          <button
            type="button"
            onClick={() => setSeriesFilter("legacy_archive")}
            className={`px-3 py-1.5 border transition-all duration-200 ease-out cursor-pointer ${
              seriesFilter === "legacy_archive"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/40 hover:text-[#F3EFE6]"
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
            placeholder="Search episodes by #, title, or topic..."
            className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-1.5 text-xs font-sans text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs font-display uppercase tracking-wider text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Compact Scannable Episode List */}
      <div className="bg-[#111726] border border-[#8A6D3B]/45 divide-y divide-[#8A6D3B]/30 shadow-xl">
        {filteredEpisodes.length === 0 ? (
          <div className="p-8 text-center font-serif text-sm text-[#94A3B8]">
            No episodes match the current filter.
          </div>
        ) : (
          filteredEpisodes.map((ep) => {
            const isSelected = inspectingEpisode?.id === ep.id;

            return (
              <div
                key={ep.id}
                onClick={() => openInspectorDrawer(ep)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openInspectorDrawer(ep);
                  }
                }}
                className={`group p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 ease-out cursor-pointer ${
                  isSelected
                    ? "bg-[#C5A059]/10 border-l-4 border-l-[#C5A059]"
                    : "hover:bg-[#0B0E14]/55"
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="px-2 py-0.5 bg-[#0B0E14] border border-[#C5A059]/60 font-display text-[11px] uppercase tracking-wider text-[#C5A059] font-bold">
                      Ep #{ep.episodeNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 border font-display text-[10px] uppercase tracking-wider ${
                        ep.series === "weekly_rollup"
                          ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                          : "bg-[#0B0E14] border-[#8A6D3B]/50 text-[#94A3B8]"
                      }`}
                    >
                      {ep.series === "weekly_rollup"
                        ? "Weekly Brief"
                        : "Legacy Archive"}
                    </span>
                    <span className="text-[#8A6D3B]">•</span>
                    <span className="font-sans text-xs text-[#94A3B8]">
                      {formatCleanDate(ep.publishedAt)}
                    </span>
                    <span className="text-[#8A6D3B]">•</span>
                    <span className="font-mono text-xs text-[#F3EFE6]/90">
                      {ep.durationFormatted}
                    </span>
                  </div>

                  <h3 className="font-display text-base sm:text-lg text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors leading-snug">
                    {ep.title}
                  </h3>

                  <p className="line-clamp-2 font-serif text-sm text-[#94A3B8] leading-relaxed">
                    {ep.summary}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span className="px-3 py-1.5 bg-[#0B0E14] border border-[#8A6D3B]/50 group-hover:border-[#C5A059] font-display text-xs uppercase tracking-wider text-[#C5A059] group-hover:text-[#F3EFE6] transition-all duration-200 ease-out">
                    Inspect &amp; Edit →
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Subtle Footer Link to Episode Audit History */}
      <div className="flex items-center justify-between pt-2 text-xs text-[#94A3B8]">
        <span className="font-serif italic">
          All episode publications, edits, and deletions are preserved in the
          immutable audit ledger for 1-click restoration.
        </span>
        <Link
          href="/admin/audit?targetType=episode"
          className="font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
        >
          View Episode Audit History →
        </Link>
      </div>

      {/* Right-Hand Slide-Out Episode Inspector Drawer */}
      {inspectingEpisode && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
          <div
            className="flex-1"
            onClick={() => setInspectingEpisode(null)}
            aria-hidden="true"
          />
          <aside
            aria-label={`Episode #${inspectingEpisode.episodeNumber} Inspector Drawer`}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-[#111726] border-l border-[#C5A059]/60 shadow-2xl overflow-y-auto p-6 space-y-6 transition-all duration-200 ease-out"
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#8A6D3B]/40 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#0B0E14] border border-[#C5A059]/60 font-display text-[10px] uppercase tracking-wider text-[#C5A059] font-bold">
                    Ep #{inspectingEpisode.episodeNumber}
                  </span>
                  <span className="font-sans text-xs text-[#94A3B8]">
                    {formatCleanDate(inspectingEpisode.publishedAt)} •{" "}
                    {inspectingEpisode.durationFormatted}
                  </span>
                </div>
                <h2 className="font-display text-xl text-[#F3EFE6] leading-snug">
                  {inspectingEpisode.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setInspectingEpisode(null)}
                className="px-3 py-1.5 bg-[#0B0E14] border border-[#8A6D3B]/50 hover:border-[#C5A059] font-display text-xs uppercase tracking-wider text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer shrink-0"
              >
                ✕ Close
              </button>
            </div>

            {/* 1. Single Shared Audio Player at the Top of the Drawer */}
            <div className="bg-[#0B0E14] border border-[#8A6D3B]/45 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[11px] uppercase tracking-wider text-[#C5A059]">
                  Episode Audio Player
                </span>
                <a
                  href={inspectingEpisode.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8] hover:text-[#C5A059] transition-colors"
                >
                  Open MP3 Stream ↗
                </a>
              </div>
              <audio
                controls
                preload="metadata"
                src={`${inspectingEpisode.audioUrl}${
                  inspectingEpisode.audioUrl.includes("?") ? "&" : "?"
                }v=${audioCacheBuster}`}
                className="w-full h-10"
              />
            </div>

            {/* 2. Description & Transcript Editor */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Episode #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editEpisodeNumber}
                    onChange={(e) =>
                      setEditEpisodeNumber(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                    Episode Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 font-serif text-sm text-[#F3EFE6] focus:border-[#C5A059] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Episode Description (Show Notes Summary)
                </label>
                <textarea
                  rows={3}
                  required
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 p-3 font-serif text-sm text-[#F3EFE6] leading-relaxed focus:border-[#C5A059] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                  Extended Episode Guide &amp; Notes{" "}
                  <span className="text-[#94A3B8] normal-case font-serif italic">
                    (optional)
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={editExtendedNotes}
                  onChange={(e) => setEditExtendedNotes(e.target.value)}
                  placeholder="Detailed show notes or listener guide..."
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 p-3 font-serif text-sm text-[#F3EFE6] leading-relaxed focus:border-[#C5A059] focus:outline-none"
                />
              </div>

              {/* Transcript Editor */}
              <div className="space-y-3 pt-3 border-t border-[#8A6D3B]/35">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-xs uppercase tracking-wider text-[#F3EFE6]">
                    Episode Transcript
                  </span>
                  <div className="flex items-center gap-1.5 font-display text-[11px] uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setEditMode("sections")}
                      className={`px-2.5 py-1 border cursor-pointer ${
                        editMode === "sections"
                          ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                          : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/40"
                      }`}
                    >
                      3-Part Structured
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode("raw")}
                      className={`px-2.5 py-1 border cursor-pointer ${
                        editMode === "raw"
                          ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                          : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/40"
                      }`}
                    >
                      Full Text
                    </button>
                  </div>
                </div>

                {editMode === "sections" ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-display uppercase tracking-wider text-[#C5A059]">
                          Part 1: [00:00 — The Weekly Telemetry]
                        </span>
                        <span className="font-sans text-[#94A3B8]">
                          {countWords(editPart1)} words
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={editPart1}
                        onChange={(e) => setEditPart1(e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 p-3 font-serif text-sm text-[#F3EFE6] leading-relaxed focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-display uppercase tracking-wider text-[#C5A059]">
                          Part 2: [01:15 — Separating Signal From Panic]
                        </span>
                        <span className="font-sans text-[#94A3B8]">
                          {countWords(editPart2)} words
                        </span>
                      </div>
                      <textarea
                        rows={5}
                        value={editPart2}
                        onChange={(e) => setEditPart2(e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 p-3 font-serif text-sm text-[#F3EFE6] leading-relaxed focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-display uppercase tracking-wider text-[#C5A059]">
                          Part 3: [03:30 — The Forward Posture]
                        </span>
                        <span className="font-sans text-[#94A3B8]">
                          {countWords(editPart3)} words
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={editPart3}
                        onChange={(e) => setEditPart3(e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 p-3 font-serif text-sm text-[#F3EFE6] leading-relaxed focus:border-[#C5A059] focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-display uppercase tracking-wider text-[#C5A059]">
                        Complete Transcript
                      </span>
                      <span className="font-sans text-[#94A3B8]">
                        {countWords(editRawTranscript)} words
                      </span>
                    </div>
                    <textarea
                      rows={10}
                      value={editRawTranscript}
                      onChange={(e) => setEditRawTranscript(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 p-3 font-serif text-sm text-[#F3EFE6] leading-relaxed focus:border-[#C5A059] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Audio Regeneration Option */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/40 p-3.5 space-y-2.5">
                <label className="flex items-center gap-2.5 text-xs font-sans text-[#F3EFE6] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRegenerateAudio}
                    onChange={(e) => setEditRegenerateAudio(e.target.checked)}
                    className="accent-[#C5A059]"
                  />
                  <span>
                    Re-record MP3 audio from updated transcript on save
                  </span>
                </label>

                {editRegenerateAudio && (
                  <div className="pl-6">
                    <select
                      value={editTtsIdx}
                      onChange={(e) =>
                        setEditTtsIdx(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-[#111726] border border-[#8A6D3B]/50 px-3 py-1.5 text-xs font-sans text-[#F3EFE6]"
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

              {/* Audit Note & Save Button */}
              {canMutate && (
                <div className="space-y-3 pt-2 border-t border-[#8A6D3B]/35">
                  <div>
                    <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059] mb-1">
                      Editorial Note (Recorded in Audit Ledger)
                    </label>
                    <input
                      type="text"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="e.g., Refined show notes and transcript"
                      className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setInspectingEpisode(null)}
                      className="px-4 py-2 border border-[#8A6D3B]/45 font-display text-xs uppercase tracking-wider text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={submittingEdit}
                      className="px-5 py-2 bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      {submittingEdit ? "Saving Changes…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* 3. Collapsible Technical Metadata Accordion */}
            <div className="border-t border-[#8A6D3B]/35 pt-4">
              <button
                type="button"
                onClick={() => setShowTechMetadata((prev) => !prev)}
                className="w-full flex items-center justify-between text-left font-display text-xs uppercase tracking-wider text-[#94A3B8] hover:text-[#C5A059] cursor-pointer"
              >
                <span>Technical Storage &amp; Feed Metadata</span>
                <span>{showTechMetadata ? "▲" : "▼"}</span>
              </button>

              {showTechMetadata && (
                <div className="mt-3 bg-[#0B0E14] border border-[#8A6D3B]/35 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#94A3B8]">Database Record ID:</span>
                    <code className="font-mono text-[#F3EFE6]">
                      {inspectingEpisode.id}
                    </code>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#94A3B8]">Episode Slug:</span>
                    <code className="font-mono text-[#F3EFE6]">
                      {inspectingEpisode.slug}
                    </code>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#94A3B8]">R2 Audio Key:</span>
                    <code className="font-mono text-[#C5A059]">
                      {inspectingEpisode.r2Key}
                    </code>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#94A3B8]">Audio File Size:</span>
                    <code className="font-mono text-emerald-300">
                      {formatBytes(inspectingEpisode.fileSizeBytes)}
                    </code>
                  </div>
                  <div className="pt-2 border-t border-[#8A6D3B]/25">
                    <label className="block font-display text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                      Published Timestamp (ISO-8601)
                    </label>
                    <input
                      type="text"
                      value={editPublishedAt}
                      onChange={(e) => setEditPublishedAt(e.target.value)}
                      className="w-full bg-[#111726] border border-[#8A6D3B]/40 px-2.5 py-1.5 font-mono text-xs text-[#F3EFE6]"
                    />
                  </div>
                  <div className="pt-2">
                    <label className="block font-display text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                      External Sources JSON
                    </label>
                    <textarea
                      rows={2}
                      value={editExternalSourcesJson}
                      onChange={(e) =>
                        setEditExternalSourcesJson(e.target.value)
                      }
                      className="w-full bg-[#111726] border border-[#8A6D3B]/40 p-2 font-mono text-[11px] text-[#F3EFE6]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Danger Zone / Delete Episode Action */}
            {canMutate && (
              <div className="border-t border-red-500/30 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDangerZone((prev) => !prev)}
                  className="w-full flex items-center justify-between text-left font-display text-xs uppercase tracking-wider text-red-300 hover:text-red-200 cursor-pointer"
                >
                  <span>Remove Episode from Archive</span>
                  <span>{showDangerZone ? "▲" : "▼"}</span>
                </button>

                {showDangerZone && (
                  <form
                    onSubmit={handleConfirmDelete}
                    className="mt-3 bg-red-950/25 border border-red-500/40 p-4 space-y-3"
                  >
                    <p className="font-serif text-xs text-red-200/90">
                      Removing Episode #{inspectingEpisode.episodeNumber}{" "}
                      immediately updates the public archive and RSS feed. A
                      complete snapshot is preserved in the audit ledger for
                      1-click restoration.
                    </p>

                    <label className="flex items-center gap-2 text-xs font-sans text-red-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deletePurgeAudio}
                        onChange={(e) => setDeletePurgeAudio(e.target.checked)}
                      />
                      <span>
                        Also purge MP3 audio file (
                        <code className="font-mono">
                          {inspectingEpisode.r2Key}
                        </code>
                        ) from storage
                      </span>
                    </label>

                    <div>
                      <label className="block font-display text-[10px] uppercase tracking-wider text-red-200 mb-1">
                        Reason for Removal (Required)
                      </label>
                      <input
                        type="text"
                        required
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="e.g., Superseded by updated broadcast"
                        className="w-full bg-[#0B0E14] border border-red-500/50 px-3 py-1.5 text-xs font-serif text-[#F3EFE6]"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingDelete}
                        className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white font-display text-xs uppercase tracking-wider font-bold cursor-pointer disabled:opacity-50"
                      >
                        {submittingDelete
                          ? "Removing Episode…"
                          : "Confirm Episode Removal"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
