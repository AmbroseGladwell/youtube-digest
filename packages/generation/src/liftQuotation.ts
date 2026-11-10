import { EVIDENCE_MOST_WORDS, wordCount, type TimeRange, type TranscriptSegment } from "@overview/domain";

// A caption's own annotation, such as "[Music]", and its speaker-change mark ">>" are not
// something anyone said.
const NOT_SAID = /\[[^\]]*\]|>>/g;

// A sentence ends at its punctuation, with any closing quote or bracket, before a space and a
// capital or digit.
const SENTENCE_END = /[.?!…]["”’)]*\s+(?=["“‘(]?[\p{Lu}\p{N}])/u;
const LAST_SENTENCE_END = /[.?!…]["”’)]*(?=\s)(?!.*[.?!…]["”’)]*\s)/su;
const STARTS_A_SENTENCE = /^["“‘(]?[\p{Lu}\p{N}]/u;
const ENDS_A_SENTENCE = /[.?!…]["”’)]*$/u;

// Captions run across sentences, so a passage named by its segments can open on the tail of the
// sentence before it and stop partway through the next. Where the captions are punctuated, code
// trims both scraps away: still a run of the source's own words, never a reworded one.
function wholeSentences(text: string): string {
  let kept = text;
  if (!STARTS_A_SENTENCE.test(kept)) {
    const end = SENTENCE_END.exec(kept);
    if (end) kept = kept.slice(end.index + end[0].length);
  }
  if (!ENDS_A_SENTENCE.test(kept)) {
    const end = LAST_SENTENCE_END.exec(kept);
    if (end) kept = kept.slice(0, end.index + end[0].length);
  }
  return kept;
}

// The source's words, verbatim and whole: a passage longer than the cap is no quotation at all,
// since a cut one ends on half an example (OV-216, owner 10 Nov 2026).
export function wholePassage(pieces: readonly string[]): string | null {
  const joined = pieces.join(" ").replace(NOT_SAID, " ").replace(/\s+/g, " ").trim();
  const text = wholeSentences(joined).trim();
  if (text === "" || wordCount(text) > EVIDENCE_MOST_WORDS) return null;
  return text;
}

export function liftQuotation(segments: readonly TranscriptSegment[]): { text: string; range: TimeRange } | null {
  const text = wholePassage(segments.map(({ text: said }) => said));
  if (text === null || segments.length === 0) return null;
  return { text, range: { startMs: segments[0]!.startMs, endMs: segments.at(-1)!.endMs } };
}
