import type { NoteLine } from "./NoteLine.js";
import { NOVELTY_LABEL, REASONING_LABEL, STANDS_OUT_LABEL } from "./noveltyLabel.js";
import type { SharedNote } from "./SharedNote.js";
import { SELLING_LABEL } from "./sellingLabel.js";
import { spokenDuration } from "./spokenDuration.js";
import type { ReadAnyway } from "./ArticleDetails.js";
import type { TimeRange, WatchAnswer, WatchAnyway } from "./WatchAnyway.js";
import { WATCH_ANYWAY_LABEL } from "./watchAnywayLabel.js";

export const SUMMARY_SECTION = "Summary";
export const KEY_POINTS_SECTION = "Key points";
export const HOW_TO_APPLY_SECTION = "How to apply";
export const WATCH_ANYWAY_SECTION = "Watch it anyway?";
export const READ_ANYWAY_SECTION = "Read it anyway?";
export const INGREDIENTS_SECTION = "Ingredients";
export const METHOD_SECTION = "Method";

interface Body {
  text: string;
  spoken?: string;
  range?: TimeRange;
  chapterIndex?: number;
  label?: string;
  chip?: string;
}

const keepsItsCapital = (word: string) =>
  word === "I" || word.startsWith("I'") || (word.length > 1 && word === word.toUpperCase()) || /.\p{Lu}/u.test(word);

const afterOrdinal = (item: string) => {
  const firstWord = item.split(/\s/, 1)[0] ?? "";
  return keepsItsCapital(firstWord) ? item : item.charAt(0).toLowerCase() + item.slice(1);
};

const KEY_POINT_LINKS = ["Then", "Also", "On top of that", "Next", "Beyond that"];
const ACTION_LINKS = ["Then"];

// docs/features/tts-pre-rendered-speech.md, "The spoken script".
const inOrder = (items: Body[], middleLinks: string[]): Body[] =>
  items.map((item, index) => {
    if (items.length === 1) {
      return item;
    }
    const link =
      index === 0
        ? "First"
        : index === items.length - 1
          ? "And finally"
          : middleLinks[(index - 1) % middleLinks.length]!;
    return { ...item, spoken: `${link}, ${afterOrdinal(item.text)}` };
  });

const withRange = ({ text, range }: { text: string; range: TimeRange | null }): Body =>
  range === null ? { text } : { text, range };

const COUNT_NAME = ["", "one", "two", "three", "four", "five", "six", "seven"];

const keyPointsHeading = (count: number) =>
  count >= 2 && count < COUNT_NAME.length ? `There are ${COUNT_NAME[count]} key points` : "The key points";

const spokenWatchAnswer = ({ answer, range }: WatchAnyway) => {
  if (answer === "yes") {
    return "Yes, it's worth watching.";
  }
  if (answer === "no") {
    return "No, you can probably skip the video, the overview covers it.";
  }
  return range === null
    ? "Yes, it's worth watching one part."
    : `Yes, it's worth watching one part, from ${spokenDuration(range.startMs)} to ${spokenDuration(range.endMs)}.`;
};

const READ_ANYWAY_LABEL: Record<WatchAnswer, string> = { no: "No", yes: "Yes", partial: "Just part of it" };

const spokenReadAnswer = ({ answer }: ReadAnyway, chapters: readonly string[]) => {
  if (answer === "yes") return "Yes, it's worth reading.";
  if (answer === "no") return "No, you can probably skip the article, the overview covers it.";
  return chapters.length === 0 ? "Yes, it's worth reading one part." : `Yes, it's worth reading part of it: ${chapters.join(", and ")}.`;
};

// One chapter has nowhere to link but the top of the page (design 77p).
export const hasChapterLinks = (overview: SharedNote): boolean => (overview.article?.chapters.length ?? 0) > 1;

