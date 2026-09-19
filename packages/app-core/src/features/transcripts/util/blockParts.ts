import type { TranscriptMatch } from "../types/TranscriptMatch.js";

export interface BlockPart {
  text: string;
  // The hit's place in the whole transcript's run of hits, or null for the plain text
  // between hits. The panel marks one of them as the one the steppers are on.
  match: number | null;
}

export function blockParts(text: string, matches: TranscriptMatch[]): BlockPart[] {
  if (matches.length === 0) {
    return [{ text, match: null }];
  }

  const parts: BlockPart[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      parts.push({ text: text.slice(cursor, match.start), match: null });
    }
    parts.push({ text: text.slice(match.start, match.end), match: match.index });
    cursor = match.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: null });
  }
  return parts;
}
