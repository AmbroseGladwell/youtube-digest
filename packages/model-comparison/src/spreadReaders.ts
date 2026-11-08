import { composeReaderContext, type AboutYou } from "@overview/domain";

export interface SpreadReader {
  name: string;
  readerContext: string | null;
}

const reader = (name: string, aboutYou: AboutYou): SpreadReader => ({ name, readerContext: composeReaderContext(aboutYou) });

// Composed the way the app composes a real reader's, and chosen to share as little as
// possible: an action that reads the same for all three wasn't written for any of them.
// "nobody" runs twice, and the two copies are the noise floor any difference between
// readers has to beat (docs/architecture/model-comparison.md, "Different readers").
export const SPREAD_READERS: readonly SpreadReader[] = [
  { name: "nobody", readerContext: null },
  { name: "nobody-again", readerContext: null },
  reader("parent", {
    who: ["nurse", "parent of two under five"],
    time: ["night shifts", "the school run"],
    focus: ["getting more sleep"],
  }),
  reader("founder", {
    who: ["founder of a two-person software company, with no children"],
    time: ["sales calls", "writing code"],
    focus: ["finding our first ten customers"],
  }),
  reader("retiree", {
    who: ["retired"],
    time: ["the allotment", "volunteering at the library"],
    focus: ["staying fit in my seventies"],
  }),
];

export const NOISE_PAIR = ["nobody", "nobody-again"] as const;
