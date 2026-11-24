import type { LibrarySourceId } from "../types/LibraryFilters.js";
import type { LibrarySource } from "./librarySourceOf.js";

export const librarySourceName = (id: LibrarySourceId, known: readonly LibrarySource[]): string => {
  return known.find((source) => source.id === id)?.name ?? id.replace(/^site:/, "");
};
