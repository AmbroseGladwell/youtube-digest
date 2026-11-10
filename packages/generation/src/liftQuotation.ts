import { EVIDENCE_MOST_WORDS, type TimeRange, type TranscriptSegment } from "@overview/domain";

// A caption's own annotation, such as "[Music]", is not something anyone said.
const ANNOTATION = /\[[^\]]*\]/g;

// The source's words, verbatim, from the pieces the model named, in order: code cuts at the
// cap, at a whole piece where it can, and says so with an ellipsis, so a long stretch never
// becomes a transcript in the note. `used` is how many pieces the quotation reached.
export function quotedWords(pieces: readonly string[]): { text: string; first: number; last: number } | null {
  const words: string[] = [];
  let first = -1;
  let last = -1;
  let cut = false;
  for (const [index, piece] of pieces.entries()) {
    const said = piece.replace(ANNOTATION, " ").split(/\s+/).filter(Boolean);
    if (said.length === 0) continue;
    const room = EVIDENCE_MOST_WORDS - words.length;
    if (room <= 0 || (said.length > room && words.length > 0)) {
      cut = true;
      break;
    }
    if (first === -1) first = index;
    last = index;
    words.push(...said.slice(0, room));
    if (said.length > room) {
      cut = true;
      break;
    }
  }
  if (first === -1) return null;
  return { text: `${words.join(" ")}${cut ? "…" : ""}`, first, last };
}

export function liftQuotation(segments: readonly TranscriptSegment[]): { text: string; range: TimeRange } | null {
  const quoted = quotedWords(segments.map(({ text }) => text));
  if (quoted === null) return null;
  return { text: quoted.text, range: { startMs: segments[quoted.first]!.startMs, endMs: segments[quoted.last]!.endMs } };
}
