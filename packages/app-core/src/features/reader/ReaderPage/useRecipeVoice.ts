import { useEffect, useState } from "react";
import { INGREDIENTS_SECTION, METHOD_SECTION, type NoteLine, type RecipeAction } from "@overview/domain";
import { useOverviewPageAnalytics } from "../../analytics/OverviewAnalyticsContext.js";
import { usePlayer } from "../../player/PlayerContext.js";
import type { PlayerTrack } from "../../player/types/PlayerTrack.js";
import type { RecipeListVoice } from "../components/RecipeMethod/RecipeReadAloud.js";
import type { NotePlayer } from "./useNotePlayer.js";

export interface RecipeVoice {
  ingredients: RecipeListVoice;
  method: RecipeListVoice;
  // "Method · step 3 of 6", for the bar while a list is being read.
  nowReading: string | null;
  // Listen plays on through every section, so a list's stop no longer applies.
  release: () => void;
  // The method's action under the voice, for the bar's Cook from here (design 150b).
  methodAction: number | null;
  // Cooking step by step: one action read and then the voice waits, or the place moved with no
  // voice where there is none to read it (OV-150).
  readAction: (action: number) => void;
  holdAt: (action: number) => void;
}

interface Stretch {
  first: number;
  last: number;
}

// The item lines of one section of the narration, without its heading.
const stretchOf = (lines: readonly NoteLine[], section: string): Stretch | null => {
  const indexes = lines.flatMap((line, index) => (line.section === section && !line.heading ? [index] : []));
  return indexes.length === 0 ? null : { first: indexes[0]!, last: indexes.at(-1)! };
};

const NO_VOICE: RecipeListVoice = {
  activeIndex: null,
  reading: false,
  speaking: false,
  onPress: () => undefined,
  onSelect: () => undefined,
};

// A recipe's narration is the whole recipe, so one render has every section ready (OV-148).
// The method's lines are its actions (OV-150), so its voice counts in actions and the bar in steps.
// Listen plays straight through; a list's Read aloud plays its own stretch of the same audio
// and stops at the end of it, and each list tints the line being read. Tapping an ingredient
// or a step moves the voice there, as tapping a line of the note does (OV-149).
export function useRecipeVoice(
  track: PlayerTrack | null,
  lines: readonly NoteLine[],
  actions: readonly RecipeAction[],
  stepCount: number,
  notePlayer: NotePlayer,
): RecipeVoice | null {
  const engine = usePlayer();
  const analytics = useOverviewPageAnalytics();
  const [stopAfter, setStop] = useState<number | null>(null);
  const { activeIndex, playing } = notePlayer;
  const ended = notePlayer.snapshot.status === "ended";
  const setStopAfter = (line: number | null) => {
    setStop(line);
    engine.stopAfterLine(line);
  };

  // The engine stops at the line's end itself; this only forgets a stop the voice has gone past,
  // by a seek or by reaching the end.
  useEffect(() => {
    if (stopAfter === null) return;
    if (ended || activeIndex > stopAfter) {
      setStop(null);
      engine.stopAfterLine(null);
    }
  }, [activeIndex, stopAfter, ended, engine]);

  const ingredients = stretchOf(lines, INGREDIENTS_SECTION);
  const method = stretchOf(lines, METHOD_SECTION);
  if (track === null || ingredients === null) return null;

  const within = (stretch: Stretch) => activeIndex >= stretch.first && activeIndex <= stretch.last;
  const voiceOf = (stretch: Stretch | null): RecipeListVoice => {
    if (stretch === null) return NO_VOICE;
    const here = within(stretch);
    const reading = playing && here;
    return {
      activeIndex: here ? activeIndex - stretch.first : null,
      reading,
      speaking: reading,
      onPress: () => {
        if (reading) {
          notePlayer.pause();
          return;
        }
        engine.load(track, stretch.first);
        engine.seekLine(stretch.first);
        setStopAfter(stretch.last);
        engine.play();
      },
      onSelect: (index) => {
        analytics.readAlong.lineChosen();
        if (stopAfter !== stretch.last) setStopAfter(null);
        notePlayer.selectLine(stretch.first + index);
      },
    };
  };

  const position = (stretch: Stretch) => `${activeIndex - stretch.first + 1} of ${stretch.last - stretch.first + 1}`;
  return {
    ingredients: voiceOf(ingredients),
    method: voiceOf(method),
    nowReading: !playing
      ? null
      : method !== null && within(method)
        ? `Method · step ${(actions[activeIndex - method.first]?.step ?? 0) + 1} of ${stepCount}`
        : within(ingredients)
          ? `Ingredients · ${position(ingredients)}`
          : null,
    release: () => setStopAfter(null),
    methodAction: method !== null && within(method) ? activeIndex - method.first : null,
    readAction: (action) => {
      if (method === null) return;
      const line = method.first + action;
      engine.load(track, line);
      engine.seekLine(line);
      setStopAfter(line);
      engine.play();
    },
    holdAt: (action) => {
      if (method === null) return;
      engine.load(track, method.first + action);
      engine.pause();
      engine.seekLine(method.first + action);
      setStopAfter(null);
    },
  };
}
