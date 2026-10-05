import type { NoteLine } from "./NoteLine.js";
import { NOVELTY_BASIS, NOVELTY_LABEL, STANDS_OUT_LABEL } from "./noveltyLabel.js";
import type { SharedNote } from "./SharedNote.js";
import { SELLING_LABEL } from "./sellingLabel.js";
import { spokenDuration } from "./spokenDuration.js";
import type { TimeRange, WatchAnyway } from "./WatchAnyway.js";
import { WATCH_ANYWAY_LABEL } from "./watchAnywayLabel.js";

export const SUMMARY_SECTION = "Summary";
export const KEY_POINTS_SECTION = "Key points";
export const HOW_TO_APPLY_SECTION = "How to apply";
export const WATCH_ANYWAY_SECTION = "Watch it anyway?";

interface Body {
  text: string;
  spoken?: string;
  range?: TimeRange;
  footnote?: boolean;
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

// Takes SharedNote rather than Overview because a shared copy has to build the same body
// from the same fields, and the three the copy leaves out are ones this never read
// (docs/features/sharing.md). An Overview is a SharedNote with more on it.
export function overviewNoteLines(overview: SharedNote): NoteLine[] {
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

  section(SUMMARY_SECTION, { text: "Premise", spoken: "The premise" }, [{ text: overview.inOneLine }]);
  section(
    "Core claim",
    overview.thin ? { text: "No clear claim" } : { text: "Core claim", spoken: "The core claim" },
    [{ text: overview.coreClaim }],
  );

  if (overview.verdict) {
    const { novelty, standsOut, reasoning } = overview.verdict;
    section("Verdict", { text: "Verdict", spoken: "The verdict" }, [
      { text: `${NOVELTY_LABEL[novelty]}.`, spoken: "" },
      ...(standsOut === null
        ? []
        : [withRange({ text: `${STANDS_OUT_LABEL}: ${standsOut.text}`, range: standsOut.range })]),
      { text: NOVELTY_BASIS, spoken: "", footnote: true },
      { text: reasoning },
    ]);
  }

  section(
    KEY_POINTS_SECTION,
    { text: KEY_POINTS_SECTION, spoken: keyPointsHeading(overview.keyPoints.length) },
    inOrder(overview.keyPoints.map(withRange), KEY_POINT_LINKS),
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

  return lines;
}

export function noteSectionNames(lines: NoteLine[]): string[] {
  return [...new Set(lines.map((line) => line.section))];
}
