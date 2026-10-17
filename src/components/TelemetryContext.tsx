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
  playEpisode: (episode: PodcastEpisode, startSeconds?: number) => void;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => void;
  cyclePlaybackRate: () => void;
  closeDock: () => void;

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

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [activeEpisode, setActiveEpisode] = useState<PodcastEpisode>(
    INITIAL_EPISODES[0]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDockVisible, setIsDockVisible] = useState(true);

  const [inspectedTool, setInspectedTool] = useState<WorkingToolId | null>(
    null
  );
  const [inspectedFailureMode, setInspectedFailureMode] =
    useState<SreFailureModeId | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Stop Web Speech synthesis helper
  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

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
  }, [isPlaying, playbackRate, activeEpisode.durationSeconds, stopSpeech]);

  const playEpisode = useCallback(
    (episode: PodcastEpisode, startSeconds = 0) => {
      setActiveEpisode(episode);
      setCurrentTime(startSeconds);
      setIsDockVisible(true);
      setIsPlaying(true);
      startSpeechFromOffset(episode, startSeconds, playbackRate);
    },
    [playbackRate, startSpeechFromOffset]
  );

  const togglePlayPause = useCallback(() => {
    setIsDockVisible(true);
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        startSpeechFromOffset(activeEpisode, currentTime, playbackRate);
      } else {
        stopSpeech();
      }
      return next;
    });
  }, [activeEpisode, currentTime, playbackRate, startSpeechFromOffset, stopSpeech]);

  const seekTo = useCallback(
    (seconds: number) => {
      const clamped = Math.max(
        0,
        Math.min(activeEpisode.durationSeconds, seconds)
      );
      setCurrentTime(clamped);
      if (isPlaying) {
        startSpeechFromOffset(activeEpisode, clamped, playbackRate);
      }
    },
    [activeEpisode, isPlaying, playbackRate, startSpeechFromOffset]
  );

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((prev) => {
      const next = prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : 1;
      if (isPlaying) {
        startSpeechFromOffset(activeEpisode, currentTime, next);
      }
      return next;
    });
  }, [activeEpisode, currentTime, isPlaying, startSpeechFromOffset]);

  const closeDock = useCallback(() => {
    setIsPlaying(false);
    stopSpeech();
    setIsDockVisible(false);
  }, [stopSpeech]);

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
        playEpisode,
        togglePlayPause,
        seekTo,
        cyclePlaybackRate,
        closeDock,
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
