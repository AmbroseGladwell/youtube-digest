import { useMemo } from "react";
import { recipeStepGroups, type NoteLine, type RecipeNote } from "@overview/domain";
import { usePlayer, usePlayerLine, usePlayerSnapshot } from "../../player/PlayerContext.js";
import type { PlayerTrack, RecipePart } from "../../player/types/PlayerTrack.js";
import type { RecipeListVoice } from "../components/RecipeMethod/RecipeReadAloud.js";

export interface RecipeVoice {
  ingredients: RecipeListVoice;
  method: RecipeListVoice;
  // "Method · step 3 of 6", for the bar while a list is being read.
  nowReading: string | null;
}

const SECTION: Record<RecipePart, string> = { ingredients: "Ingredients", method: "Method" };

const listLines = (part: RecipePart, texts: readonly string[]): NoteLine[] =>
  texts.map((text) => ({ section: SECTION[part], heading: false, bullet: true, text }));

// Each list reads itself aloud exactly as shown, line by line, in the reader's voice: every
// spoken word is a line on screen (design 144t, docs/features/recipe-notes.md).
export function useRecipeVoice(
  note: PlayerTrack | null,
  recipe: RecipeNote | null,
  ingredients: readonly string[],
): RecipeVoice | null {
  const engine = usePlayer();
  const snapshot = usePlayerSnapshot();
  const line = usePlayerLine();
  const steps = useMemo(() => recipeStepGroups(recipe?.steps ?? []).flatMap(({ steps: texts }) => texts), [recipe]);

  const tracks = useMemo<Record<RecipePart, PlayerTrack> | null>(
    () =>
      note === null
        ? null
        : {
            ingredients: { ...note, opening: null, part: "ingredients", lines: listLines("ingredients", ingredients) },
            method: { ...note, opening: null, part: "method", lines: listLines("method", steps) },
          },
    [note, ingredients, steps],
  );

  if (recipe === null || tracks === null || note === null) return null;
  const base = note;

  const playing = snapshot.status === "playing" || snapshot.status === "buffering";
  const currentPart =
    snapshot.track?.overviewId === base.overviewId && snapshot.track.part !== undefined ? snapshot.track.part : null;
  const voiceOf = (part: RecipePart): RecipeListVoice => {
    const current = currentPart === part;
    return {
      activeIndex: current && snapshot.status !== "ready" && snapshot.status !== "ended" ? line : null,
      reading: current && playing,
      onPress: () => {
        if (!current) engine.load(tracks[part]);
        engine.toggle();
      },
    };
  };
  const total = currentPart === null ? 0 : tracks[currentPart].lines.length;
  return {
    ingredients: voiceOf("ingredients"),
    method: voiceOf("method"),
    nowReading:
      currentPart === null || !playing
        ? null
        : currentPart === "method"
          ? `Method · step ${line + 1} of ${total}`
          : `Ingredients · ${line + 1} of ${total}`,
  };
}
