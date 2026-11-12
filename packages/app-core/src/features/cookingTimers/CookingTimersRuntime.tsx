import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_TIMER_SOUND, type OverviewId } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { bindOverviewId } from "../analytics/bindOverviewId.js";
import { usePlayer } from "../player/PlayerContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
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
} from "../reader/util/cookingTimers.js";
import { playTimerSound, timerSoundEveryMs, unlockTimerSound } from "../reader/util/timerSounds.js";
import { useScreenAwake } from "../../util/useScreenAwake.js";
import {
  CookingTimerListProvider,
  CookingTimersProvider,
  type CookingTimerList,
  type CookingTimerEnd,
  type CookingTimerEvents,
  type CookingTimers,
  type CookRequest,
} from "./CookingTimersContext.js";

interface CookingTimersRuntimeProps {
  // The app's timers count as the reader's, each on the recipe it came from, which may no
  // longer be on screen; a shared page's count as that page's.
  scope: "reader" | "sharedPage";
  children: ReactNode;
}

interface HeldNarration {
  overviewId: string;
  time: number;
}

const TICK_MS = 250;
const SAME_PLACE_SECONDS = 1;

// The tab's cooking timers (OV-284, carried outside the mode by OV-288): one clock, one ring
// however many are done, the narration held while one rings, and the screen kept on while any
// runs. docs/features/recipe-notes.md, "Timers".
export function CookingTimersRuntime({ scope, children }: CookingTimersRuntimeProps) {
  const engine = usePlayer();
  const tracker = useAnalytics();
  const sound = useSettingsQuery().data?.timerSound ?? DEFAULT_TIMER_SOUND;
  const [timers, setTimers] = useState<CookingTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [held, setHeld] = useState<HeldNarration | null>(null);
  const [cookRequest, setCookRequest] = useState<CookRequest | null>(null);
  const [cookingOpen, setCookingOpen] = useState(false);
  const nextId = useRef(1);
  const latest = useRef(timers);
  latest.current = timers;
  const chosenSound = useRef(sound);
  chosenSound.current = sound;
  const eventsFor = (timer: CookingTimer): CookingTimerEvents =>
    scope === "sharedPage" ? tracker.sharedPage.cooking : bindOverviewId(tracker.reader, timer.source.recipe as OverviewId).cooking;
  const analytics = useRef(eventsFor);
  analytics.current = eventsFor;
  const awake = useScreenAwake(timers.length > 0);

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

  const heldRef = useRef(held);
  heldRef.current = held;
  useEffect(() => {
    if (anyRinging) {
      const { status, track } = engine.getSnapshot();
      if (track === null || (status !== "playing" && status !== "buffering")) return;
      engine.pause();
      setHeld({ overviewId: track.overviewId, time: engine.getTime() });
      return;
    }
    const was = heldRef.current;
    if (was === null) return;
    setHeld(null);
    const { status, track } = engine.getSnapshot();
    if (track?.overviewId === was.overviewId && status === "paused" && Math.abs(engine.getTime() - was.time) < SAME_PLACE_SECONDS) {
      engine.play("cooking");
    }
  }, [anyRinging, engine]);

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
      return by === null ? [] : [{ timer, by }];
    });
    if (ended.length === 0) return;
    const gone = new Set(ended.map(({ timer }) => timer.id));
    setTimers((current) => current.filter((timer) => !gone.has(timer.id)));
    for (const { timer, by } of ended) analytics.current(timer).timerEnded({ by, rang: isRinging(timer) });
  }, []);

  const value = useMemo<CookingTimers>(() => {
    const running = soonestFirst(timers, now);
    return {
      scope,
      eventsFor: (timer) => analytics.current(timer),
      now,
      running,
      ringing: oldestRingingFirst(timers),
      awake,
      narrationHeld: held !== null,
      start: (start) => {
        unlockTimerSound();
        const at = Date.now();
        const timer = startedTimer(nextId.current, start, at);
        nextId.current += 1;
        setNow(at);
        setTimers((current) => [...current, timer]);
        analytics.current(timer).timerStarted({ seconds: start.source.seconds, step: start.step + 1, range: start.range });
      },
      pause: (id) => change(id, pausedTimer),
      resume: (id) => change(id, resumedTimer),
      adjust: (id, minutes) => change(id, (timer, at) => adjustedTimer(timer, minutes, at)),
      cancel: (id) => end((timer) => (timer.id === id ? "cancelled" : null)),
      dismiss: (id) => end((timer) => (timer.id === id ? "dismissed" : null)),
      dismissAll: () => end((timer) => (isRinging(timer) ? "dismissed" : null)),
      stop: (ids, by) => end((timer) => (ids.includes(timer.id) ? by : null)),
      runningFrom: (source) => running.find((timer) => isSameSource(timer.source, source)),
      forgetHeldNarration: () => setHeld(null),
      cookingOpen,
      setCookingOpen,
      cookRequest,
      requestCook: setCookRequest,
      takeCookRequest: () => setCookRequest(null),
    };
  }, [scope, timers, now, awake, held, cookingOpen, cookRequest, change, end]);

  const list = useMemo<CookingTimerList>(
    () => ({ all: timers, narrationHeld: held !== null, stop: (ids, by) => end((timer) => (ids.includes(timer.id) ? by : null)) }),
    [timers, held, end],
  );

  return (
    <CookingTimerListProvider value={list}>
      <CookingTimersProvider value={value}>{children}</CookingTimersProvider>
    </CookingTimerListProvider>
  );
}
