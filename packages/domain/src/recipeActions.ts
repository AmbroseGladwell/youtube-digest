import type { RecipeStep } from "./Recipe.js";
import { sentenceSpans } from "./sentenceSpans.js";

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

const LABEL = /^((?:[\p{L}'’&]+\s){0,3}[\p{L}'’&]+)(?:\s[-–—]\s(?=\p{Lu})|:\s)/u;
const THEN = /,\s+(then)\s+([\p{Ll}][\p{L}'’-]*)/gu;
const NOT_AN_ACTION = new Set(["the", "a", "an", "another", "some", "more", "any", "all", "its", "their", "your", "his", "her"]);
const CONDITION = /^If\s[^,]*,/;

const atThen = (text: string, sentence: Span): Span[] => {
  const body = text.slice(sentence.start, sentence.end);
  if (/^If\s/i.test(body)) {
    return [sentence];
  }
  const spans: Span[] = [];
  let start = sentence.start;
  let then = sentence.then;
  for (const match of body.matchAll(THEN)) {
    const word = match[2]!.toLowerCase();
    if (NOT_AN_ACTION.has(word) || word.endsWith("ing") || word.endsWith("ly")) {
      continue;
    }
    const comma = sentence.start + match.index;
    spans.push({ start, end: comma, then });
    start = comma + match[0].indexOf(match[1]!);
    then = true;
  }
  spans.push({ start, end: sentence.end, then });
  return spans;
};

// docs/features/recipe-notes.md, "A step's actions": code, never a model, decides where one ends.
export const recipeActions = (steps: readonly RecipeStep[]): RecipeAction[] => {
  return steps.flatMap(({ text }, step) => {
    const lifted = LABEL.exec(text);
    const label = lifted !== null && lifted[0].length < text.trim().length ? lifted : null;
    const spans = sentenceSpans(text, label === null ? 0 : label[0].length).flatMap((sentence) =>
      atThen(text, { ...sentence, then: false }),
    );
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
};

export const isLastOfStep = (action: RecipeAction): boolean => action.index === action.count - 1;
