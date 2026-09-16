import type { Overview } from "@overview/types";

// Logic ported from prototype/index_template.html's haystack() (CLAUDE.md: port the
// logic, not the file) — concatenate everything a reader might search by into one
// lowercased blob, checked with a plain substring match.
export function buildSearchHaystack(overview: Overview): string {
  return [
    overview.video.title,
    overview.video.channel,
    overview.inOneLine,
    overview.coreClaim,
    overview.verdict?.reasoning ?? "",
    overview.selling?.detail ?? "",
    ...(overview.howToApply?.items ?? []),
    ...overview.keyPoints,
    ...overview.tags,
  ]
    .join(" ")
    .toLowerCase();
}
