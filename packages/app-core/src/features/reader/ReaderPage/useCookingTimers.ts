import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimerSound } from "@overview/domain";
import {
  adjustedTimer,
  isRinging,
  isSameSource,
  oldestRingingFirst,
  pausedTimer,
  ranOut,
  resumedTimer,
  soonestFirst,
  startedTimer,
  type CookingTimer,
  type CookingTimerSource,
  type CookingTimerStart,
} from "../util/cookingTimers.js";
import { playTimerSound, timerSoundEveryMs, unlockTimerSound } from "../util/timerSounds.js";

export type CookingTimerEnd = "dismissed" | "cancelled" | "left";

export interface CookingTimers {
  now: number;
  running: readonly CookingTimer[];
  ringing: readonly CookingTimer[];
  start: (start: CookingTimerStart) => void;
  pause: (id: number) => void;
  resume: (id: number) => void;
  adjust: (id: number, minutes: number) => void;
  cancel: (id: number) => void;
  dismiss: (id: number) => void;
  dismissAll: () => void;
  stopAll: () => void;
  runningFrom: (source: CookingTimerSource) => CookingTimer | undefined;
}

interface CookingTimersInput {
  sound: TimerSound;
  onStarted: (timer: CookingTimer) => void;
  onEnded: (by: CookingTimerEnd, rang: boolean) => void;
}

const TICK_MS = 250;

// Timers started from the times in a recipe's actions while cooking step by step (OV-284,
// designs 284a–284ah). docs/features/recipe-notes.md, "Timers".
export function useCookingTimers({ sound, onStarted, onEnded }: CookingTimersInput): CookingTimers {
  const [timers, setTimers] = useState<CookingTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const nextId = useRef(1);
  const latest = useRef(timers);
  latest.current = timers;
  const callbacks = useRef({ onStarted, onEnded });
  callbacks.current = { onStarted, onEnded };
  const chosenSound = useRef(sound);
  chosenSound.current = sound;

  const anyTimer = timers.length > 0;
  useEffect(() => {
    if (!anyTimer) return;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      setTimers((current) => (current.some((timer) => timer.endsAt !== null && timer.endsAt <= at) ? ranOut(current, at) : current));
    };
    tick();
    const interval = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [anyTimer]);

  const anyRinging = timers.some(isRinging);
  useEffect(() => {
    if (!anyRinging) return;
    const ring = () => void playTimerSound(chosenSound.current);
    ring();
    const interval = setInterval(ring, timerSoundEveryMs(chosenSound.current));
    return () => clearInterval(interval);
  }, [anyRinging]);

  const anyRunning = timers.some((timer) => !isRinging(timer));
  useEffect(() => {
    if (!anyRunning) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [anyRunning]);

  const change = useCallback((id: number, update: (timer: CookingTimer, at: number) => CookingTimer) => {
    const at = Date.now();
    setNow(at);
    setTimers((current) => current.map((timer) => (timer.id === id ? update(timer, at) : timer)));
  }, []);

  const end = useCallback((ending: (timer: CookingTimer) => CookingTimerEnd | null) => {
    const ended = latest.current.flatMap((timer) => {
      const by = ending(timer);
      return by === null ? [] : [{ id: timer.id, by, rang: isRinging(timer) }];
    });
    if (ended.length === 0) return;
    const gone = new Set(ended.map((timer) => timer.id));
    setTimers((current) => current.filter((timer) => !gone.has(timer.id)));
    for (const timer of ended) callbacks.current.onEnded(timer.by, timer.rang);
  }, []);

  return useMemo(() => {
    const running = soonestFirst(timers, now);
    return {
      now,
      running,
      ringing: oldestRingingFirst(timers),
      start: (start) => {
        unlockTimerSound();
        const at = Date.now();
        const timer = startedTimer(nextId.current, start, at);
        nextId.current += 1;
        setNow(at);
        setTimers((current) => [...current, timer]);
        callbacks.current.onStarted(timer);
      },
      pause: (id) => change(id, pausedTimer),
      resume: (id) => change(id, resumedTimer),
      adjust: (id, minutes) => change(id, (timer, at) => adjustedTimer(timer, minutes, at)),
      cancel: (id) => end((timer) => (timer.id === id ? "cancelled" : null)),
      dismiss: (id) => end((timer) => (timer.id === id ? "dismissed" : null)),
      dismissAll: () => end((timer) => (isRinging(timer) ? "dismissed" : null)),
      stopAll: () => end(() => "left"),
      runningFrom: (source) => running.find((timer) => isSameSource(timer.source, source)),
    };
  }, [timers, now, change, end]);
}
