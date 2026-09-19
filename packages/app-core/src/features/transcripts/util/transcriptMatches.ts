import type { TranscriptBlock } from "../types/TranscriptBlock.js";
import type { TranscriptMatch } from "../types/TranscriptMatch.js";

// A literal, case-insensitive substring search over the merged blocks, not a regular
// expression: the box says "Search words or phrases", and a transcript is full of
// characters a regex would read as syntax.
export function transcriptMatches(blocks: TranscriptBlock[], query: string): TranscriptMatch[] {
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
}
