import { z } from "zod";

// The reader's sentence, in parts (design 141a). Each part holds as many entries as fit, so
// nobody is boxed into one role (docs/features/personalisation.md).
export const ABOUT_YOU_SECTIONS = ["who", "time", "focus"] as const;
export type AboutYouSection = (typeof ABOUT_YOU_SECTIONS)[number];

export const AboutYou = z.object({
  who: z.array(z.string()),
  time: z.array(z.string()),
  focus: z.array(z.string()),
});
export type AboutYou = z.infer<typeof AboutYou>;

export const EMPTY_ABOUT_YOU: AboutYou = { who: [], time: [], focus: [] };

export const MAX_ABOUT_YOU_SECTION_LENGTH = 120;

// What stops a role taking an article: "I'm retired", not "I'm a retired".
const STANDS_ALONE = new Set(["retired", "mid-career", "between jobs", "new in town"]);
const HAS_ITS_OWN_START = /^(a|an|the|my|our) /i;

const withArticle = (section: AboutYouSection, entry: string): string => {
  if (section !== "who" || STANDS_ALONE.has(entry) || HAS_ITS_OWN_START.test(entry)) return entry;
  return `${/^[aeiou]/i.test(entry) ? "an" : "a"} ${entry}`;
};

export const joinInProse = (parts: readonly string[]): string =>
  parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

export const aboutYouSectionText = (section: AboutYouSection, entries: readonly string[]): string =>
  joinInProse(entries.map((entry) => withArticle(section, entry)));

export const aboutYouIsEmpty = (aboutYou: AboutYou): boolean => ABOUT_YOU_SECTIONS.every((section) => aboutYou[section].length === 0);

export interface AboutYouSentencePart {
  text: string;
  filled: boolean;
}

const CLAUSES: readonly { section: AboutYouSection; lead: string }[] = [
  { section: "who", lead: "I'm" },
  { section: "time", lead: "I spend my time on" },
  { section: "focus", lead: "right now I'm focusing on" },
];

// Empty sections are left out, so what is read back and what is sent are always a whole
// sentence: "I'm a dad, and right now I'm focusing on sleep."
export function aboutYouSentenceParts(aboutYou: AboutYou): AboutYouSentencePart[] {
  const clauses = CLAUSES.filter(({ section }) => aboutYou[section].length > 0);
  const parts = clauses.flatMap(({ section, lead }, index) => {
    const opening = index === 0 ? `${lead.charAt(0).toUpperCase()}${lead.slice(1)}` : lead;
    const joiner = index === 0 ? "" : index === clauses.length - 1 ? ", and " : ", ";
    return [
      { text: `${joiner}${opening} `, filled: false },
      { text: aboutYouSectionText(section, aboutYou[section]), filled: true },
    ];
  });
  return parts.length === 0 ? [] : [...parts, { text: ".", filled: false }];
}

export const aboutYouSentence = (aboutYou: AboutYou): string =>
  aboutYouSentenceParts(aboutYou)
    .map(({ text }) => text)
    .join("");

export function firstAboutYouText(aboutYou: AboutYou): string | null {
  const section = ABOUT_YOU_SECTIONS.find((candidate) => aboutYou[candidate].length > 0);
  return section === undefined ? null : aboutYouSectionText(section, aboutYou[section]);
}