// Takes SharedNote rather than Overview because a shared copy has to build the same body
// from the same fields, and the three the copy leaves out are ones this never read
// (docs/features/sharing.md). An Overview is a SharedNote with more on it.
// A recipe's ingredients can be read as the reader adjusted them, so what is heard is what is
// on screen (docs/features/recipe-notes.md, "Reading aloud").
export function overviewNoteLines(overview: SharedNote, shown: { ingredients?: readonly string[] } = {}): NoteLine[] {
  const lines: NoteLine[] = [];

  const section = (name: string, heading: Body, bodies: Body[], bullet = false) => {
    if (bodies.length === 0) {
      return;
    }
    lines.push({ section: name, heading: true, bullet: false, ...heading });
    for (const body of bodies) {
      lines.push({ section: name, heading: false, bullet, ...body });
    }
  };

  // A recipe's narration is the whole recipe, one section after another, so a single render
  // has every part ready; each list's Read aloud plays its own stretch of it (OV-148).
  if (overview.recipe) {
    const { recipe } = overview;
    const ingredients = shown.ingredients ?? recipe.ingredients;
    section(SUMMARY_SECTION, { text: SUMMARY_SECTION, spoken: "In short" }, [{ text: recipe.summary }]);
    section(
      INGREDIENTS_SECTION,
      { text: INGREDIENTS_SECTION, spoken: ingredients.length === 1 ? "There is one ingredient" : `There are ${ingredients.length} ingredients` },
      ingredients.map((text) => ({ text })),
      true,
    );
    section(
      METHOD_SECTION,
      { text: METHOD_SECTION, spoken: recipe.steps.length === 1 ? "The method, in one step" : `The method, in ${recipe.steps.length} steps` },
      recipe.steps.map(({ text }, index) => ({ text, spoken: `Step ${index + 1}. ${text}` })),
      true,
    );
    return lines;
  }

  section(SUMMARY_SECTION, { text: "Premise", spoken: "The premise" }, [{ text: overview.inOneLine }]);
  section(
    "Core claim",
    overview.thin ? { text: "No clear claim" } : { text: "Core claim", spoken: "The core claim" },
    [{ text: overview.coreClaim }],
  );

  if (overview.verdict) {
    const { novelty, standsOut, reasoning } = overview.verdict;
    section("Verdict", { text: "Verdict", spoken: "The verdict", chip: NOVELTY_LABEL[novelty] }, [
      ...(standsOut === null
        ? []
        : [
            {
              ...withRange({ text: standsOut.text, range: standsOut.range }),
              label: STANDS_OUT_LABEL,
              spoken: `${STANDS_OUT_LABEL}: ${standsOut.text}`,
            },
          ]),
      { text: reasoning, label: REASONING_LABEL },
    ]);
  }

  section(
    KEY_POINTS_SECTION,
    { text: KEY_POINTS_SECTION, spoken: keyPointsHeading(overview.keyPoints.length) },
    inOrder(
      overview.keyPoints.map((point, index) => {
        const chapterIndex = hasChapterLinks(overview) ? overview.article?.keyPointChapters[index] : null;
        return { ...withRange(point), ...(chapterIndex == null ? {} : { chapterIndex }) };
      }),
      KEY_POINT_LINKS,
    ),
    true,
  );
  section(
    HOW_TO_APPLY_SECTION,
    { text: HOW_TO_APPLY_SECTION, spoken: "How you could apply it" },
    inOrder((overview.howToApply?.items ?? []).map((text) => ({ text })), ACTION_LINKS),
    true,
  );

  if (overview.selling && overview.selling.type !== "none") {
    section("What it sells", { text: "What it sells", spoken: "What it's selling" }, [
      { text: `${SELLING_LABEL[overview.selling.type]}. ${overview.selling.detail}`.trim() },
    ]);
  }

  if (overview.watchAnyway) {
    const { watchAnyway } = overview;
    section(WATCH_ANYWAY_SECTION, { text: WATCH_ANYWAY_SECTION, spoken: "Should you watch it anyway?" }, [
      {
        ...withRange({ text: `${WATCH_ANYWAY_LABEL[watchAnyway.answer]}. ${watchAnyway.reason}`.trim(), range: watchAnyway.range }),
        spoken: `${spokenWatchAnswer(watchAnyway)} ${watchAnyway.reason}`.trim(),
      },
    ]);
  }

  const readAnyway = overview.article?.readAnyway;
  if (readAnyway) {
    const titles = readAnyway.chapterIndexes.flatMap((index) => overview.article?.chapters[index]?.title ?? []);
    const body = `${readAnyway.reason} ${readAnyway.leftOut}`.trim();
    section(READ_ANYWAY_SECTION, { text: READ_ANYWAY_SECTION, spoken: "Should you read it anyway?" }, [
      { text: `${READ_ANYWAY_LABEL[readAnyway.answer]}. ${body}`, spoken: `${spokenReadAnswer(readAnyway, titles)} ${body}` },
    ]);
  }

  return lines;
}

export function noteSectionNames(lines: NoteLine[]): string[] {
  return [...new Set(lines.map((line) => line.section))];
}
