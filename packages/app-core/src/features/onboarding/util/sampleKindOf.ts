import type { SharedNote } from "@overview/domain";

export const sampleKindOf = (note: SharedNote): "video" | "article" | "recipe" =>
  note.source.kind === "youtube" ? "video" : note.recipe ? "recipe" : "article";
