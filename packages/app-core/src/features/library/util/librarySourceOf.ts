import type { Overview } from "@overview/domain";
import type { LibrarySource } from "../types/LibraryFilters.js";

// A recipe is its own kind in the filter, though it comes from a web page (design 144m).
export const librarySourceOf = ({ source, recipe }: Pick<Overview, "source" | "recipe">): LibrarySource =>
  source.kind === "youtube" ? "video" : recipe === null ? "article" : "recipe";
