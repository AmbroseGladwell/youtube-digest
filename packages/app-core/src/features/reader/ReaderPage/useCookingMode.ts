import { useCallback, useEffect, useRef, useState } from "react";
import type { OverviewId, RecipeAction, RecipeStep } from "@overview/domain";
import type { OverviewPageAnalytics } from "../../analytics/bindOverviewId.js";
import { usePlayer } from "../../player/PlayerContext.js";
import type { PlayerSnapshot } from "../../player/types/PlayerSnapshot.js";
import { overrideMediaSession } from "../../player/util/mediaSessionOverride.js";
import {
  COOKING_HINT_ENTRIES,
  readCookingHints,
  readCookingPlace,
  writeCookingHints,
  writeCookingPlace,
  type CookingPlace,
} from "../cookingPlaceStorage.js";
import type { RecipeVoice } from "./useRecipeVoice.js";

export type CookingVoice = "reading" | "paused" | "waiting" | "loading" | "textOnly" | "stopped";
export type CookingEntry = "heading" | "summary" | "bar" | "carryOn";

export interface CookingMode {
  open: boolean;
  at: number;
  finished: boolean;
  voice: CookingVoice;
  firstScreen: boolean;
  hint: boolean;
  place: CookingPlace | null;
  // The step the reader had reached when they left, for the note to show (design 150w).
  reachedStep: number | null;
  start: (from: CookingEntry, action: number) => void;
  next: () => void;
  back: () => void;
  again: () => void;
  goToStep: (step: number) => void;
  finish: () => void;
  startAgain: () => void;
  lastStep: () => void;
  done: () => void;
  close: () => void;
  tryAgain: () => void;
  dismissHint: () => void;
}

interface CookingModeInput {
  overviewId: OverviewId;
  title: string;
  steps: readonly RecipeStep[];
  actions: readonly RecipeAction[];
  recipeVoice: RecipeVoice | null;
  snapshot: PlayerSnapshot;
  analytics: OverviewPageAnalytics;
}

const voiceOf = ({ status, source }: PlayerSnapshot, canNarrate: boolean, paused: boolean): CookingVoice => {
  if (!canNarrate || source === "pacer") return "textOnly";
  if (status === "failed" || status === "busy") return "stopped";
  if (status === "preparing") return "loading";
  if (status === "playing" || status === "buffering") return "reading";
  return paused ? "paused" : "waiting";
};

// Cooking a recipe step by step (OV-150, designs 150a–150au): one action on screen, read once,
// and then the voice waits for the reader. docs/features/recipe-notes.md, "Cooking step by step".
export function useCookingMode({ overviewId, title, steps, actions, recipeVoice, snapshot, analytics }: CookingModeInput): CookingMode {
  const engine = usePlayer();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [finished, setFinished] = useState(false);
  const [moves, setMoves] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState(false);
  const [place, setPlace] = useState<CookingPlace | null>(() => readCookingPlace(overviewId));
  const [reachedStep, setReachedStep] = useState<number | null>(null);
  const heard = useRef(new Set<number>());

  useEffect(() => {
    setPlace(readCookingPlace(overviewId));
    setReachedStep(null);
    setOpen(false);
  }, [overviewId]);

  const voice = voiceOf(snapshot, engine.canNarrate(), paused);
  const last = actions.length - 1;

  const go = useCallback(
    (action: number) => {
      const target = Math.min(Math.max(action, 0), last);
      setAt(target);
      setPaused(false);
      heard.current.add(target);
      if (engine.canNarrate() && engine.getSnapshot().source !== "pacer") recipeVoice?.readAction(target);
      else recipeVoice?.holdAt(target);
    },
    [engine, last, recipeVoice],
  );

  const move = (action: number) => {
    setMoves((count) => count + 1);
    go(action);
  };

  const leave = (by: "done" | "finish") =>
    analytics.cooking.left({
      by,
      actionsHeard: heard.current.size,
      reachedLastStep: [...heard.current].some((action) => actions[action]?.step === actions[last]?.step),
    });

  const start = (from: CookingEntry, action: number) => {
    const target = Math.min(Math.max(action, 0), last);
    heard.current = new Set();
    const hints = readCookingHints();
    setHint(hints < COOKING_HINT_ENTRIES);
    if (hints < COOKING_HINT_ENTRIES) writeCookingHints(hints + 1);
    setFinished(false);
    setMoves(0);
    setReachedStep(null);
    setOpen(true);
    analytics.cooking.started({ from, step: (actions[target]?.step ?? 0) + 1 });
    go(target);
  };

  const quiet = () => {
    recipeVoice?.holdAt(at);
    setPaused(false);
  };

  const finish = () => {
    quiet();
    leave("finish");
    writeCookingPlace(overviewId, null);
    setPlace(null);
    setFinished(true);
  };

  const next = () => (at >= last ? finish() : move(at + 1));
  const back = () => move(at - 1);

  const done = () => {
    quiet();
    leave("done");
    const kept = { action: at, leftAt: Date.now() };
    writeCookingPlace(overviewId, kept);
    setPlace(kept);
    setReachedStep(actions[at]?.step ?? null);
    setOpen(false);
  };

  const mediaRef = useRef({ next, back, voice, paused });
  mediaRef.current = { next, back, voice, paused };
  const action = actions[at];
  const group = action === undefined ? null : (steps[action.step]?.group ?? null);
  const mediaTitle = action === undefined ? "" : `Step ${action.step + 1} of ${steps.length}${group === null ? "" : ` · ${group}`}`;
  useEffect(() => {
    if (!open || finished) return;
    return overrideMediaSession({
      title: mediaTitle,
      artist: title,
      onPlay: () => {
        const current = mediaRef.current;
        if (current.paused) {
          setPaused(false);
          engine.play("cooking");
        } else if (current.voice !== "reading") {
          current.next();
        }
      },
      onPause: () => {
        if (mediaRef.current.voice !== "reading") return;
        engine.pause();
        setPaused(true);
      },
      onNext: () => mediaRef.current.next(),
      onPrevious: () => mediaRef.current.back(),
    });
  }, [open, finished, mediaTitle, title, engine]);

  return {
    open,
    at,
    finished,
    voice,
    firstScreen: moves === 0,
    hint,
    place,
    reachedStep,
    start,
    next,
    back,
    again: () => go(at),
    goToStep: (step) => {
      setFinished(false);
      move(
        Math.max(
          0,
          actions.findIndex((candidate) => candidate.step === step),
        ),
      );
    },
    finish,
    startAgain: () => {
      setFinished(false);
      move(0);
    },
    lastStep: () => {
      setFinished(false);
      move(last);
    },
    done,
    close: () => {
      setOpen(false);
      setFinished(false);
    },
    tryAgain: () => engine.play("cooking"),
    dismissHint: () => {
      setHint(false);
      writeCookingHints(COOKING_HINT_ENTRIES);
    },
  };
}
