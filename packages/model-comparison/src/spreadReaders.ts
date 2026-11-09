import { composeReaderContext, type AboutYou, type LearnedItems } from "@overview/domain";

export interface ReaderCues {
  sentence: readonly string[];
  learned: readonly string[];
}

export interface SpreadReader {
  name: string;
  readerContext: string | null;
  cues: ReaderCues;
}

const NO_CUES: ReaderCues = { sentence: [], learned: [] };

const learnedFrom = (texts: readonly string[]): LearnedItems =>
  Object.fromEntries(
    texts.map((text, index) => [
      text,
      { text, source: "From 2 overviews", learnedAt: `2026-11-0${index + 1}T10:00:00.000Z`, noticedAt: `2026-11-0${index + 1}T11:00:00.000Z`, removedAt: null },
    ]),
  );

const reader = (name: string, aboutYou: AboutYou, cues: ReaderCues, learned: readonly string[] = []): SpreadReader => ({
  name,
  readerContext: composeReaderContext(aboutYou, learnedFrom(learned)),
  cues,
});

const NOBODY: readonly SpreadReader[] = [
  { name: "nobody", readerContext: null, cues: NO_CUES },
  { name: "nobody-again", readerContext: null, cues: NO_CUES },
];

// Composed the way the app composes a real reader's, and chosen to share as little as
// possible. "nobody" runs twice, and the two copies are the noise floor any difference
// between readers has to beat (docs/architecture/model-comparison.md, "Different readers").
// A reader's cues are the words an action would use if it drew on that part of the
// context: a proxy, counted by code, and only as good as the list.
const BROAD: readonly SpreadReader[] = [
  reader(
    "parent",
    { who: ["nurse", "parent of two under five"], time: ["night shifts", "the school run"], focus: ["getting more sleep"] },
    { sentence: ["nurse", "night", "shift", "child", "kid", "sleep", "school", "toddler", "famil"], learned: [] },
  ),
  reader(
    "founder",
    {
      who: ["founder of a two-person software company, with no children"],
      time: ["sales calls", "writing code"],
      focus: ["finding our first ten customers"],
    },
    { sentence: ["founder", "sales", "customer", "company", "prospect", "code", "startup"], learned: [] },
  ),
  reader(
    "retiree",
    { who: ["retired"], time: ["the allotment", "volunteering at the library"], focus: ["staying fit in my seventies"] },
    { sentence: ["retire", "pension", "allotment", "garden", "library", "volunteer", "seventies", "walking"], learned: [] },
  ),
  // A second parent, with one role and a different job, to tell "parents" from "that sentence".
  reader(
    "parent-two",
    { who: ["mum of a four-year-old"], time: ["part-time bookkeeping", "swimming lessons"], focus: ["calmer bedtimes"] },
    {
      sentence: ["mum", "child", "kid", "four-year", "preschool", "toddler", "famil", "bookkeep", "swim", "bedtime"],
      learned: [],
    },
  ),
];

// As detailed as a reader who filled in every part of About you and kept learning on.
const SPECIFIC: readonly SpreadReader[] = [
  reader(
    "specific-parent",
    {
      who: ["A&E nurse", "dad of twin three-year-olds"],
      time: ["12-hour night shifts three times a week", "nursery runs"],
      focus: ["sleeping properly between shifts", "losing the 10 kg I put on since the twins"],
    },
    {
      sentence: ["nurse", "A&E", "night", "shift", "twin", "three-year", "toddler", "nursery", "dad", "sleep", "10 kg", "weight"],
      learned: ["batch", "Sunday", "budget", "spreadsheet", "caffeine", "coffee", "strength", "lift"],
    },
    ["batch-cooks on Sundays", "keeps the family budget in a spreadsheet", "cutting down on caffeine", "into strength training"],
  ),
  reader(
    "specific-founder",
    {
      who: ["solo founder of an invoicing app for UK plumbers", "former accountant"],
      time: ["cold-emailing trade businesses", "building the app in React Native"],
      focus: ["getting from 40 to 100 paying customers", "charging more than £20 a month"],
    },
    {
      sentence: ["founder", "invoic", "plumber", "trade", "accountant", "cold", "email", "React", "40", "100", "£20", "pricing", "customer"],
      learned: ["ISA", "LinkedIn", "burn", "AI coding", "coding tool"],
    },
    ["investing through a stocks and shares ISA", "learning to post on LinkedIn", "worried about burning out", "trying AI coding tools"],
  ),
];

export const READER_SETS = {
  broad: [...NOBODY, ...BROAD],
  specific: [...NOBODY, ...SPECIFIC],
  all: [...NOBODY, ...BROAD, ...SPECIFIC],
} as const satisfies Record<string, readonly SpreadReader[]>;

export type ReaderSet = keyof typeof READER_SETS;

export const SPREAD_READERS: readonly SpreadReader[] = READER_SETS.broad;

// A reader's actions from an earlier run, judged in the same call as this run's, so a
// prompt change is compared under one bar: the judge's labels shift from run to run.
export const BEFORE = "@before";
export const asBefore = (reader: SpreadReader): SpreadReader => ({ ...reader, name: `${reader.name}${BEFORE}` });

export const NOISE_PAIR = ["nobody", "nobody-again"] as const;
