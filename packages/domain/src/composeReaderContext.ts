import { aboutYouSentence, type AboutYou } from "./AboutYou.js";
import type { Settings } from "./Settings.js";

// What generation reads as the reader context (docs/features/personalisation.md). The prompt
// only ever gives it to How to apply.
export function composeReaderContext(aboutYou: AboutYou): string | null {
  const sentence = aboutYouSentence(aboutYou);
  return sentence === "" ? null : sentence;
}

// The old line is written beside the parts for clients from before them
// (docs/features/personalisation.md, "The old line").
export const aboutYouPatch = (aboutYou: AboutYou): Pick<Settings, "aboutYou" | "readerContext"> => ({
  aboutYou,
  readerContext: composeReaderContext(aboutYou),
});
