import type { Overview } from "@overview/domain";
import type { LibrarySource } from "../types/LibraryFilters.js";

export const librarySourceOf = ({ source }: Pick<Overview, "source">): LibrarySource =>
  source.kind === "web" ? "article" : "video";
