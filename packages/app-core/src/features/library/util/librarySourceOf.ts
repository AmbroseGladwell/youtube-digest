import type { Overview } from "@overview/domain";
import type { LibrarySource } from "../types/LibraryFilters.js";

// A recipe is its own kind in the filter, from a web page or a video (design 144m).
export const librarySourceOf = ({ source, recipe }: Pick<Overview, "source" | "recipe">): LibrarySource =>
  recipe !== null ? "recipe" : ({ youtube: "video", web: "article", podcast: "podcast" } as const)[source.kind];
