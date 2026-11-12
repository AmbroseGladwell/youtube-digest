import { useCallback, useEffect, useRef, useState } from "react";
import type { TimerSound } from "@overview/domain";
import { usePlayer } from "../../../player/PlayerContext.js";
import { playTimerSound, timerSoundSeconds } from "../../../reader/util/timerSounds.js";

export interface TimerSoundPlayback {
  sound: TimerSound;
  progress: number;
}

const TICK_MS = 50;

// One sample at a time, as the voice samples are; a note that was playing is paused and left
// paused (docs/features/narration-voice.md, "Listening").
export function useTimerSoundSample() {
  const player = usePlayer();
  const [playback, setPlayback] = useState<TimerSoundPlayback | null>(null);
  const playing = useRef<{ stop: () => void; tick: ReturnType<typeof setInterval> } | null>(null);

  const stop = useCallback(() => {
    if (playing.current !== null) {
      playing.current.stop();
      clearInterval(playing.current.tick);
      playing.current = null;
    }
    setPlayback(null);
  }, []);

  const play = useCallback(
    (sound: TimerSound) => {
      stop();
      player.pause();
      const startedAt = Date.now();
      const lengthMs = timerSoundSeconds(sound) * 1000;
      const tick = setInterval(() => {
        const progress = (Date.now() - startedAt) / lengthMs;
        if (progress >= 1) stop();
        else setPlayback({ sound, progress });
      }, TICK_MS);
      playing.current = { stop: playTimerSound(sound, { vibrate: false }), tick };
      setPlayback({ sound, progress: 0 });
    },
    [player, stop],
  );

  useEffect(() => stop, [stop]);

  return { playback, play, stop };
}
