import { useCallback, useEffect, useRef, useState } from "react";
import type { NarrationVoice } from "@overview/domain";
import { usePlayer } from "../../../player/PlayerContext.js";

export interface SamplePlayback {
  voice: NarrationVoice;
  seconds: number;
  durationSeconds: number;
}

// One sample at a time, and a note that was playing is paused and left paused, so comparing
// voices does not keep cutting back to it (docs/features/narration-voice.md, "Listening").
export function useVoiceSamplePlayer() {
  const player = usePlayer();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playback, setPlayback] = useState<SamplePlayback | null>(null);

  const stop = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    setPlayback(null);
  }, []);

  const play = useCallback(
    (voice: NarrationVoice, url: string, durationSeconds: number) => {
      audio.current?.pause();
      player.pause();
      const sample = new Audio(url);
      audio.current = sample;
      const current = () => audio.current === sample;
      const finish = () => {
        if (!current()) return;
        audio.current = null;
        setPlayback(null);
      };
      sample.addEventListener("timeupdate", () => {
        if (current()) setPlayback({ voice, seconds: sample.currentTime, durationSeconds });
      });
      sample.addEventListener("ended", finish);
      sample.addEventListener("error", finish);
      setPlayback({ voice, seconds: 0, durationSeconds });
      sample.play().catch(finish);
    },
    [player],
  );

  useEffect(() => () => audio.current?.pause(), []);

  return { playback, play, stop };
}
