"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pause,
  Play,
  Radio,
  RotateCcw,
  Volume2,
  X,
  ExternalLink,
} from "lucide-react";
import { useTelemetry } from "./TelemetryContext";

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function PersistentAudioPlayer() {
  const router = useRouter();
  const {
    activeEpisode,
    isPlaying,
    currentTime,
    playbackRate,
    isDockVisible,
    togglePlayPause,
    seekTo,
    cyclePlaybackRate,
    closeDock,
  } = useTelemetry();

  if (!isDockVisible) return null;

  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      (currentTime / Math.max(1, activeEpisode.durationSeconds)) * 100
    )
  );

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0E14]/95 backdrop-blur-md border-t border-[#C5A059]/45 shadow-[0_-8px_30px_rgba(0,0,0,0.85)]"
      role="region"
      aria-label="Persistent CAB Telemetry Audio Player"
    >
      {/* Top hairline brass accent */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#C5A059]/60 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center gap-3 md:gap-5">
        {/* Left: Controls & Active Episode Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <button
              onClick={togglePlayPause}
              className="w-9 h-9 flex items-center justify-center border border-[#C5A059] bg-[#111726] text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0B0E14] transition-colors cursor-pointer shrink-0"
              aria-label={isPlaying ? "Pause episode" : "Play episode"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>
            <button
              onClick={() => seekTo(Math.max(0, currentTime - 15))}
              className="p-1.5 text-[#94A3B8] hover:text-[#F3EFE6] transition-colors cursor-pointer"
              title="Rewind 15s"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="min-w-0 flex-1 md:max-w-[270px]">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                {activeEpisode.series === "weekly_rollup"
                  ? `CAB BRIEF #${activeEpisode.episodeNumber}`
                  : `ARCHIVE #${activeEpisode.episodeNumber}`}
              </span>
              <span className="font-mono text-[10px] text-[#10B981]">
                {activeEpisode.dominantTool}
              </span>
            </div>
            <p className="text-xs text-[#F3EFE6] truncate font-medium mt-0.5">
              {activeEpisode.title}
            </p>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={cyclePlaybackRate}
              className="font-mono text-[11px] px-1.5 py-0.5 border border-[#8A6D3B]/60 text-[#C5A059]"
            >
              {playbackRate}x
            </button>
            <button
              onClick={closeDock}
              className="p-1 text-[#94A3B8] hover:text-[#F3EFE6]"
              aria-label="Minimize player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Timeline Scrubber + Clickable Incident Markers */}
        <div className="flex-1 w-full flex flex-col gap-1.5">
          <div className="relative flex items-center gap-3">
            <span className="font-mono text-[11px] text-[#C5A059] w-11 text-right shrink-0">
              {formatSeconds(currentTime)}
            </span>

            <div
              className="relative flex-1 h-2 bg-[#111726] border border-[#8A6D3B]/40 cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                seekTo(Math.round(ratio * activeEpisode.durationSeconds));
              }}
            >
              {/* Progress Fill */}
              <div
                className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#8A6D3B] to-[#C5A059] transition-all"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Incident Markers on Timeline */}
              {activeEpisode.incidentMarkers.map((marker) => {
                const leftPct = Math.min(
                  96,
                  Math.max(
                    3,
                    (marker.timestampSeconds /
                      Math.max(1, activeEpisode.durationSeconds)) *
                      100
                  )
                );
                return (
                  <button
                    key={`${marker.incidentId}-${marker.timestampSeconds}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(marker.timestampSeconds);
                      router.push(`/incidents/${marker.incidentSlug}`);
                    }}
                    style={{ left: `${leftPct}%` }}
                    className="absolute -top-1.5 -translate-x-1/2 w-2.5 h-4 bg-[#0B0E14] border border-[#C5A059] hover:bg-[#C5A059] transition-colors z-10 cursor-pointer"
                    title={`${marker.timecodeLabel} — ${marker.incidentCode}: ${marker.incidentTitle} (Click to open Incident Brief)`}
                  />
                );
              })}
            </div>

            <span className="font-mono text-[11px] text-[#94A3B8] w-11 shrink-0">
              {formatSeconds(activeEpisode.durationSeconds)}
            </span>
          </div>

          {/* Clickable Incident Marker Pills below timeline */}
          {activeEpisode.incidentMarkers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="text-[#94A3B8] uppercase tracking-wider">
                Incident Markers:
              </span>
              {activeEpisode.incidentMarkers.map((marker) => (
                <button
                  key={`${marker.incidentCode}-${marker.timecodeLabel}`}
                  type="button"
                  onClick={() => {
                    seekTo(marker.timestampSeconds);
                    router.push(`/incidents/${marker.incidentSlug}`);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#111726] border border-[#8A6D3B]/50 text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors cursor-pointer"
                >
                  <span className="text-[#C5A059]">{marker.timecodeLabel}</span>
                  <span>{marker.incidentCode}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Speed, Archive Link, Close */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 text-[#94A3B8] text-xs font-mono">
            <Volume2 className="w-3.5 h-3.5 text-[#C5A059]" />
          </div>
          <button
            onClick={cyclePlaybackRate}
            className="font-mono text-xs px-2 py-1 bg-[#111726] border border-[#8A6D3B]/60 text-[#C5A059] hover:border-[#C5A059] cursor-pointer"
            title="Cycle playback speed"
          >
            {playbackRate}x
          </button>
          <Link
            href="/archive"
            className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 bg-[#111726] border border-[#8A6D3B]/50 text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
          >
            Transcript
          </Link>
          <button
            onClick={closeDock}
            className="p-1 text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer"
            aria-label="Close persistent audio player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
