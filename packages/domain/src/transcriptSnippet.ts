import type { TranscriptBlock } from "./TranscriptBlock.js";
import type { TranscriptQuery } from "./transcriptQueryOf.js";
import type { TimeRange } from "./WatchAnyway.js";

export interface TextMark {
  start: number;
  end: number;
}

export interface TranscriptSnippet {
  startMs: number;
  text: string;
  marks: TextMark[];
}

export const SNIPPET_MAX_CHARS = 180;

const ELLIPSIS = "…";
const NOT_WORD = "[^\\p{L}\\p{N}]+";
const WORD_START = "(?<![\\p{L}\\p{N}])";
const ENDINGS = /(?:['’]s|ies|es|s|ing|ed|ly)$/;
const SENTENCES = /[^.!?]+(?:[.!?]+["'’”)\]]*\s*|$)/g;

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stemOf = (token: string): string => {
  const stripped = token.replace(ENDINGS, "");
  return stripped.length >= 3 ? stripped : token;
};

const tokenPattern = (token: string): string => {
  const stem = stemOf(token);
  return `${escaped(stem)}${/\p{N}$/u.test(stem) ? "(?!\\p{N})" : "\\p{L}*"}`;
};

const termPatterns = ({ phrases, words }: TranscriptQuery): RegExp[] =>
  [...phrases.map((phrase) => phrase.split(" ").map(tokenPattern).join(NOT_WORD)), ...words.map(tokenPattern)].map(
    (pattern) => new RegExp(`${WORD_START}${pattern}`, "giu"),
  );

// Code does the marking, never a model: docs/features/transcript-search.md, "Snippets and moments".
export const marksIn = (text: string, query: TranscriptQuery): TextMark[] => {
  const found = termPatterns(query).flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length })),
  );
  return found
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .reduce<TextMark[]>((merged, mark) => {
      const last = merged.at(-1);
      if (last !== undefined && mark.start < last.end) {
        last.end = Math.max(last.end, mark.end);
        return merged;
      }
      return [...merged, { ...mark }];
    }, []);
};

const termsMarkedIn = (text: string, query: TranscriptQuery): number => termPatterns(query).filter((pattern) => pattern.test(text)).length;

const wordWindow = (text: string, around: number): string => {
  const half = Math.floor(SNIPPET_MAX_CHARS / 2);
  let from = Math.max(0, around - half);
  let to = Math.min(text.length, from + SNIPPET_MAX_CHARS);
  from = Math.max(0, to - SNIPPET_MAX_CHARS);
  if (from > 0) {
    const space = text.indexOf(" ", from);
    from = space === -1 || space >= around ? from : space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(" ", to);
    to = space <= around ? to : space;
  }
  return `${from > 0 ? ELLIPSIS : ""}${text.slice(from, to).trim()}${to < text.length ? ELLIPSIS : ""}`;
};

const cutAround = (text: string, at: number): string => {
  if (text.length <= SNIPPET_MAX_CHARS) {
    return text;
  }
  const sentences = [...text.matchAll(SENTENCES)].map((match) => ({ start: match.index, text: match[0] }));
  const index = sentences.findIndex((sentence) => at < sentence.start + sentence.text.length);
  const home = sentences[index];
  if (home === undefined || home.text.trim().length > SNIPPET_MAX_CHARS) {
    return wordWindow(text, at);
  }
  let first = index;
  let last = index;
  const length = () => sentences.slice(first, last + 1).reduce((total, sentence) => total + sentence.text.length, 0);
  for (;;) {
    const after = sentences[last + 1];
    const before = sentences[first - 1];
    if (after !== undefined && length() + after.text.length <= SNIPPET_MAX_CHARS) {
      last += 1;
    } else if (before !== undefined && length() + before.text.length <= SNIPPET_MAX_CHARS) {
      first -= 1;
    } else {
      break;
    }
  }
  return sentences
    .slice(first, last + 1)
    .map((sentence) => sentence.text)
    .join("")
    .trim();
};

export const transcriptSnippet = (
  blocks: readonly TranscriptBlock[],
  range: TimeRange,
  query: TranscriptQuery,
): TranscriptSnippet | null => {
  const inRange = blocks.filter((block) => block.startMs < range.endMs && block.endMs > range.startMs);
  const best = inRange.reduce<{ block: TranscriptBlock; terms: number } | null>((chosen, block) => {
    const terms = termsMarkedIn(block.text, query);
    return chosen === null || terms > chosen.terms ? { block, terms } : chosen;
  }, null);
  if (best === null) {
    return null;
  }
  const firstMark = marksIn(best.block.text, query)[0];
  const text = cutAround(best.block.text, firstMark?.start ?? 0);
  return { startMs: best.block.startMs, text, marks: marksIn(text, query) };
};
