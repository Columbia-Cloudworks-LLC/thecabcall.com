"use client";

import React from "react";
import Link from "next/link";
import {
  Pause,
  Play,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
import { isRenderablePublicEpisode } from "@/lib/dto";
import { useTelemetry } from "./TelemetryContext";

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function PersistentAudioPlayer() {
  const {
    activeEpisode,
    isPlaying,
    currentTime,
    playbackRate,
    isDockVisible,
    audioRef,
    togglePlayPause,
    seekTo,
    cyclePlaybackRate,
    closeDock,
  } = useTelemetry();

  // Defensive rendering gate: suppress player if episode lacks verified audio or metadata
  if (!activeEpisode || !isRenderablePublicEpisode(activeEpisode)) {
    return null;
  }

  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      (currentTime / Math.max(1, activeEpisode.durationSeconds)) * 100
    )
  );

  return (
    <>
      {/* Persistent HTML5 <audio> element for byte-range streaming from /audio/:filename */}
      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        aria-hidden="true"
      />

      {isDockVisible && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0E14]/95 backdrop-blur-md border-t border-[#C5A059]/45 shadow-[0_-8px_30px_rgba(0,0,0,0.85)]"
          role="region"
          aria-label="The CAB Call Audio Player"
        >
          {/* Top hairline brass accent */}
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#C5A059]/60 to-transparent" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center gap-3 md:gap-5">
            {/* Left: Controls & Active Episode Title */}
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

              <div className="min-w-0 flex-1 md:max-w-[340px]">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] flex items-center gap-2">
                  <span>
                    THE CAB CALL // EPISODE #{activeEpisode.episodeNumber}
                  </span>
                </div>
                <p className="font-serif text-xs text-[#F3EFE6] truncate mt-0.5">
                  {activeEpisode.title}
                </p>
              </div>

              <div className="flex md:hidden items-center gap-2">
                <button
                  onClick={closeDock}
                  className="p-1 text-[#94A3B8] hover:text-[#F3EFE6]"
                  aria-label="Close player"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Center: Clean Progress Bar */}
            <div className="flex-1 w-full flex items-center gap-3">
              <span className="font-mono text-[11px] text-[#C5A059] w-11 text-right shrink-0">
                {formatSeconds(currentTime)}
              </span>

              <div
                className="relative flex-1 h-2 bg-[#111726] border border-[#8A6D3B]/40 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  seekTo(Math.round(ratio * activeEpisode.durationSeconds));
                }}
              >
                <div
                  className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#8A6D3B] to-[#C5A059] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <span className="font-mono text-[11px] text-[#94A3B8] w-11 shrink-0">
                {formatSeconds(activeEpisode.durationSeconds)}
              </span>
            </div>

            {/* Right: Speed, Direct Audio Link, Transcript Link & Close */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <Volume2 className="w-3.5 h-3.5 text-[#C5A059]" />
              <button
                onClick={cyclePlaybackRate}
                className="font-mono text-xs px-2 py-1 bg-[#111726] border border-[#8A6D3B]/60 text-[#C5A059] hover:border-[#C5A059] cursor-pointer"
                title="Cycle playback speed"
              >
                {playbackRate === 1
                  ? "1.0x"
                  : playbackRate === 1.25
                  ? "1.25x"
                  : "1.5x"}
              </button>
              <Link
                href="/archive"
                className="font-serif text-xs px-2.5 py-1 bg-[#111726] border border-[#8A6D3B]/50 text-[#F3EFE6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
              >
                Read Full Transcript →
              </Link>
              <button
                onClick={closeDock}
                className="p-1 text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer"
                aria-label="Close audio player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
