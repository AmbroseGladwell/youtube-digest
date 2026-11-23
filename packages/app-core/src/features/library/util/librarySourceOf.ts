import type { Overview } from "@overview/domain";
import type { LibrarySource } from "../types/LibraryFilters.js";

export const librarySourceOf = ({ source, recipe }: Pick<Overview, "source" | "recipe">): LibrarySource =>
  recipe !== null
    ? "recipe"
    : ({ youtube: "video", web: "article", podcast: "podcast", tiktok: "video", instagram: "video", facebook: "video" } as const)[
        source.kind
      ];
