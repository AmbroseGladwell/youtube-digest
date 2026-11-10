import { EVIDENCE_MOST_WORDS, type TimeRange, type TranscriptSegment } from "@overview/domain";

// A caption's own annotation, such as "[Music]", is not something anyone said.
const ANNOTATION = /\[[^\]]*\]/g;

// The source's words, verbatim, from the segments the model named: code cuts at the cap and
// says so with an ellipsis, so a long stretch never becomes a transcript in the note.
export function liftQuotation(segments: readonly TranscriptSegment[]): { text: string; range: TimeRange } | null {
  const words: string[] = [];
  let first: TranscriptSegment | undefined;
  let last: TranscriptSegment | undefined;
  let cut = false;
  for (const segment of segments) {
    const said = segment.text.replace(ANNOTATION, " ").split(/\s+/).filter(Boolean);
    if (said.length === 0) continue;
    const room = EVIDENCE_MOST_WORDS - words.length;
    if (room <= 0 || (said.length > room && words.length > 0)) {
      cut = true;
      break;
    }
    first ??= segment;
    last = segment;
    words.push(...said.slice(0, room));
    if (said.length > room) {
      cut = true;
      break;
    }
  }
  if (first === undefined || last === undefined) return null;
  return { text: `${words.join(" ")}${cut ? "…" : ""}`, range: { startMs: first.startMs, endMs: last.endMs } };
}
