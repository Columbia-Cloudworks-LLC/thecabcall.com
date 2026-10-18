"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  PublicEpisodeDto,
  isRenderablePublicEpisode,
} from "@/lib/dto";
import { INITIAL_EPISODES } from "@/lib/seed-data";
import { SreFailureModeId, WorkingToolId } from "@/lib/taxonomy";
import { PodcastEpisode } from "@/lib/types";

interface TelemetryContextValue {
  // Persistent Audio Player state
  activeEpisode: PublicEpisodeDto | PodcastEpisode;
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  isDockVisible: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playEpisode: (
    episode: PublicEpisodeDto | PodcastEpisode,
    startSeconds?: number
  ) => void;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => void;
  cyclePlaybackRate: () => void;
  closeDock: () => void;
  refreshTelemetry: () => Promise<void>;

  // Slide-Over Rubric Inspection Drawer state
  inspectedTool: WorkingToolId | null;
  inspectedFailureMode: SreFailureModeId | null;
  openRubricInspector: (opts: {
    tool?: WorkingToolId;
    failureMode?: SreFailureModeId;
  }) => void;
  closeRubricInspector: () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({
  children,
  initialEpisode,
}: {
  children: React.ReactNode;
  initialEpisode?: PublicEpisodeDto | PodcastEpisode;
}) {
  const [activeEpisode, setActiveEpisode] = useState<
    PublicEpisodeDto | PodcastEpisode
  >(initialEpisode || INITIAL_EPISODES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDockVisible, setIsDockVisible] = useState(false);

  const [inspectedTool, setInspectedTool] = useState<WorkingToolId | null>(
    null
  );
  const [inspectedFailureMode, setInspectedFailureMode] =
    useState<SreFailureModeId | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Fetch latest live D1 episode from /api/telemetry on mount (and on manual refresh)
  const refreshTelemetry = useCallback(async () => {
    try {
      const res = await fetch("/api/telemetry", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.episodes) && data.episodes.length > 0) {
        const latestEp = data.episodes.find((ep: unknown) =>
          isRenderablePublicEpisode(ep as PodcastEpisode)
        ) as PublicEpisodeDto | undefined;
        if (!latestEp) return;
        setActiveEpisode((prev) => {
          // If not currently playing another episode, or if prev is the seed default, switch to newest D1 episode
          if (!isPlayingRef.current || prev.id === latestEp.id) {
            return latestEp;
          }
          return prev;
        });
      }
    } catch {
      // Ignore network error during background refresh
    }
  }, []);

  useEffect(() => {
    refreshTelemetry();
  }, [refreshTelemetry]);

  // Determine whether an episode has a real recorded audio stream (.m4a or >25KB .mp3)
  // vs. a tiny synthetic MPEG-framed stub requiring Web Speech fallback.
  const isRealAudioRecording = useCallback(
    (episode: PublicEpisodeDto | PodcastEpisode): boolean => {
      if (!episode?.audioUrl) return false;
      if (episode.audioUrl.toLowerCase().endsWith(".m4a")) return true;
      if (episode.series === "legacy_archive") return true;
      if (typeof episode.fileSizeBytes === "number" && episode.fileSizeBytes > 25000) {
        return true;
      }
      return false;
    },
    []
  );

