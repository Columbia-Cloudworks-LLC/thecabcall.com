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
  workerAudioUploadUrl?: string;
  sessionToken?: string | null;
}

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

function formatDurationMmSs(seconds: number): string {
  if (!seconds || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

async function detectAudioFileDurationSeconds(file: File): Promise<number | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = "metadata";
      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
      };
      audio.onloadedmetadata = () => {
        const dur = audio.duration;
        cleanup();
        if (Number.isFinite(dur) && dur > 0) {
          resolve(Math.round(dur));
        } else {
          resolve(null);
        }
      };
      audio.onerror = () => {
        cleanup();
        resolve(null);
      };
      audio.src = objectUrl;
    } catch {
      resolve(null);
    }
  });
}

export function AdminEpisodesClient({
  actor,
  initialEpisodes,
  workerAudioUploadUrl,
  sessionToken,
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

  // Publish New Episode (External Media Upload) state
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [useCustomEpNumber, setUseCustomEpNumber] = useState(false);
  const [customEpNumber, setCustomEpNumber] = useState<number>(() => {
    const maxEp = initialEpisodes.reduce(
      (max, ep) => Math.max(max, ep.episodeNumber || 0),
      21
    );
    return maxEp + 1;
  });
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newExtendedNotes, setNewExtendedNotes] = useState("");
  const [newTranscript, setNewTranscript] = useState("");
  const [newAudioFile, setNewAudioFile] = useState<File | null>(null);
  const [newAudioUrl, setNewAudioUrl] = useState("");
  const [newDurationSeconds, setNewDurationSeconds] = useState<number>(1800);
  const [newFileSizeBytes, setNewFileSizeBytes] = useState<number>(0);
  const [newArtworkUrl, setNewArtworkUrl] = useState("");
  const [newPublishedAt, setNewPublishedAt] = useState<string>(() =>
    new Date().toISOString()
  );
  const [newReason, setNewReason] = useState("");
  const [submittingPublish, setSubmittingPublish] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);

  // Slide-out Episode Inspector Drawer state
  const [inspectingEpisode, setInspectingEpisode] =
    useState<AdminEpisodeRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editExtendedNotes, setEditExtendedNotes] = useState("");
  const [editExternalSourcesJson, setEditExternalSourcesJson] = useState("[]");
  const [editEpisodeNumber, setEditEpisodeNumber] = useState<number>(21);
  const [editPublishedAt, setEditPublishedAt] = useState("");
  const [editAudioUrl, setEditAudioUrl] = useState("");
  const [editDurationSeconds, setEditDurationSeconds] = useState<number>(1800);
  const [editArtworkUrl, setEditArtworkUrl] = useState("");
  const [replacementAudioFile, setReplacementAudioFile] = useState<File | null>(
    null
  );
  const [editMode, setEditMode] = useState<"sections" | "raw">("raw");
  const [editPart1, setEditPart1] = useState("");
  const [editPart2, setEditPart2] = useState("");
  const [editPart3, setEditPart3] = useState("");
  const [editRawTranscript, setEditRawTranscript] = useState("");
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
      21
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

  /**
   * Uploads an audio file (MP3, M4A, WAV, AAC, OGG, FLAC) directly to the Cloudflare Worker R2 endpoint
   * (so large 25-80 MB .m4a/.mp3 files bypass Vercel's 4.5 MB limit) with fallback to Next.js API route.
   */
  async function uploadAudioFileToR2(
    file: File,
    episodeNumber: number
  ): Promise<{
    r2Key: string;
    audioUrl: string;
    fileSizeBytes: number;
  }> {
    const padded = String(episodeNumber).padStart(3, "0");
    const extMatch = file.name.match(/\.(mp3|m4a|mp4|wav|aac|ogg|flac)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : ".mp3";
    const cleanFilename = `legacy-cab-${padded}${ext === ".mp4" ? ".m4a" : ext}`;
    const contentType =
      file.type && file.type.startsWith("audio/")
        ? file.type
        : cleanFilename.endsWith(".m4a")
        ? "audio/mp4"
        : "audio/mpeg";

    const qs = new URLSearchParams({
      filename: cleanFilename,
      contentType,
      episodeNumber: String(episodeNumber),
    });

    // Try direct Worker upload first if workerAudioUploadUrl & sessionToken are available
    if (workerAudioUploadUrl && sessionToken) {
      try {
        const directRes = await fetch(
          `${workerAudioUploadUrl}?${qs.toString()}`,
          {
            method: "POST",
            headers: {
              "Content-Type": contentType,
              "x-session-token": sessionToken,
            },
            body: file,
          }
        );
        if (directRes.ok) {
          const directData = (await directRes.json()) as {
            ok?: boolean;
            r2Key?: string;
            audioUrl?: string;
            fileSizeBytes?: number;
          };
          if (directData.ok && directData.audioUrl && directData.r2Key) {
            return {
              r2Key: directData.r2Key,
              audioUrl: directData.audioUrl,
              fileSizeBytes: directData.fileSizeBytes || file.size,
            };
          }
        }
      } catch {
        // Fall through to local Next.js upload route
      }
    }

    const fallbackRes = await fetch(
      `/api/admin/episodes/upload-audio?${qs.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": contentType,
        },
        body: file,
      }
    );

    const fallbackData = (await fallbackRes.json()) as {
      ok?: boolean;
      error?: string;
      r2Key?: string;
      audioUrl?: string;
      fileSizeBytes?: number;
    };

    if (
      !fallbackRes.ok ||
      !fallbackData.ok ||
      !fallbackData.audioUrl ||
      !fallbackData.r2Key
    ) {
      throw new Error(
        fallbackData.error ||
          `Audio upload failed (HTTP ${fallbackRes.status})`
      );
    }

    return {
      r2Key: fallbackData.r2Key,
      audioUrl: fallbackData.audioUrl,
      fileSizeBytes: fallbackData.fileSizeBytes || file.size,
    };
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
    setEditAudioUrl(ep.audioUrl);
    setEditDurationSeconds(ep.durationSeconds || 1800);
    setEditArtworkUrl(ep.artworkUrl || "");
    setReplacementAudioFile(null);
    const hasThreeParts = Boolean(
      ep.transcriptSections.separatingSignalFromPanic ||
        ep.transcriptSections.forwardPosture
    );
    setEditMode(hasThreeParts ? "sections" : "raw");
    setEditPart1(ep.transcriptSections.weeklyTelemetry || "");
    setEditPart2(ep.transcriptSections.separatingSignalFromPanic || "");
    setEditPart3(ep.transcriptSections.forwardPosture || "");
    setEditRawTranscript(ep.transcript || "");
    setEditReason("");
    setShowTechMetadata(false);
    setShowDangerZone(false);
    setDeletePurgeAudio(true);
    setDeleteReason("");
  }

  async function handleNewAudioFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0] || null;
    setNewAudioFile(file);
    if (file) {
      setNewFileSizeBytes(file.size);
      const detectedSeconds = await detectAudioFileDurationSeconds(file);
      if (detectedSeconds) {
        setNewDurationSeconds(detectedSeconds);
      }
      const epNum = useCustomEpNumber ? customEpNumber : nextAutoEpisodeNumber;
      const padded = String(epNum).padStart(3, "0");
      const extMatch = file.name.match(/\.(mp3|m4a|mp4|wav|aac|ogg|flac)$/i);
      const ext = extMatch ? extMatch[0].toLowerCase() : ".mp3";
      setNewAudioUrl(`/audio/legacy-cab-${padded}${ext === ".mp4" ? ".m4a" : ext}`);
    }
  }

  async function handleReplacementAudioFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0] || null;
    setReplacementAudioFile(file);
    if (file) {
      const detectedSeconds = await detectAudioFileDurationSeconds(file);
      if (detectedSeconds) {
        setEditDurationSeconds(detectedSeconds);
      }
    }
  }

  async function handlePublishEpisode(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;

    const epNum = useCustomEpNumber ? customEpNumber : nextAutoEpisodeNumber;
    if (!newAudioFile && !newAudioUrl.trim()) {
      setBanner({
        type: "error",
        title: "Audio File Required",
        detail:
          "Please select an MP3 / M4A / WAV audio file to upload (or provide an existing /audio/... URL).",
      });
      return;
    }

    setSubmittingPublish(true);
    setBanner(null);

    try {
      let effectiveAudioUrl = newAudioUrl.trim();
      let effectiveFileSize = newFileSizeBytes || 24000000;

      if (newAudioFile) {
        setUploadStatusText(
          `Uploading ${newAudioFile.name} (${formatBytes(
            newAudioFile.size
          )}) to R2 storage…`
        );
        const uploaded = await uploadAudioFileToR2(newAudioFile, epNum);
        effectiveAudioUrl = uploaded.audioUrl;
        effectiveFileSize = uploaded.fileSizeBytes;
      }

      setUploadStatusText("Publishing episode metadata & updating RSS feed…");

      const finalTitle =
        newTitle.trim() || `The CAB Call #${epNum}`;
      const finalSummary =
        newSummary.trim() ||
        `Episode #${epNum} of The CAB Call Podcast.`;

      const res = await fetch("/api/admin/episodes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeNumber: epNum,
          titleOverride: finalTitle,
          summaryOverride: finalSummary,
          extendedNotesOverride: newExtendedNotes.trim() || finalSummary,
          transcriptOverride:
            newTranscript.trim() || newExtendedNotes.trim() || finalSummary,
          audioUrl: effectiveAudioUrl,
          artworkUrlOverride: newArtworkUrl.trim() || undefined,
          durationSeconds: newDurationSeconds,
          fileSizeBytes: effectiveFileSize,
          publishedAtOverride: newPublishedAt.trim() || new Date().toISOString(),
          reason:
            newReason.trim() ||
            `Published Episode #${epNum} ("${finalTitle}") with externally produced audio file (${effectiveAudioUrl})`,
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
          title: "Episode Publication Failed",
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
        setShowPublishPanel(false);
        setNewTitle("");
        setNewSummary("");
        setNewExtendedNotes("");
        setNewTranscript("");
        setNewAudioFile(null);
        setNewAudioUrl("");
        setNewArtworkUrl("");
        setNewReason("");
        openInspectorDrawer(data.episode);
        setBanner({
          type: "success",
          title: `Episode #${data.episode.episodeNumber} Published`,
          detail: `"${data.episode.title}" (${formatBytes(
            data.episode.fileSizeBytes
          )}, ${data.episode.durationFormatted}) is now live on the home page, /podcast, and /feed.xml.`,
        });
        await refreshEpisodes();
      }
    } catch (err) {
      setBanner({
        type: "error",
        title: "Episode Publication Error",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmittingPublish(false);
      setUploadStatusText(null);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!inspectingEpisode || !canMutate) return;

    setSubmittingEdit(true);
    setBanner(null);

    try {
      let effectiveAudioUrl = editAudioUrl.trim() || inspectingEpisode.audioUrl;
      let effectiveFileSize = inspectingEpisode.fileSizeBytes;

      if (replacementAudioFile) {
        const uploaded = await uploadAudioFileToR2(
          replacementAudioFile,
          editEpisodeNumber
        );
        effectiveAudioUrl = uploaded.audioUrl;
        effectiveFileSize = uploaded.fileSizeBytes;
      }

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
        audioUrl: effectiveAudioUrl,
        artworkUrl: editArtworkUrl.trim() || null,
        durationSeconds: editDurationSeconds,
        fileSizeBytes: effectiveFileSize,
        reason:
          editReason.trim() ||
          `Updated Episode #${editEpisodeNumber} in Podcast Studio${
            replacementAudioFile
              ? ` and uploaded replacement audio file (${replacementAudioFile.name})`
              : ""
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
        setReplacementAudioFile(null);
        setBanner({
          type: "success",
          title: `Episode #${data.episode.episodeNumber} Saved`,
          detail: `Saved updates to "${data.episode.title}"${
            replacementAudioFile ? " and updated the R2 audio stream" : ""
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
                Podcast Studio • External Media &amp; Transcripts
              </span>
              <span className="px-2 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/45 font-sans text-[11px] text-[#94A3B8]">
                {episodes.length} published episodes
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] tracking-wide">
              Podcast Studio
            </h1>
            <p className="font-serif text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
              Upload your externally produced MP3 / M4A / WAV episode files
              directly to R2 storage, or select any episode below to refine show
              notes, artwork, and transcripts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="https://thecabcall.com/podcast"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 border border-[#8A6D3B]/50 hover:border-[#C5A059] bg-[#0B0E14] text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out"
            >
              Public Podcast Page ↗
            </a>
            <a
              href="https://thecabcall.com/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 border border-[#8A6D3B]/50 hover:border-[#C5A059] bg-[#0B0E14] text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out"
            >
              Podcast RSS ↗
            </a>
            {canMutate && (
              <button
                type="button"
                onClick={() => setShowPublishPanel((prev) => !prev)}
                className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b06a] text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer"
              >
                {showPublishPanel
                  ? "Close Upload Studio"
                  : "+ Upload & Publish Episode"}
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

      {/* Upload & Publish New Episode Panel */}
      {showPublishPanel && canMutate && (
        <div className="relative bg-[#111726] border-2 border-[#C5A059] p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-4">
            <div>
              <span className="font-display text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
                External Media Publisher (MP3 / M4A / WAV / AAC)
              </span>
              <h2 className="font-display text-xl text-[#F3EFE6] mt-0.5">
                Upload &amp; Publish New Podcast Episode
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowPublishPanel(false)}
              className="px-3 py-1 border border-[#8A6D3B]/45 text-xs font-display uppercase tracking-wider text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handlePublishEpisode} className="space-y-5">
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
                      setCustomEpNumber(parseInt(e.target.value, 10) || 22)
                    }
                    className="w-full bg-[#111726] border border-[#8A6D3B]/50 px-3 py-1.5 text-sm font-mono text-[#F3EFE6]"
                  />
                ) : (
                  <div className="px-3 py-1.5 bg-[#111726] border border-[#8A6D3B]/35 font-mono text-sm text-[#C5A059] font-bold">
                    Auto (#{nextAutoEpisodeNumber})
                  </div>
                )}
              </div>

              {/* Audio File Selector (MP3 / M4A / WAV / AAC) */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/40 p-3.5 space-y-2 md:col-span-2">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Upload Produced Audio File (MP3, M4A, WAV, AAC, OGG, FLAC)
                </label>
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.mp4,.wav,.aac,.ogg,.flac"
                  onChange={handleNewAudioFileChange}
                  className="w-full bg-[#111726] border border-[#8A6D3B]/50 px-3 py-1.5 text-xs font-mono text-[#F3EFE6] file:mr-3 file:px-2.5 file:py-1 file:border-0 file:bg-[#C5A059] file:text-[#0B0E14] file:font-display file:text-[10px] file:uppercase file:font-bold file:cursor-pointer"
                />
                {newAudioFile && (
                  <div className="text-[11px] font-mono text-emerald-300">
                    Selected: {newAudioFile.name} (
                    {formatBytes(newAudioFile.size)} • Detected Duration:{" "}
                    {formatDurationMmSs(newDurationSeconds)})
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Episode Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`e.g., The CAB Call #${
                    useCustomEpNumber ? customEpNumber : nextAutoEpisodeNumber
                  }: ...`}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Duration (Seconds — {formatDurationMmSs(newDurationSeconds)})
                </label>
                <input
                  type="number"
                  min={1}
                  value={newDurationSeconds}
                  onChange={(e) =>
                    setNewDurationSeconds(parseInt(e.target.value, 10) || 1800)
                  }
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Artwork URL{" "}
                  <span className="text-[#94A3B8] normal-case font-serif italic">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={newArtworkUrl}
                  onChange={(e) => setNewArtworkUrl(e.target.value)}
                  placeholder="e.g., /media/legacy-cab-022.png"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Audio Stream Path / URL{" "}
                  <span className="text-[#94A3B8] normal-case font-serif italic">
                    (auto-filled on file select or enter existing R2 path)
                  </span>
                </label>
                <input
                  type="text"
                  value={newAudioUrl}
                  onChange={(e) => setNewAudioUrl(e.target.value)}
                  placeholder={`/audio/legacy-cab-${String(
                    useCustomEpNumber ? customEpNumber : nextAutoEpisodeNumber
                  ).padStart(3, "0")}.m4a`}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Published Date (ISO-8601)
                </label>
                <input
                  type="text"
                  value={newPublishedAt}
                  onChange={(e) => setNewPublishedAt(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-mono text-[#F3EFE6]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                Episode Summary (Show Notes Hook)
              </label>
              <textarea
                rows={2}
                required
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="2-sentence episode summary displayed on the Home Page hero card, /podcast archive, and RSS feed..."
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Extended Episode Guide &amp; Key Takeaways{" "}
                  <span className="text-[#94A3B8] normal-case font-serif italic">
                    (optional)
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={newExtendedNotes}
                  onChange={(e) => setNewExtendedNotes(e.target.value)}
                  placeholder="Extended overview and bulleted key takeaways..."
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Full Episode Transcript{" "}
                  <span className="text-[#94A3B8] normal-case font-serif italic">
                    (optional)
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={newTranscript}
                  onChange={(e) => setNewTranscript(e.target.value)}
                  placeholder="Paste episode transcript..."
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4 pt-3 border-t border-[#8A6D3B]/35">
              <div className="flex-1 space-y-1">
                <label className="block font-display text-xs uppercase tracking-wider text-[#C5A059]">
                  Editorial Note (Recorded in Audit Ledger)
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g., Uploaded produced M4A/MP3 episode audio and show notes"
                  className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 px-3 py-2 text-xs font-serif text-[#F3EFE6]"
                />
              </div>

              <button
                type="submit"
                disabled={submittingPublish}
                className="px-6 py-2.5 bg-[#C5A059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#0B0E14] font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 ease-out cursor-pointer shrink-0"
              >
                {submittingPublish
                  ? uploadStatusText || "Uploading & Publishing…"
                  : "Upload & Publish Episode"}
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
          {weeklyRollupCount > 0 && (
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
          )}
          {weeklyRollupCount > 0 && legacyArchiveCount > 0 && (
            <button
              type="button"
              onClick={() => setSeriesFilter("legacy_archive")}
              className={`px-3 py-1.5 border transition-all duration-200 ease-out cursor-pointer ${
                seriesFilter === "legacy_archive"
                  ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                  : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/40 hover:text-[#F3EFE6]"
              }`}
            >
              Foundational Essays ({legacyArchiveCount})
            </button>
          )}
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
                    <span className="font-sans text-xs text-[#94A3B8]">
                      {formatCleanDate(ep.publishedAt)}
                    </span>
                    <span className="text-[#8A6D3B]">•</span>
                    <span className="font-mono text-xs text-[#F3EFE6]/90">
                      {ep.durationFormatted}
                    </span>
                    <span className="text-[#8A6D3B]">•</span>
                    <span className="font-mono text-[11px] text-[#94A3B8]">
                      {ep.r2Key}
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
                  Episode Audio Player ({inspectingEpisode.r2Key})
                </span>
                <a
                  href={inspectingEpisode.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-[11px] uppercase tracking-wider text-[#94A3B8] hover:text-[#C5A059] transition-colors"
                >
                  Open Audio Stream ↗
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

            {/* 2. Description, Audio File Replacement & Transcript Editor */}
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

              {/* Replace / Upload Audio File Option */}
              <div className="bg-[#0B0E14] border border-[#8A6D3B]/40 p-3.5 space-y-2.5">
                <label className="block font-display text-[11px] uppercase tracking-wider text-[#C5A059]">
                  Replace / Upload Audio File (MP3, M4A, WAV, AAC)
                </label>
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.mp4,.wav,.aac,.ogg,.flac"
                  onChange={handleReplacementAudioFileChange}
                  className="w-full bg-[#111726] border border-[#8A6D3B]/50 px-3 py-1.5 text-xs font-mono text-[#F3EFE6] file:mr-3 file:px-2.5 file:py-1 file:border-0 file:bg-[#C5A059] file:text-[#0B0E14] file:font-display file:text-[10px] file:uppercase file:font-bold file:cursor-pointer"
                />
                {replacementAudioFile && (
                  <div className="text-[11px] font-mono text-emerald-300">
                    Ready to upload on Save: {replacementAudioFile.name} (
                    {formatBytes(replacementAudioFile.size)} • Duration:{" "}
                    {formatDurationMmSs(editDurationSeconds)})
                  </div>
                )}
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
                      onClick={() => setEditMode("raw")}
                      className={`px-2.5 py-1 border cursor-pointer ${
                        editMode === "raw"
                          ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                          : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/40"
                      }`}
                    >
                      Full Text
                    </button>
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
                  </div>
                </div>

                {editMode === "sections" ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-display uppercase tracking-wider text-[#C5A059]">
                          Part 1: [00:00 — Opening]
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
                          Part 2: [01:15 — Core Analysis]
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
                          Part 3: [03:30 — Closing]
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
                  <div className="pt-2 border-t border-[#8A6D3B]/25 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block font-display text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                        Audio URL / Path
                      </label>
                      <input
                        type="text"
                        value={editAudioUrl}
                        onChange={(e) => setEditAudioUrl(e.target.value)}
                        className="w-full bg-[#111726] border border-[#8A6D3B]/40 px-2.5 py-1.5 font-mono text-xs text-[#F3EFE6]"
                      />
                    </div>
                    <div>
                      <label className="block font-display text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                        Duration (Seconds)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editDurationSeconds}
                        onChange={(e) =>
                          setEditDurationSeconds(
                            parseInt(e.target.value, 10) || 1800
                          )
                        }
                        className="w-full bg-[#111726] border border-[#8A6D3B]/40 px-2.5 py-1.5 font-mono text-xs text-[#F3EFE6]"
                      />
                    </div>
                  </div>
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block font-display text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                        Artwork URL
                      </label>
                      <input
                        type="text"
                        value={editArtworkUrl}
                        onChange={(e) => setEditArtworkUrl(e.target.value)}
                        className="w-full bg-[#111726] border border-[#8A6D3B]/40 px-2.5 py-1.5 font-mono text-xs text-[#F3EFE6]"
                      />
                    </div>
                    <div>
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
                        Also purge audio file (
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
