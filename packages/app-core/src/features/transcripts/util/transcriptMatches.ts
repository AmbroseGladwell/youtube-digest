import type { TranscriptBlock } from "@overview/domain";
import type { TranscriptMatch } from "../types/TranscriptMatch.js";

// Literal, not a regex: a transcript is full of characters a regex would read as syntax.
export const transcriptMatches = (blocks: TranscriptBlock[], query: string): TranscriptMatch[] => {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return [];
  }

  const matches: TranscriptMatch[] = [];
  blocks.forEach((block, blockIndex) => {
    const haystack = block.text.toLowerCase();
    let start = haystack.indexOf(needle);
    while (start !== -1) {
      matches.push({ index: matches.length, blockIndex, start, end: start + needle.length });
      start = haystack.indexOf(needle, start + needle.length);
    }
  });
  return matches;
};
