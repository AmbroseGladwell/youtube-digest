import { isWrittenPost, type Overview } from "@overview/domain";
import type { LibraryKind } from "../types/LibraryFilters.js";

const BY_SOURCE_KIND = {
  youtube: "video",
  web: "article",
  podcast: "podcast",
  tiktok: "video",
  instagram: "video",
  facebook: "video",
} as const;

// A recipe is also its medium, and a photo or text post is read: docs/features/library-filters.md, "Kind".
export const libraryKindsOf = ({ source, recipe }: Pick<Overview, "source" | "recipe">): LibraryKind[] => {
  const medium = isWrittenPost(source) ? "article" : BY_SOURCE_KIND[source.kind];
  return recipe === null ? [medium] : [medium, "recipe"];
};
