import type { ChatAnswerSections } from "./Chat.js";
import { answerBlocks } from "./answerBlocks.js";
import { sentenceSpans } from "./sentenceSpans.js";
import { speakable } from "./speakable.js";

export type SpokenAnswerPlace =
  | { part: "text" }
  | { part: "intro" }
  | { part: "heading"; section: number }
  | { part: "paragraph"; section: number; paragraph: number }
  | { part: "numbered"; section: number; item: number }
  | { part: "bullet"; section: number; item: number }
  | { part: "takeaway" };

export interface SpokenSentence {
  place: SpokenAnswerPlace;
  block: number;
  start: number;
  end: number;
  spoken: string;
}

export interface SpeakableAnswer {
  text: string;
  sections?: ChatAnswerSections;
}

export const CODE_ON_SCREEN = "There's a code example on screen.";
export const TABLE_ON_SCREEN = "There's a table on screen.";

const TABLE_ROW = /^\|.*\|$/;
const LINE_MARKER = /^(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/;
const LINK = /\[([^\]\n]+)\]\([^)\s]+\)/g;
const BARE_URL = /(?:https?:\/\/|www\.)[^\s)]*[^\s.,;:!?)]/gi;
const EMPHASIS = /\*\*|__|`|(?<![\p{L}\p{N}])[*_]|[*_](?![\p{L}\p{N}])/gu;
const ENDS_IN_PAUSE = /[.!?…:;]["'”’)]*$/;
const SAYS_SOMETHING = /[\p{L}\p{N}]/u;

const withPause = (text: string): string => (ENDS_IN_PAUSE.test(text) ? text : `${text}.`);

const speechOf = (shown: string): string => {
  const plain = shown
    .replace(LINK, "$1")
    .replace(BARE_URL, "")
    .replace(EMPHASIS, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return SAYS_SOMETHING.test(plain) ? speakable(withPause(plain)) : "";
};

const sentencesOfField = (text: string, place: SpokenAnswerPlace): SpokenSentence[] => {
  const spoken: SpokenSentence[] = [];
  answerBlocks(text).forEach((block, index, blocks) => {
    if (block.kind === "code") {
      spoken.push({ place, block: index, start: 0, end: block.code.length, spoken: CODE_ON_SCREEN });
      return;
    }
    if (TABLE_ROW.test(block.text)) {
      const before = blocks[index - 1];
      if (before?.kind !== "paragraph" || !TABLE_ROW.test(before.text)) {
        spoken.push({ place, block: index, start: 0, end: block.text.length, spoken: TABLE_ON_SCREEN });
      }
      return;
    }
    const marker = LINE_MARKER.exec(block.text)?.[0].length ?? 0;
    for (const { start, end } of sentenceSpans(block.text, marker)) {
      const said = speechOf(block.text.slice(start, end));
      if (said !== "") {
        spoken.push({ place, block: index, start, end, spoken: said });
      }
    }
  });
  return spoken;
};

const sentencesOfSections = ({ intro, sections, takeaway }: ChatAnswerSections): SpokenSentence[] => [
  ...sentencesOfField(intro, { part: "intro" }),
  ...sections.flatMap((section, at) => [
    ...sentencesOfField(section.heading, { part: "heading", section: at }),
    ...section.paragraphs.flatMap((paragraph, index) => sentencesOfField(paragraph, { part: "paragraph", section: at, paragraph: index })),
    ...section.numbered.flatMap((item, index) => sentencesOfField(item.text, { part: "numbered", section: at, item: index })),
    ...section.bullets.flatMap((item, index) => sentencesOfField(item.text, { part: "bullet", section: at, item: index })),
  ]),
  ...sentencesOfField(takeaway, { part: "takeaway" }),
];

// docs/features/chat-read-aloud.md, "The speech version".
export const spokenAnswer = (answer: SpeakableAnswer): SpokenSentence[] =>
  answer.sections === undefined ? sentencesOfField(answer.text, { part: "text" }) : sentencesOfSections(answer.sections);