  // Stop Web Speech synthesis helper
  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Stop HTML5 <audio> playback helper
  const pauseAudioElement = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // ignore
      }
    }
  }, []);

  // Start Web Speech narration from the transcript corresponding to currentTime (fallback only for synthetic stubs)
  const startSpeechFromOffset = useCallback(
    (
      episode: PublicEpisodeDto | PodcastEpisode,
      seconds: number,
      rate: number
    ) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      window.speechSynthesis.cancel();
      if (isRealAudioRecording(episode)) {
        return;
      }
      const cleanText = episode.transcript.replace(/\[.*?\]/g, "").trim();
      const ratio = Math.min(
        0.95,
        Math.max(0, seconds / Math.max(1, episode.durationSeconds))
      );
      const startIndex = Math.floor(cleanText.length * ratio);
      const slice = cleanText.slice(startIndex);
      if (!slice) return;

      const utterance = new SpeechSynthesisUtterance(slice);
      utterance.rate = rate;
      utterance.pitch = 0.92;
      window.speechSynthesis.speak(utterance);
    },
    [isRealAudioRecording]
  );

  // Start or sync HTML5 <audio> element from offset
  const playAudioElement = useCallback(
    (
      episode: PublicEpisodeDto | PodcastEpisode,
      seconds: number,
      rate: number
    ) => {
      const el = audioRef.current;
      if (!el || !episode.audioUrl) return;
      try {
        const currentEpId = el.getAttribute("data-episode-id");
        const isNewSource =
          currentEpId !== episode.id ||
          (!el.src.endsWith(episode.audioUrl) && el.src !== episode.audioUrl);

        if (isNewSource) {
          el.setAttribute("data-episode-id", episode.id);
          el.src = episode.audioUrl;
          el.load();
        }

        el.playbackRate = rate;

        const applySeekAndPlay = () => {
          try {
            el.playbackRate = rate;
            if (seconds > 0) {
              el.currentTime = seconds;
            } else if (isNewSource) {
              el.currentTime = 0;
            }
          } catch {
            // ignore seek before ready
          }
          const playPromise = el.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch((err) => {
              console.warn("[Audio Player] HTML5 audio playback error:", err);
            });
          }
        };

        if (isNewSource && seconds > 0 && el.readyState < 1) {
          el.addEventListener("loadedmetadata", applySeekAndPlay, {
            once: true,
          });
        } else {
          applySeekAndPlay();
        }
      } catch {
        // ignore audio element error
      }
    },
    []
  );

  // Sync HTML5 <audio> timeupdate and ended events for real audio recordings
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const handleTimeUpdate = () => {
      if (isRealAudioRecording(activeEpisode) && !el.paused) {
        setCurrentTime(Math.floor(el.currentTime));
      }
    };

    const handleEnded = () => {
      if (isRealAudioRecording(activeEpisode)) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };

    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("ended", handleEnded);
    return () => {
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("ended", handleEnded);
    };
  }, [activeEpisode, isRealAudioRecording]);

  useEffect(() => {
    if (isPlaying && !isRealAudioRecording(activeEpisode)) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev + 1 >= activeEpisode.durationSeconds) {
            setIsPlaying(false);
            stopSpeech();
            pauseAudioElement();
            return 0;
          }
          return prev + 1;
        });
      }, Math.round(1000 / playbackRate));
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    isPlaying,
    playbackRate,
    activeEpisode,
    isRealAudioRecording,
    stopSpeech,
    pauseAudioElement,
  ]);

  const playEpisode = useCallback(
    (episode: PublicEpisodeDto | PodcastEpisode, startSeconds = 0) => {
      if (!isRenderablePublicEpisode(episode)) {
        return;
      }
      stopSpeech();
      setActiveEpisode(episode);
      setCurrentTime(startSeconds);
      setIsDockVisible(true);
      setIsPlaying(true);
      playAudioElement(episode, startSeconds, playbackRate);
      if (!isRealAudioRecording(episode)) {
        startSpeechFromOffset(episode, startSeconds, playbackRate);
      }
    },
    [
      playbackRate,
      playAudioElement,
      startSpeechFromOffset,
      stopSpeech,
      isRealAudioRecording,
    ]
  );

  const togglePlayPause = useCallback(() => {
    setIsDockVisible(true);
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        stopSpeech();
        playAudioElement(activeEpisode, currentTime, playbackRate);
        if (!isRealAudioRecording(activeEpisode)) {
          startSpeechFromOffset(activeEpisode, currentTime, playbackRate);
        }
      } else {
        pauseAudioElement();
        stopSpeech();
      }
      return next;
    });
  }, [
    activeEpisode,
    currentTime,
    playbackRate,
    playAudioElement,
    pauseAudioElement,
    startSpeechFromOffset,
    stopSpeech,
    isRealAudioRecording,
  ]);

  const seekTo = useCallback(
    (seconds: number) => {
      const clamped = Math.max(
        0,
        Math.min(activeEpisode.durationSeconds, seconds)
      );
      setCurrentTime(clamped);
      if (audioRef.current) {
        try {
          audioRef.current.currentTime = clamped;
        } catch {
          // ignore seek error on unloaded metadata
        }
      }
      if (isPlaying && !isRealAudioRecording(activeEpisode)) {
        startSpeechFromOffset(activeEpisode, clamped, playbackRate);
      }
    },
    [
      activeEpisode,
      isPlaying,
      playbackRate,
      startSpeechFromOffset,
      isRealAudioRecording,
    ]
  );

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((prev) => {
      const next = prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : 1;
      if (audioRef.current) {
        audioRef.current.playbackRate = next;
      }
      if (isPlaying && !isRealAudioRecording(activeEpisode)) {
        startSpeechFromOffset(activeEpisode, currentTime, next);
      }
      return next;
    });
  }, [
    activeEpisode,
    currentTime,
    isPlaying,
    startSpeechFromOffset,
    isRealAudioRecording,
  ]);

  const closeDock = useCallback(() => {
    setIsPlaying(false);
    pauseAudioElement();
    stopSpeech();
    setIsDockVisible(false);
  }, [pauseAudioElement, stopSpeech]);

  const openRubricInspector = useCallback(
    (opts: { tool?: WorkingToolId; failureMode?: SreFailureModeId }) => {
      setInspectedTool(opts.tool || null);
      setInspectedFailureMode(opts.failureMode || null);
    },
    []
  );

  const closeRubricInspector = useCallback(() => {
    setInspectedTool(null);
    setInspectedFailureMode(null);
  }, []);

  return (
    <TelemetryContext.Provider
      value={{
        activeEpisode,
        isPlaying,
        currentTime,
        playbackRate,
        isDockVisible,
        audioRef,
        playEpisode,
        togglePlayPause,
        seekTo,
        cyclePlaybackRate,
        closeDock,
        refreshTelemetry,
        inspectedTool,
        inspectedFailureMode,
        openRubricInspector,
        closeRubricInspector,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error("useTelemetry must be used inside TelemetryProvider");
  }
  return ctx;
}
