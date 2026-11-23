import { articleReadMinutes, formatClock, isClipSource, recipeMinutes, sourceName, type SharedNote } from "@overview/domain";

export type SampleKind = "video" | "article" | "recipe" | "podcast";

const KIND_LABEL: Record<SampleKind, string> = { video: "Video", article: "Article", recipe: "Recipe", podcast: "Podcast" };
export const START_VERB: Record<SampleKind, string> = {
  video: "Watch Less,",
  article: "Learn More,",
  recipe: "Cook Easier,",
  podcast: "Listen Less,",
};

export const sampleKindOf = (note: SharedNote): SampleKind => {
  if (note.source.kind === "youtube" || isClipSource(note.source)) {
    return "video";
  }
  if (note.source.kind === "podcast") {
    return "podcast";
  }
  return note.recipe ? "recipe" : "article";
};

const lengthOf = (note: SharedNote): string | null => {
  const { source } = note;
  if (source.kind === "youtube" || isClipSource(source)) {
    return source.durationMs === null ? null : formatClock(source.durationMs / 1000);
  }
  if (source.kind === "podcast") {
    return source.durationMs === null ? null : recipeMinutes(Math.round(source.durationMs / 60_000));
  }
  if (note.recipe) {
    return note.recipe.totalMinutes === null ? null : recipeMinutes(note.recipe.totalMinutes);
  }
  return `${articleReadMinutes(source.wordCount)} min read`;
};

export interface SampleFacts {
  kind: SampleKind;
  kindLabel: string;
  source: string;
  length: string | null;
  verb: string;
  name: string;
  first: { label: string; text: string };
  sections: readonly string[];
}

export const sampleFacts = (note: SharedNote): SampleFacts => {
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
    sections:
      kind === "recipe"
        ? ["Ingredients", "Method"]
        : [...(note.bigPicture ? ["Big picture"] : []), "Key points", "How to apply", "Verdict"],
  };
};

export const DEFAULT_START_VERB = START_VERB.video;
