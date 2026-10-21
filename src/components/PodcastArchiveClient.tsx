"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PublicEpisodeDto } from "@/lib/dto";
import {
  CANONICAL_PODCAST_AI_COLOPHON,
  formatTranscriptParagraphs,
  sanitizeEpisodeSummaryDefensive,
  stripAiDisclaimers,
  tokenizeTranscriptParagraph,
} from "@/lib/episode-metadata";
import { getWorkingToolSpec } from "@/lib/taxonomy";
import { useTelemetry } from "./TelemetryContext";
import {
  EpisodeArtworkEmblem,
  SquareAndCompassesCrest,
  WorkingToolEngraving,
} from "./MasonicEngravings";
import {
  Play,
  Pause,
  Radio,
  Rss,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  Compass,
  Layers,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface PodcastArchiveClientProps {
  initialEpisodes: PublicEpisodeDto[];
}

export function PodcastArchiveClient({
  initialEpisodes,
}: PodcastArchiveClientProps) {
  const episodes = initialEpisodes;
  const { activeEpisode: currentEpisode, isPlaying, playEpisode, togglePlayPause } =
    useTelemetry();

  const [seriesFilter, setSeriesFilter] = useState<
    "all" | "weekly_rollup" | "legacy_archive"
  >("all");
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<
    string | null
  >(episodes[0]?.id || null);
  const [rssCopied, setRssCopied] = useState(false);
  const [failedArtworkIds, setFailedArtworkIds] = useState<
    Record<string, boolean>
  >({});
  const [failedWidescreenIds, setFailedWidescreenIds] = useState<
    Record<string, boolean>
  >({});
  const [fullHeightTranscriptIds, setFullHeightTranscriptIds] = useState<
    Record<string, boolean>
  >({});
  const [copiedTranscriptId, setCopiedTranscriptId] = useState<string | null>(
    null
  );

  const toggleTranscriptFullHeight = (epId: string) => {
    setFullHeightTranscriptIds((prev) => ({
      ...prev,
      [epId]: !prev[epId],
    }));
  };

  const copyEpisodeTranscript = (epId: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedTranscriptId(epId);
    setTimeout(() => {
      setCopiedTranscriptId((prev) => (prev === epId ? null : prev));
    }, 2500);
  };

  const filteredEpisodes = episodes.filter((ep) => {
    if (seriesFilter !== "all" && ep.series !== seriesFilter) return false;
    if (toolFilter !== "all" && ep.dominantTool !== toolFilter) return false;
    return true;
  });

  const weeklyCount = episodes.filter(
    (e) => e.series === "weekly_rollup"
  ).length;
  const foundationalCount = episodes.filter(
    (e) => e.series === "legacy_archive"
  ).length;

  const copyRssUrl = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/feed.xml`
        : "https://thecabcall.com/feed.xml";
    navigator.clipboard?.writeText(url);
    setRssCopied(true);
    setTimeout(() => setRssCopied(false), 2500);
  };

  const renderExtendedNotesContent = (notesText: string) => {
    const clean = stripAiDisclaimers(notesText).trim();
    if (!clean) return null;

    const blocks = clean.split(/\n{2,}/);
    return (
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          const lines = block
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          if (lines.length === 0) return null;

          const hasBullets = lines.some((l) => l.startsWith("• "));
          if (hasBullets) {
            const headingLine =
              !lines[0].startsWith("• ") ? lines[0] : null;
            const bulletLines = lines.filter((l) => l.startsWith("• "));
            return (
              <div key={idx} className="space-y-2 pt-1">
                {headingLine && (
                  <h6 className="font-mono text-[11px] uppercase tracking-widest text-[#C5A059]">
                    {headingLine}
                  </h6>
                )}
                <ul className="space-y-1.5 pl-1">
                  {bulletLines.map((b, bIdx) => (
                    <li
                      key={bIdx}
                      className="flex items-start gap-2.5 font-serif text-sm text-[#F3EFE6]/90 leading-relaxed"
                    >
                      <span className="font-mono text-[#C5A059] mt-0.5 shrink-0">
                        •
                      </span>
                      <span>{b.slice(2).trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }

          if (
            lines.length === 1 &&
            /^Key Takeaways:?$/i.test(lines[0])
          ) {
            return (
              <h6
                key={idx}
                className="font-mono text-[11px] uppercase tracking-widest text-[#C5A059] pt-1"
              >
                {lines[0]}
              </h6>
            );
          }

          return (
            <p
              key={idx}
              className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed"
            >
              {lines.join(" ")}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16 space-y-10">
      {/* Masthead Header */}
      <section className="rounded-none border border-[#8A6D3B]/60 bg-[#131822]/90 p-6 sm:p-8 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#C5A059]">
              <Radio className="w-3.5 h-3.5" />
              <span>THE CAB CALL PODCAST</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl text-[#F3EFE6] tracking-wide">
              The CAB Call Podcast
            </h1>
            <p className="font-serif text-base text-[#F3EFE6]/85 leading-relaxed max-w-3xl">
              Conversational deep-dives analyzing live Trestleboard ledger
              dispatches alongside foundational essays on Site Reliability
              Engineering and the Working Tools of Freemasonry.
            </p>
          </div>

          {/* Flattened RSS Feed Column (Hairline Divider, Zero Nested Box) */}
          <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#8A6D3B]/30 pt-5 lg:pt-0 lg:pl-8 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-[#C5A059] flex items-center gap-1.5">
                <Rss className="w-3.5 h-3.5" />
                Podcast RSS 2.0 Feed
              </span>
              <span className="font-mono text-[10px] text-[#4ADE80] bg-[#2E6F40]/20 px-2 py-0.5">
                ACTIVE
              </span>
            </div>
            <p className="font-serif text-xs text-[#94A3B8] leading-relaxed">
              Subscribe in Apple Podcasts, Overcast, Pocket Casts, or any RSS
              audio client using our canonical XML feed.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={copyRssUrl}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-wider bg-[#C5A059] text-[#0B0E14] font-semibold hover:bg-[#d4b26a] transition-colors cursor-pointer"
              >
                <Rss className="w-3.5 h-3.5" />
                {rssCopied ? "Copied /feed.xml!" : "Copy RSS Feed URL"}
              </button>
              <a
                href="/feed.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-mono uppercase tracking-wider bg-[#0B0E14]/80 text-[#F3EFE6] hover:text-[#C5A059] transition-colors"
              >
                XML <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#8A6D3B]/40 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSeriesFilter("all");
              setToolFilter("all");
            }}
            className={`px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
              seriesFilter === "all" && toolFilter === "all"
                ? "border-[#C5A059] bg-[#C5A059]/20 text-[#F3EFE6]"
                : "border-[#8A6D3B]/40 text-[#94A3B8] hover:text-[#F3EFE6]"
            }`}
          >
            All Episodes ({episodes.length})
          </button>
          {weeklyCount > 0 && (
            <button
              onClick={() => setSeriesFilter("weekly_rollup")}
              className={`px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
                seriesFilter === "weekly_rollup"
                  ? "border-[#C5A059] bg-[#C5A059]/20 text-[#F3EFE6]"
                  : "border-[#8A6D3B]/40 text-[#94A3B8] hover:text-[#F3EFE6]"
              }`}
            >
              Weekly Ledger Roundups ({weeklyCount})
            </button>
          )}
          {weeklyCount > 0 && foundationalCount > 0 && (
            <button
              onClick={() => setSeriesFilter("legacy_archive")}
              className={`px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
                seriesFilter === "legacy_archive"
                  ? "border-[#C5A059] bg-[#C5A059]/20 text-[#F3EFE6]"
                  : "border-[#8A6D3B]/40 text-[#94A3B8] hover:text-[#F3EFE6]"
              }`}
            >
              Foundational Essays ({foundationalCount})
            </button>
          )}
          {[
            "The Square",
            "The Plumb",
            "The Level",
            "Common Gavel",
            "24-Inch Gauge",
            "The Trowel",
          ].map((tool) => {
            const count = episodes.filter((e) => e.dominantTool === tool).length;
            if (count === 0) return null;
            return (
              <button
                key={tool}
                onClick={() =>
                  setToolFilter((prev) => (prev === tool ? "all" : tool))
                }
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
                  toolFilter === tool
                    ? "border-[#C5A059] bg-[#C5A059]/20 text-[#F3EFE6]"
                    : "border-[#8A6D3B]/40 text-[#94A3B8] hover:text-[#F3EFE6]"
                }`}
              >
                {tool} ({count})
              </button>
            );
          })}
        </div>

        <span className="font-mono text-xs text-[#94A3B8]">
          Showing {filteredEpisodes.length} of {episodes.length} episodes
        </span>
      </div>

      {/* Episode List */}
      <div id="latest" className="space-y-6">
        {filteredEpisodes.map((ep) => {
          const isCurrent = currentEpisode?.id === ep.id;
          const isActivePlaying = isCurrent && isPlaying;
          const isTranscriptOpen = expandedTranscriptId === ep.id;
          const isTranscriptFullHeight = Boolean(fullHeightTranscriptIds[ep.id]);
          const isTranscriptCopied = copiedTranscriptId === ep.id;
          const toolSpec = getWorkingToolSpec(ep.dominantTool);
          const cleanCardHook = sanitizeEpisodeSummaryDefensive(ep.summary);
          const cleanExtendedNotes = ep.extendedNotes
            ? stripAiDisclaimers(ep.extendedNotes)
            : cleanCardHook;
          const formattedTranscript = formatTranscriptParagraphs(
            stripAiDisclaimers(ep.transcript)
          );
          const transcriptParagraphs = formattedTranscript
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean);
          const hasValidArtwork =
            Boolean(ep.artworkUrl) && !failedArtworkIds[ep.id];
          const hasValidWidescreen =
            Boolean(ep.artworkWidescreenUrl) && !failedWidescreenIds[ep.id];

          const directSourceLinks = (ep.externalSources || []).filter(
            (s) => Boolean(s.url)
          );
          const bibliographicRows = (ep.externalSources || []).filter(
            (s) => !s.url
          );

          return (
            <article
              key={ep.id}
              id={ep.slug}
              className={`rounded-none border transition-colors ${
                isCurrent
                  ? "border-[#C5A059] bg-[#131822]"
                  : "border-[#8A6D3B]/50 bg-[#131822]/85 hover:border-[#8A6D3B]"
              } p-6 sm:p-7 space-y-5`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-start gap-5 flex-1">
                  {/* Unified Square Episode Artwork / Copperplate Emblem Tile (Issue #37, Un-boxed inside card) */}
                  <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-none bg-[#0B0E14] overflow-hidden shadow-md relative">
                    {hasValidArtwork ? (
                      <img
                        src={ep.artworkUrl}
                        alt={`${ep.title} episode artwork`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() =>
                          setFailedArtworkIds((prev) => ({
                            ...prev,
                            [ep.id]: true,
                          }))
                        }
                      />
                    ) : (
                      <EpisodeArtworkEmblem
                        episodeNumber={ep.episodeNumber}
                        tool={ep.dominantTool}
                        series={ep.series}
                      />
                    )}
                  </div>

                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                      <span
                        className={`px-2 py-0.5 uppercase tracking-wider font-semibold ${
                          ep.series === "weekly_rollup"
                            ? "bg-[#C5A059]/20 text-[#C5A059]"
                            : "bg-[#8A6D3B]/20 text-[#F3EFE6]"
                        }`}
                      >
                        {ep.series === "weekly_rollup"
                          ? `WEEKLY LEDGER #${ep.episodeNumber}`
                          : `FOUNDATIONAL ESSAY #${ep.episodeNumber}`}
                      </span>
                      <span className="text-[#94A3B8]">
                        {new Date(ep.publishedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-[#8A6D3B]">•</span>
                      <span className="inline-flex items-center gap-1 text-[#C5A059]">
                        <Clock className="w-3.5 h-3.5" />
                        {ep.durationFormatted}
                      </span>
                      <span className="text-[#8A6D3B]">•</span>
                      <span className="text-[#F3EFE6]">
                        Tool: {toolSpec.id}
                      </span>
                      <span className="text-[#8A6D3B]">•</span>
                      <span className="text-[#D97706]">
                        {ep.dominantFailureMode}
                      </span>
                    </div>

                    <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] leading-snug">
                      {ep.title}
                    </h2>

                    <p className="font-serif text-sm text-[#F3EFE6]/85 leading-relaxed">
                      {cleanCardHook}
                    </p>
                  </div>
                </div>

                {/* Play & Episode Guide Controls */}
                <div className="flex sm:flex-row lg:flex-col items-stretch sm:items-center gap-2.5 shrink-0">
                  <button
                    onClick={() =>
                      isCurrent ? togglePlayPause() : playEpisode(ep)
                    }
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-mono text-xs uppercase tracking-widest font-semibold transition-colors cursor-pointer"
                  >
                    {isActivePlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        Pause Audio
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        Listen ({ep.durationFormatted})
                      </>
                    )}
                  </button>

                  <button
                    onClick={() =>
                      setExpandedTranscriptId(isTranscriptOpen ? null : ep.id)
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0B0E14]/85 hover:bg-[#0B0E14] text-xs font-mono uppercase tracking-wider text-[#F3EFE6] hover:text-[#C5A059] transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {isTranscriptOpen
                      ? "Hide Episode Guide"
                      : "Episode Guide & Transcript"}
                    {isTranscriptOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Incident Timestamp Markers (Jump-to-timecode on card) */}
              {ep.incidentMarkers.length > 0 && (
                <div className="pt-3 border-t border-[#8A6D3B]/25 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] mr-1">
                    Referenced Incidents:
                  </span>
                  {ep.incidentMarkers.map((marker) => (
                    <button
                      key={`${ep.id}-${marker.incidentId}`}
                      onClick={() =>
                        playEpisode(ep, marker.timestampSeconds)
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0B0E14]/80 hover:bg-[#C5A059]/15 text-xs font-mono text-[#F3EFE6] transition-colors cursor-pointer"
                    >
                      <span className="bg-[#C5A059]/15 text-[#C5A059] font-mono text-xs font-bold px-2 py-0.5 rounded-xs">
                        [{marker.timecodeLabel}]
                      </span>
                      <span>{marker.incidentCode}</span>
                      <span className="text-[#94A3B8] hidden sm:inline">
                        — {marker.incidentTitle}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Un-Boxed Episode Guide & Bounded Transcript Drawer (Issue #46) */}
              {isTranscriptOpen && (
                <div id="transcripts" className="space-y-6">
                  {/* Section 1: Extended Episode Overview & Key Takeaways */}
                  <div className="border-t border-[#8A6D3B]/30 pt-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs uppercase tracking-widest text-[#C5A059] inline-flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5" />
                        Episode Overview &amp; Key Takeaways
                      </span>
                      <span className="font-mono text-[11px] text-[#94A3B8]">
                        {ep.series === "weekly_rollup"
                          ? `Weekly Ledger Roundup #${ep.episodeNumber}`
                          : `Foundational Essay #${ep.episodeNumber}`}
                      </span>
                    </div>

                    {hasValidWidescreen && (
                      <div className="bg-[#0B0E14] overflow-hidden max-h-56">
                        <img
                          src={ep.artworkWidescreenUrl}
                          alt={`${ep.title} widescreen banner`}
                          className="w-full h-full object-cover max-h-56"
                          loading="lazy"
                          onError={() =>
                            setFailedWidescreenIds((prev) => ({
                              ...prev,
                              [ep.id]: true,
                            }))
                          }
                        />
                      </div>
                    )}

                    <div className="max-w-prose">
                      {renderExtendedNotesContent(cleanExtendedNotes)}
                    </div>
                  </div>

                  {/* Section 2 & 3 Grid: Source Pages on thecabcall.com + External Primary Sources */}
                  <div className="border-t border-[#8A6D3B]/30 pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Section 2: Source Pages on thecabcall.com */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-mono text-xs uppercase tracking-widest text-[#C5A059] inline-flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5" />
                          Source Pages on thecabcall.com
                        </h4>
                        <span className="font-mono text-[10px] text-[#94A3B8] uppercase">
                          Internal Ledger Links
                        </span>
                      </div>

                      <div className="divide-y divide-[#8A6D3B]/20">
                        {ep.incidentMarkers.map((marker) => (
                          <div
                            key={`drawer-inc-${ep.id}-${marker.incidentId}`}
                            className="flex items-center justify-between gap-3 py-2.5 transition-colors"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 font-mono text-[11px]">
                                <span className="text-[#C5A059] font-semibold">
                                  {marker.incidentCode}
                                </span>
                                <span className="text-[#8A6D3B]">•</span>
                                <span className="text-[#94A3B8]">
                                  {marker.toolApplied}
                                </span>
                              </div>
                              <Link
                                href={`/incidents/${marker.incidentSlug}`}
                                className="block font-serif text-sm text-[#F3EFE6] hover:text-[#C5A059] transition-colors truncate"
                              >
                                {marker.incidentTitle}
                              </Link>
                            </div>
                            <button
                              onClick={() =>
                                playEpisode(ep, marker.timestampSeconds)
                              }
                              className="shrink-0 bg-[#C5A059]/15 text-[#C5A059] hover:bg-[#C5A059]/25 font-mono text-xs font-bold px-2 py-0.5 rounded-xs transition-colors cursor-pointer"
                            >
                              [{marker.timecodeLabel}]
                            </button>
                          </div>
                        ))}

                        {(ep.sourcePages || []).map((page, pIdx) => (
                          <Link
                            key={`source-page-${ep.id}-${pIdx}`}
                            href={page.href}
                            className="flex items-center justify-between gap-3 py-2.5 transition-colors group"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                                {page.code && (
                                  <span className="text-[#C5A059] font-semibold">
                                    {page.code}
                                  </span>
                                )}
                                {page.sectionLabel && (
                                  <span className="text-[#94A3B8]">
                                    {page.sectionLabel}
                                  </span>
                                )}
                                {page.tool && (
                                  <>
                                    <span className="text-[#8A6D3B]">•</span>
                                    <span className="text-[#F3EFE6]/80">
                                      {page.tool}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="font-serif text-sm text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
                                {page.title}
                              </div>
                            </div>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059] shrink-0">
                              Read →
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: External Primary Sources & Research Dossiers */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-mono text-xs uppercase tracking-widest text-[#C5A059] inline-flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          External Primary Sources &amp; Dossiers
                        </h4>
                        <span className="font-mono text-[10px] text-[#94A3B8] uppercase">
                          {(ep.externalSources || []).length > 0
                            ? `${(ep.externalSources || []).length} Referenced`
                            : "Curated Ledger"}
                        </span>
                      </div>

                      {directSourceLinks.length > 0 ? (
                        <div className="divide-y divide-[#8A6D3B]/20">
                          {directSourceLinks.map((src, sIdx) => (
                            <a
                              key={`ext-src-${ep.id}-${sIdx}`}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-3 py-2.5 transition-colors group"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059]">
                                  {src.sourceType || "Primary Research Dossier"}
                                </div>
                                <div className="font-serif text-sm text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
                                  {src.title}
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="font-serif text-xs text-[#94A3B8] leading-relaxed">
                          Synthesized directly from verified dispatches on the
                          Trestleboard incident ledger and the canonical Working
                          Tools rubric.
                        </p>
                      )}

                      {bibliographicRows.length > 0 && (
                        <div className="pt-2 space-y-2">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8]">
                            Source Classification Bibliography ({bibliographicRows.length} Works)
                          </div>
                          <div className="max-h-60 overflow-y-auto bg-[#0B0E14]/50">
                            <table className="w-full text-left border-collapse">
                              <thead className="sticky top-0 bg-[#131822] border-b border-[#8A6D3B]/30 font-mono text-[10px] uppercase tracking-wider text-[#C5A059]">
                                <tr>
                                  <th className="py-1.5 px-2.5">Source Title</th>
                                  <th className="py-1.5 px-2">Date</th>
                                  <th className="py-1.5 px-2.5">Author / Authority</th>
                                  <th className="py-1.5 px-2">Classification</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#8A6D3B]/20 font-serif text-xs text-[#F3EFE6]/85">
                                {bibliographicRows.map((row, rIdx) => (
                                  <tr key={`bib-${ep.id}-${rIdx}`} className="hover:bg-[#0B0E14]/50">
                                    <td className="py-1.5 px-2.5 font-medium text-[#F3EFE6]">
                                      {row.title}
                                    </td>
                                    <td className="py-1.5 px-2 font-mono text-[11px] text-[#94A3B8] whitespace-nowrap">
                                      {row.publicationDate || "—"}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-[#94A3B8]">
                                      {row.author || "—"}
                                    </td>
                                    <td className="py-1.5 px-2 font-mono text-[10px] text-[#C5A059]">
                                      {row.sourceType || "Reference"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 4: Bounded Full Episode Transcript Reader */}
                  <div className="border-t border-[#8A6D3B]/30 pt-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs uppercase tracking-widest text-[#C5A059] block">
                          Full Episode Transcript
                        </span>
                        <span className="font-mono text-[11px] text-[#94A3B8] block">
                          Episode #{ep.episodeNumber} • {ep.durationFormatted} •{" "}
                          {transcriptParagraphs.length} Paragraphs
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            copyEpisodeTranscript(ep.id, formattedTranscript)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B0E14]/85 hover:bg-[#0B0E14] font-mono text-xs uppercase tracking-wider text-[#F3EFE6] hover:text-[#C5A059] transition-colors cursor-pointer"
                        >
                          {isTranscriptCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                              Copied Transcript!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#C5A059]" />
                              Copy Transcript
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleTranscriptFullHeight(ep.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B0E14]/85 hover:bg-[#0B0E14] font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors cursor-pointer"
                        >
                          {isTranscriptFullHeight ? (
                            <>
                              <Minimize2 className="w-3.5 h-3.5" />
                              Collapse Height
                            </>
                          ) : (
                            <>
                              <Maximize2 className="w-3.5 h-3.5" />
                              Expand Full Height
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {ep.transcriptSections && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => playEpisode(ep, 0)}
                          className="inline-flex items-center gap-1.5 bg-[#0B0E14]/80 hover:bg-[#C5A059]/15 px-2.5 py-1 text-xs font-mono text-[#F3EFE6] transition-colors cursor-pointer"
                        >
                          <span className="bg-[#C5A059]/15 text-[#C5A059] font-mono text-xs font-bold px-2 py-0.5 rounded-xs">
                            [00:00]
                          </span>
                          <span>1. The Week&apos;s Trestleboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => playEpisode(ep, 75)}
                          className="inline-flex items-center gap-1.5 bg-[#0B0E14]/80 hover:bg-[#C5A059]/15 px-2.5 py-1 text-xs font-mono text-[#F3EFE6] transition-colors cursor-pointer"
                        >
                          <span className="bg-[#C5A059]/15 text-[#C5A059] font-mono text-xs font-bold px-2 py-0.5 rounded-xs">
                            [01:15]
                          </span>
                          <span>2. Separating Signal from Panic</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => playEpisode(ep, 210)}
                          className="inline-flex items-center gap-1.5 bg-[#0B0E14]/80 hover:bg-[#C5A059]/15 px-2.5 py-1 text-xs font-mono text-[#F3EFE6] transition-colors cursor-pointer"
                        >
                          <span className="bg-[#C5A059]/15 text-[#C5A059] font-mono text-xs font-bold px-2 py-0.5 rounded-xs">
                            [03:30]
                          </span>
                          <span>3. Forward Posture</span>
                        </button>
                      </div>
                    )}

                    <div className="relative">
                      <div
                        className={`${
                          isTranscriptFullHeight
                            ? ""
                            : "max-h-[480px] overflow-y-auto pr-2"
                        } max-w-prose space-y-4`}
                      >
                        {transcriptParagraphs.map((paragraph, pIdx) => {
                          const tokens = tokenizeTranscriptParagraph(paragraph);
                          return (
                            <p
                              key={`para-${ep.id}-${pIdx}`}
                              className="font-serif text-sm sm:text-[15px] text-[#F3EFE6]/85 leading-relaxed"
                            >
                              {tokens.map((token, tIdx) => {
                                if (token.type === "timestamp") {
                                  return (
                                    <button
                                      key={`tok-${ep.id}-${pIdx}-${tIdx}`}
                                      type="button"
                                      onClick={() =>
                                        playEpisode(ep, token.seconds ?? 0)
                                      }
                                      title={`Jump audio to ${token.value}`}
                                      className="inline-flex items-center bg-[#C5A059]/15 text-[#C5A059] hover:bg-[#C5A059]/25 font-mono text-xs font-bold px-2 py-0.5 rounded-xs mr-1.5 transition-colors cursor-pointer"
                                    >
                                      {token.value}
                                    </button>
                                  );
                                }
                                if (token.type === "speaker") {
                                  return (
                                    <span
                                      key={`tok-${ep.id}-${pIdx}-${tIdx}`}
                                      className="font-mono text-xs uppercase tracking-wider text-[#C5A059] font-semibold mr-1.5"
                                    >
                                      {token.value}
                                    </span>
                                  );
                                }
                                return (
                                  <React.Fragment
                                    key={`tok-${ep.id}-${pIdx}-${tIdx}`}
                                  >
                                    {token.value}
                                  </React.Fragment>
                                );
                              })}
                            </p>
                          );
                        })}
                      </div>

                      {!isTranscriptFullHeight &&
                        transcriptParagraphs.length > 4 && (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#131822] via-[#131822]/80 to-transparent"
                          />
                        )}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Single Page-Level Production Colophon (Issue #36) */}
      <footer className="rounded-none border border-[#8A6D3B]/40 bg-[#0B0E14]/80 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SquareAndCompassesCrest className="w-7 h-7 shrink-0 opacity-85" />
          <p className="font-serif text-xs text-[#94A3B8] leading-relaxed">
            {CANONICAL_PODCAST_AI_COLOPHON}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <WorkingToolEngraving
            tool="The Square"
            className="w-10 h-7 opacity-75"
          />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
            Verified Archive
          </span>
        </div>
      </footer>
    </div>
  );
}
