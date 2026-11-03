import { sourceName } from "./sourceFacts.js";
import type { Overview } from "./Overview.js";

// Logic ported from prototype/index_template.html's haystack() (CLAUDE.md: port the
// logic, not the file) — concatenate everything a reader might search by into one
// lowercased blob, checked with a plain substring match.
export function buildSearchHaystack(overview: Overview): string {
  return [
    overview.source.title,
    sourceName(overview.source),
    overview.inOneLine,
    overview.coreClaim,
    overview.verdict?.reasoning ?? "",
    overview.selling?.detail ?? "",
    ...(overview.howToApply?.items ?? []),
    ...overview.keyPoints.map((point) => point.text),
    ...overview.tags,
  ]
    .join(" ")
    .toLowerCase();
}
