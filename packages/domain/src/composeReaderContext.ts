import { aboutYouSentence, type AboutYou } from "./AboutYou.js";
import { noticedLearnedItems, type LearnedItems } from "./LearnedItem.js";
import type { Settings } from "./Settings.js";

export const MAX_READER_CONTEXT_LENGTH = 600;

// Shown learned items follow the sentence, newest first, as fit (docs/features/personalisation.md).
export const composeReaderContext = (aboutYou: AboutYou, learned: LearnedItems = {}): string | null => {
  const sentence = aboutYouSentence(aboutYou);
  const fitted: string[] = [];
  for (const { text } of noticedLearnedItems(learned)) {
    const line = learnedLine([...fitted, text]);
    if (sentence.length + 1 + line.length > MAX_READER_CONTEXT_LENGTH) {
      break;
    }
    fitted.push(text);
  }
  const context = [sentence, fitted.length === 0 ? "" : learnedLine(fitted)].filter((part) => part !== "").join(" ");
  return context === "" ? null : context;
};

const learnedLine = (items: readonly string[]) => `Also: ${items.join("; ")}.`;

// docs/features/personalisation.md, "The old line".
export const aboutYouPatch = (aboutYou: AboutYou): Pick<Settings, "aboutYou" | "readerContext"> => ({
  aboutYou,
  readerContext: composeReaderContext(aboutYou),
});
