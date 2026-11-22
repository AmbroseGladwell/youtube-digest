import { sourceName } from "./sourceFacts.js";
import type { Overview } from "./Overview.js";

// Ported from prototype/index_template.html's haystack(), for a plain substring match.
export const buildSearchHaystack = (overview: Overview): string => {
  return [
    overview.source.title,
    sourceName(overview.source),
    overview.inOneLine,
    overview.bigPicture ?? "",
    overview.coreClaim,
    overview.verdict?.reasoning ?? "",
    overview.selling?.detail ?? "",
    ...(overview.howToApply?.items ?? []),
    ...overview.keyPoints.map((point) => point.text),
    overview.recipe?.summary ?? "",
    ...(overview.recipe?.ingredients ?? []),
    ...overview.tags,
  ]
    .join(" ")
    .toLowerCase();
};
