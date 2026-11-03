import { aboutYouSentence, type AboutYou } from "./AboutYou.js";
import { keptLearnedItems, type LearnedItems } from "./LearnedItem.js";
import type { Settings } from "./Settings.js";

export const MAX_READER_CONTEXT_LENGTH = 600;

// What generation reads as the reader context (docs/features/personalisation.md). The prompt
// only ever gives it to How to apply. Learned items follow the sentence, newest first, for as
// many as fit under the cap; the sentence always fits.
export function composeReaderContext(aboutYou: AboutYou, learned: LearnedItems = {}): string | null {
  const sentence = aboutYouSentence(aboutYou);
  const fitted: string[] = [];
  for (const { text } of keptLearnedItems(learned)) {
    const line = learnedLine([...fitted, text]);
    if (sentence.length + 1 + line.length > MAX_READER_CONTEXT_LENGTH) break;
    fitted.push(text);
  }
  const context = [sentence, fitted.length === 0 ? "" : learnedLine(fitted)].filter((part) => part !== "").join(" ");
  return context === "" ? null : context;
}

const learnedLine = (items: readonly string[]) => `Also: ${items.join("; ")}.`;

// The old line is written beside the parts for clients from before them
// (docs/features/personalisation.md, "The old line").
export const aboutYouPatch = (aboutYou: AboutYou): Pick<Settings, "aboutYou" | "readerContext"> => ({
  aboutYou,
  readerContext: composeReaderContext(aboutYou),
});
