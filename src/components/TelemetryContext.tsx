"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { INITIAL_EPISODES } from "@/lib/seed-data";
import { SreFailureModeId, WorkingToolId } from "@/lib/taxonomy";
import { PodcastEpisode } from "@/lib/types";

interface TelemetryContextValue {
  // Persistent Audio Player state
  activeEpisode: PodcastEpisode;
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  isDockVisible: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playEpisode: (episode: PodcastEpisode, startSeconds?: number) => void;
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
  initialEpisode?: PodcastEpisode;
}) {
  const [activeEpisode, setActiveEpisode] = useState<PodcastEpisode>(
    initialEpisode || INITIAL_EPISODES[0]
  );
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
        const latestEp = data.episodes[0] as PodcastEpisode;
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

  // Start or sync HTML5 <audio> element from offset
  const playAudioElement = useCallback(
    (episode: PodcastEpisode, seconds: number, rate: number) => {
      const el = audioRef.current;
      if (!el) return;
      try {
        if (
          episode.audioUrl &&
          !el.src.endsWith(episode.audioUrl) &&
          el.src !== episode.audioUrl
        ) {
          el.src = episode.audioUrl;
        }
        el.playbackRate = rate;
        if (Number.isFinite(el.duration) && el.duration > 0) {
          el.currentTime = seconds % el.duration;
        } else if (seconds === 0) {
          el.currentTime = 0;
        }
        const playPromise = el.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Browser autoplay policy or external stream fallback; Web Speech narration continues seamlessly
          });
        }
      } catch {
        // ignore audio element error
      }
    },
    []
  );

  // Start Web Speech narration from the transcript corresponding to currentTime
  const startSpeechFromOffset = useCallback(
    (episode: PodcastEpisode, seconds: number, rate: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      window.speechSynthesis.cancel();
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
    []
  );

  useEffect(() => {
    if (isPlaying) {
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
    activeEpisode.durationSeconds,
    stopSpeech,
    pauseAudioElement,
  ]);

  const playEpisode = useCallback(
    (episode: PodcastEpisode, startSeconds = 0) => {
      setActiveEpisode(episode);
      setCurrentTime(startSeconds);
      setIsDockVisible(true);
      setIsPlaying(true);
      playAudioElement(episode, startSeconds, playbackRate);
      startSpeechFromOffset(episode, startSeconds, playbackRate);
    },
    [playbackRate, playAudioElement, startSpeechFromOffset]
  );

  const togglePlayPause = useCallback(() => {
    setIsDockVisible(true);
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        playAudioElement(activeEpisode, currentTime, playbackRate);
        startSpeechFromOffset(activeEpisode, currentTime, playbackRate);
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
          const dur = audioRef.current.duration;
          audioRef.current.currentTime =
            Number.isFinite(dur) && dur > 0 ? clamped % dur : clamped;
        } catch {
          // ignore seek error on unloaded metadata
        }
      }
      if (isPlaying) {
        startSpeechFromOffset(activeEpisode, clamped, playbackRate);
      }
    },
    [activeEpisode, isPlaying, playbackRate, startSpeechFromOffset]
  );

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((prev) => {
      const next = prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : 1;
      if (audioRef.current) {
        audioRef.current.playbackRate = next;
      }
      if (isPlaying) {
        startSpeechFromOffset(activeEpisode, currentTime, next);
      }
      return next;
    });
  }, [activeEpisode, currentTime, isPlaying, startSpeechFromOffset]);

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
