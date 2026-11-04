import type { RecipeStep } from "./Recipe.js";

export interface RecipeAction {
  step: number;
  index: number;
  count: number;
  text: string;
  start: number;
  end: number;
  label: string | null;
  condition: string | null;
}

interface Span {
  start: number;
  end: number;
  then: boolean;
}

const ABBREVIATIONS = new Set(["approx", "e.g", "i.e", "vs", "ca"]);
const SENTENCE_END = /[.!?]["'”’)\]]*(\s+)(?=["'“‘(\[]?[\p{Lu}\d])/gu;
const LABEL = /^((?:[\p{L}'’&]+\s){0,3}[\p{L}'’&]+)(?:\s[-–—]\s(?=\p{Lu})|:\s)/u;
const THEN = /,\s+(then)\s+([\p{Ll}][\p{L}'’-]*)/gu;
const NOT_AN_ACTION = new Set(["the", "a", "an", "another", "some", "more", "any", "all", "its", "their", "your", "his", "her"]);
const CONDITION = /^If\s[^,]*,/;
const ASIDE = /^\([^()]*\)[.!]?$/;

const trimmed = (text: string, { start, end, then }: Span): Span => {
  while (start < end && /\s/.test(text[start]!)) start += 1;
  while (end > start && /\s/.test(text[end - 1]!)) end -= 1;
  return { start, end, then };
};

const isAbbreviation = (text: string, dot: number): boolean => {
  if (text[dot] !== ".") return false;
  const word = /([\p{L}.]+)$/u.exec(text.slice(0, dot))?.[1] ?? "";
  return ABBREVIATIONS.has(word.toLowerCase());
};

const sentences = (text: string, from: number): Span[] => {
  const spans: Span[] = [];
  let start = from;
  for (const match of text.slice(from).matchAll(SENTENCE_END)) {
    const at = from + match.index;
    if (isAbbreviation(text, at)) continue;
    const end = at + match[0].length - match[1]!.length;
    spans.push({ start, end, then: false });
    start = end;
  }
  spans.push({ start, end: text.length, then: false });
  return spans
    .map((span) => trimmed(text, span))
    .filter(({ start: s, end: e }) => e > s)
    .reduce<Span[]>((joined, span) => {
      const before = joined.at(-1);
      if (before !== undefined && ASIDE.test(text.slice(span.start, span.end))) {
        before.end = span.end;
      } else {
        joined.push(span);
      }
      return joined;
    }, []);
};

const atThen = (text: string, sentence: Span): Span[] => {
  const body = text.slice(sentence.start, sentence.end);
  if (/^If\s/i.test(body)) return [sentence];
  const spans: Span[] = [];
  let start = sentence.start;
  let then = sentence.then;
  for (const match of body.matchAll(THEN)) {
    const word = match[2]!.toLowerCase();
    if (NOT_AN_ACTION.has(word) || word.endsWith("ing") || word.endsWith("ly")) continue;
    const comma = sentence.start + match.index;
    spans.push({ start, end: comma, then });
    start = comma + match[0].indexOf(match[1]!);
    then = true;
  }
  spans.push({ start, end: sentence.end, then });
  return spans;
};

// docs/features/recipe-notes.md, "A step's actions": code, never a model, decides where one ends.
export function recipeActions(steps: readonly RecipeStep[]): RecipeAction[] {
  return steps.flatMap(({ text }, step) => {
    const lifted = LABEL.exec(text);
    const label = lifted !== null && lifted[0].length < text.trim().length ? lifted : null;
    const spans = sentences(text, label === null ? 0 : label[0].length).flatMap((sentence) => atThen(text, sentence));
    return spans.map(({ start, end, then }, index) => {
      const shown = text.slice(start, end);
      return {
        step,
        index,
        count: spans.length,
        text: then ? `…${shown}` : shown,
        start,
        end,
        label: label === null ? null : label[1]!,
        condition: CONDITION.exec(shown)?.[0] ?? null,
      };
    });
  });
}

export const isLastOfStep = (action: RecipeAction): boolean => action.index === action.count - 1;
