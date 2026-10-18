"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Rss,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Radio,
  Info,
} from "lucide-react";
import {
  formatCraftLedgerEntry,
  isRenderablePublicEpisode,
  mapDtoToCraftLexicon,
  PublicEpisodeDto,
} from "@/lib/dto";
import { PodcastEpisode } from "@/lib/types";
import { useTelemetry } from "./TelemetryContext";
import { BrassSectionDivider } from "./MasonicEngravings";

export function PodcastArchiveClient({
  initialEpisodes,
}: {
  initialEpisodes: Array<PublicEpisodeDto | PodcastEpisode>;
}) {
  const {
    activeEpisode,
    isPlaying,
    playEpisode,
    togglePlayPause,
    openRubricInspector,
  } = useTelemetry();

  const [episodes, setEpisodes] = useState<Array<PublicEpisodeDto | PodcastEpisode>>(
    initialEpisodes
      .map((ep) => mapDtoToCraftLexicon(ep))
      .filter((ep) => isRenderablePublicEpisode(ep))
  );
  const [seriesFilter, setSeriesFilter] = useState<
    "all" | "weekly_rollup" | "legacy_archive"
  >("all");
  const [expandedTranscripts, setExpandedTranscripts] = useState<
    Record<string, boolean>
  >({ [initialEpisodes[0]?.id || ""]: true });
  const [copiedFeed, setCopiedFeed] = useState(false);

  const feedUrl = "https://thecabcall.com/feed.xml";

  const handleCopyFeed = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(feedUrl);
      setCopiedFeed(true);
      setTimeout(() => setCopiedFeed(false), 2500);
    }
  };

  const validEpisodes = episodes.filter((ep) => isRenderablePublicEpisode(ep));
  const filteredEpisodes = validEpisodes.filter((ep) =>
    seriesFilter === "all" ? true : ep.series === seriesFilter
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header & Direct RSS Subscription Block */}
      <div className="tracing-board-frame p-6 sm:p-8 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              THE CAB CALL ARCHIVE // PODCAST HUB &amp; TRANSCRIPTS
            </span>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#F3EFE6]">
              Change Advisory Board Audio &amp; Rollup Ledger
            </h1>
            <p className="font-serif text-sm sm:text-base text-[#94A3B8] leading-relaxed">
              Housing both the automated 5-minute Friday{" "}
              <strong className="text-[#F3EFE6]">CAB Weekly Brief</strong>{" "}
              retrospectives (~750 words, strictly governed by the Zero Definitions and Epistemic Humility rules) and the original full-length{" "}
              <strong className="text-[#F3EFE6]">Legacy Deep-Dive Archive</strong>.
            </p>
          </div>

          {/* Direct RSS Subscription Block */}
          <div className="lg:col-span-5 p-5 bg-[#0B0E14] border border-[#C5A059]/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#C5A059]">
                <Rss className="w-4 h-4" />
                <span>Direct RSS 2.0 Podcast Feed</span>
              </span>
              <span className="font-mono text-[10px] text-[#C5A059]">
                SYNDICATED XML
              </span>
            </div>

            <div className="flex items-center bg-[#111726] border border-[#8A6D3B]/50 p-1.5">
              <code className="font-mono text-xs text-[#F3EFE6] px-2 flex-1 truncate">
                {feedUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyFeed}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-semibold hover:bg-[#d6b36a] transition-colors cursor-pointer shrink-0"
              >
                {copiedFeed ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
              <a
                href="/feed.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 bg-[#111726] border border-[#8A6D3B]/45 text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
              >
                Raw RSS XML
              </a>
              <a
                href="https://podcasts.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 bg-[#111726] border border-[#8A6D3B]/45 text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
              >
                Apple Podcasts
              </a>
              <a
                href="https://open.spotify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 bg-[#111726] border border-[#8A6D3B]/45 text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
              >
                Spotify Feed
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Series Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setSeriesFilter("all")}
            className={`px-4 py-2 border cursor-pointer ${
              seriesFilter === "all"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#111726] text-[#94A3B8] border-[#8A6D3B]/45 hover:text-[#F3EFE6]"
            }`}
          >
            All Episodes ({episodes.length})
          </button>
          <button
            type="button"
            onClick={() => setSeriesFilter("weekly_rollup")}
            className={`px-4 py-2 border cursor-pointer ${
              seriesFilter === "weekly_rollup"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#111726] text-[#94A3B8] border-[#8A6D3B]/45 hover:text-[#F3EFE6]"
            }`}
          >
            Weekly Trestleboard Briefs (5-Min) (
            {episodes.filter((e) => e.series === "weekly_rollup").length})
          </button>
          <button
            type="button"
            onClick={() => setSeriesFilter("legacy_archive")}
            className={`px-4 py-2 border cursor-pointer ${
              seriesFilter === "legacy_archive"
                ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                : "bg-[#111726] text-[#94A3B8] border-[#8A6D3B]/45 hover:text-[#F3EFE6]"
            }`}
          >
            Legacy Deep-Dive Archive (
            {episodes.filter((e) => e.series === "legacy_archive").length})
          </button>
        </div>

        <span className="font-mono text-xs text-[#94A3B8]">
          Click Play on any episode to dock to the persistent bottom player
        </span>
      </div>

      <BrassSectionDivider label="EPISODE DIRECTORY & VERIFIED TRANSCRIPTS" />

      {/* Episode Directory */}
      <div className="space-y-6">
        {filteredEpisodes.map((ep) => {
          const isCurrent = activeEpisode.id === ep.id;
          const isExpanded = !!expandedTranscripts[ep.id];

          const aiDisclaimerText =
            ep.aiDisclaimer ||
            (ep.series === "legacy_archive"
              ? "Disclaimer: The media and artwork for this episode were generated by AI using Google Gemini."
              : null);

          return (
            <article
              key={ep.id}
              id={ep.slug}
              className="tracing-board-frame p-6 sm:p-7 space-y-5"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                {ep.artworkUrl && (
                  <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ep.artworkUrl}
                      alt={`Artwork for ${ep.title}`}
                      loading="lazy"
                      className="w-28 h-28 sm:w-32 sm:h-32 object-cover border border-[#C5A059]/60 bg-[#0B0E14]"
                    />
                  </div>
                )}

                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
                    <span
                      className={`px-2.5 py-0.5 font-semibold uppercase ${
                        ep.series === "weekly_rollup"
                          ? "bg-[#C5A059] text-[#0B0E14]"
                          : "bg-[#0B0E14] text-[#C5A059] border border-[#C5A059]/60"
                      }`}
                    >
                      {ep.series === "weekly_rollup"
                        ? `5-MIN WEEKLY BRIEF #${ep.episodeNumber}`
                        : `LEGACY ARCHIVE #${ep.episodeNumber}`}
                    </span>
                    <span className="text-[#94A3B8]">
                      {ep.publishedAt.slice(0, 10)}
                    </span>
                    <span className="text-[#8A6D3B]">•</span>
                    <span className="text-[#F3EFE6]">
                      Duration: {ep.durationFormatted}
                    </span>
                    <span className="text-[#8A6D3B]">•</span>
                    <button
                      type="button"
                      onClick={() =>
                        openRubricInspector({ tool: ep.dominantTool })
                      }
                      title={`View Tool Guide for ${ep.dominantTool}`}
                      className="inline-flex items-center gap-1.5 text-[#C5A059] hover:underline cursor-pointer"
                    >
                      <span>Dominant Tool: {ep.dominantTool}</span>
                      <Info className="w-3.5 h-3.5 opacity-85" />
                    </button>
                  </div>

                  <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6]">
                    {ep.title}
                  </h2>

                  <p className="font-serif text-sm sm:text-base text-[#F3EFE6]/85 leading-relaxed whitespace-pre-line">
                    {ep.summary}
                  </p>

                  {aiDisclaimerText && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0B0E14] border border-[#C5A059]/45 font-mono text-xs text-[#C5A059]">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#C5A059]" />
                      <span>{aiDisclaimerText}</span>
                    </div>
                  )}
                </div>

                {/* Inline Audio Player Controls */}
                <div className="flex items-center gap-3 shrink-0 lg:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) {
                        togglePlayPause();
                      } else {
                        playEpisode(ep, 0);
                      }
                    }}
                    className="inline-flex items-center gap-2.5 px-5 py-3 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#d6b36a] transition-colors cursor-pointer"
                  >
                    {isCurrent && isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>Pause Episode</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Play Episode ({ep.durationFormatted})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTranscripts((prev) => ({
                        ...prev,
                        [ep.id]: !prev[ep.id],
                      }))
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-3 bg-[#0B0E14] border border-[#8A6D3B]/60 font-mono text-xs text-[#F3EFE6] hover:border-[#C5A059] cursor-pointer"
                  >
                    <span>{isExpanded ? "Hide Script" : "Read Script"}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#C5A059]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#C5A059]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Underlying Incident Briefs Referenced in Episode */}
              {ep.incidentMarkers.length > 0 && (
                <div className="pt-3 border-t border-[#8A6D3B]/35 flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="text-[#94A3B8] uppercase">
                    Referenced Cases on the Trestleboard:
                  </span>
                  {ep.incidentMarkers.map((marker) => (
                    <div
                      key={`${ep.id}-${marker.incidentId}`}
                      className="inline-flex items-center bg-[#0B0E14] border border-[#8A6D3B]/50"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          playEpisode(ep, marker.timestampSeconds)
                        }
                        className="px-2 py-1 text-[#C5A059] hover:bg-[#C5A059]/15 border-r border-[#8A6D3B]/40 cursor-pointer"
                        title={`Play from ${marker.timecodeLabel}`}
                      >
                        ▶ {marker.timecodeLabel}
                      </button>
                      <Link
                        href={`/incidents/${marker.incidentSlug}`}
                        className="px-2.5 py-1 text-[#F3EFE6] hover:text-[#C5A059] inline-flex items-center gap-1"
                      >
                        <span className="text-[#94A3B8]">
                          {formatCraftLedgerEntry(marker.incidentCode)}:
                        </span>
                        <span className="truncate max-w-[210px]">
                          {marker.incidentTitle}
                        </span>
                        <ExternalLink className="w-3 h-3 opacity-75" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Collapsible Full Transcript */}
              {isExpanded && (
                <div className="pt-4 border-t border-[#C5A059]/35 space-y-4">
                  {ep.artworkWidescreenUrl && (
                    <div className="overflow-hidden border border-[#8A6D3B]/45 bg-[#0B0E14]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ep.artworkWidescreenUrl}
                        alt={`Widescreen banner for ${ep.title}`}
                        loading="lazy"
                        className="w-full max-h-72 object-cover"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between font-mono text-xs text-[#C5A059]">
                    <span className="inline-flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5" />
                      <span>
                        VERIFIED EPISODE TRANSCRIPT //{" "}
                        {ep.series === "weekly_rollup"
                          ? "3-PART FRIDAY CAB RUNBOOK (~750 WORDS)"
                          : "LEGACY ARCHIVE RECORD"}
                      </span>
                    </span>
                    <span className="text-[#94A3B8]">
                      {ep.series === "weekly_rollup"
                        ? "ZERO DEFINITIONS RULE ENFORCED"
                        : "GENERATED BY AI USING GOOGLE GEMINI"}
                    </span>
                  </div>

                  {ep.transcriptSections ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45 space-y-2">
                        <div className="font-mono text-xs text-[#C5A059] uppercase">
                          1. The Week&apos;s Trestleboard (0:00 – 1:15)
                        </div>
                        <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                          {ep.transcriptSections.weeklyTelemetry}
                        </p>
                      </div>
                      <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45 space-y-2">
                        <div className="font-mono text-xs text-[#F59E0B] uppercase">
                          2. Separating Signal from Panic (1:15 – 3:30)
                        </div>
                        <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                          {ep.transcriptSections.separatingSignalFromPanic}
                        </p>
                      </div>
                      <div className="p-4 bg-[#0B0E14] border border-[#C5A059]/60 space-y-2">
                        <div className="font-mono text-xs text-[#10B981] uppercase">
                          3. The Forward Posture (3:30 – 5:00)
                        </div>
                        <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                          {ep.transcriptSections.forwardPosture}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 bg-[#0B0E14] border border-[#8A6D3B]/45 font-serif text-sm sm:text-base text-[#F3EFE6]/90 whitespace-pre-line leading-relaxed max-h-[540px] overflow-y-auto">
                      {ep.transcript}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
