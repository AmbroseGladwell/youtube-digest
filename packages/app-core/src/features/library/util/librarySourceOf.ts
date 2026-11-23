import { isWrittenPost, type Overview } from "@overview/domain";
import type { LibrarySource } from "../types/LibraryFilters.js";

const BY_KIND = { youtube: "video", web: "article", podcast: "podcast", tiktok: "video", instagram: "video", facebook: "video" } as const;

// A photo or text post is read, so it sits with the articles.
export const librarySourceOf = ({ source, recipe }: Pick<Overview, "source" | "recipe">): LibrarySource => {
  if (recipe !== null) {
    return "recipe";
  }
  return isWrittenPost(source) ? "article" : BY_KIND[source.kind];
};
