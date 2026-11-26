export interface SentenceSpan {
  start: number;
  end: number;
}

const ABBREVIATIONS = new Set(["approx", "e.g", "i.e", "vs", "ca"]);
const SENTENCE_END = /[.!?]["'”’)\]*_]*(\s+)(?=["'“‘([*_]*[\p{Lu}\d]|`)/gu;
const ASIDE = /^\([^()]*\)[.!]?$/;

const trimmed = (text: string, { start, end }: SentenceSpan): SentenceSpan => {
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from]!)) {
    from += 1;
  }
  while (to > from && /\s/.test(text[to - 1]!)) {
    to -= 1;
  }
  return { start: from, end: to };
};

const isAbbreviation = (text: string, dot: number): boolean => {
  if (text[dot] !== ".") {
    return false;
  }
  const word = /([\p{L}.]+)$/u.exec(text.slice(0, dot))?.[1] ?? "";
  return ABBREVIATIONS.has(word.toLowerCase());
};

export const sentenceSpans = (text: string, from = 0): SentenceSpan[] => {
  const spans: SentenceSpan[] = [];
  let start = from;
  for (const match of text.slice(from).matchAll(SENTENCE_END)) {
    const at = from + match.index;
    if (isAbbreviation(text, at)) {
      continue;
    }
    const end = at + match[0].length - match[1]!.length;
    spans.push({ start, end });
    start = end;
  }
  spans.push({ start, end: text.length });
  return spans
    .map((span) => trimmed(text, span))
    .filter(({ start: s, end: e }) => e > s)
    .reduce<SentenceSpan[]>((joined, span) => {
      const before = joined.at(-1);
      if (before !== undefined && ASIDE.test(text.slice(span.start, span.end))) {
        before.end = span.end;
      } else {
        joined.push(span);
      }
      return joined;
    }, []);
};
