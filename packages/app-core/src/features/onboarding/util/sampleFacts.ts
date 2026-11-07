import { articleReadMinutes, formatClock, recipeMinutes, sourceName, type SharedNote } from "@overview/domain";

export type SampleKind = "video" | "article" | "recipe";

const KIND_LABEL: Record<SampleKind, string> = { video: "Video", article: "Article", recipe: "Recipe" };
// Start's headline verb for a kind, wherever the kind comes from: the deck's front card
// (155l), or in the panel what the tab holds (205g-2, 205g-3).
export const START_VERB: Record<SampleKind, string> = { video: "Watch Less,", article: "Learn More,", recipe: "Cook More," };

export const sampleKindOf = (note: SharedNote): SampleKind =>
  note.source.kind === "youtube" ? "video" : note.recipe ? "recipe" : "article";

const lengthOf = (note: SharedNote): string | null => {
  const { source } = note;
  if (source.kind === "youtube") return source.durationMs === null ? null : formatClock(source.durationMs / 1000);
  if (note.recipe) return note.recipe.totalMinutes === null ? null : recipeMinutes(note.recipe.totalMinutes);
  return `${articleReadMinutes(source.wordCount)} min read`;
};

export interface SampleFacts {
  kind: SampleKind;
  kindLabel: string;
  source: string;
  length: string | null;
  // Start's headline verb while this sample is in front (155l).
  verb: string;
  // Each card is one button named by its title, kind and length.
  name: string;
  first: { label: string; text: string };
  sections: readonly string[];
}

export function sampleFacts(note: SharedNote): SampleFacts {
  const kind = sampleKindOf(note);
  const length = lengthOf(note);
  return {
    kind,
    kindLabel: KIND_LABEL[kind],
    source: sourceName(note.source),
    length,
    verb: START_VERB[kind],
    name: [note.source.title, KIND_LABEL[kind], length].filter(Boolean).join(", "),
    first: note.recipe ? { label: "Summary", text: note.recipe.summary } : { label: "Premise", text: note.inOneLine },
    sections: kind === "recipe" ? ["Ingredients", "Method"] : ["Key points", "How to apply", "Verdict"],
  };
}

export const DEFAULT_START_VERB = START_VERB.video;
