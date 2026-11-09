import { ABOUT_YOU_SECTIONS, sameTopicName, STARTER_TOPICS, type AboutYou, type AboutYouSection } from "@overview/domain";

export const ABOUT_YOU_SECTION_COPY: Record<AboutYouSection, { lead: string; empty: string; name: string; help: string }> = {
  who: {
    lead: "I'm ",
    empty: "a few things at once",
    name: "Who you are",
    help: "The people you are to others and where you are in life. Most people are several things at once, so add as many as you like.",
  },
  time: {
    lead: ", I spend my time on ",
    empty: "all sorts",
    name: "What you spend your time on",
    help: "Work and fun: your job, your studies, and what you'd happily spend a Saturday on.",
  },
  focus: {
    lead: ", and right now I'm focusing on ",
    empty: "getting better at something",
    name: "What you're focusing on",
    help: "What you're learning, building or working towards in life right now. As many as fit.",
  },
};

export interface SuggestionGroup {
  name: string;
  entries: readonly string[];
  example: string;
}

const LIFE: SuggestionGroup = {
  name: "Life",
  entries: [
    "fitness",
    "sleep",
    "parenting",
    "a career change",
    "a promotion",
    "languages",
    "buying a home",
    "a home project",
    "a wedding",
    "exams",
  ],
  example: "a half marathon",
};

const LEARNING: SuggestionGroup = {
  name: "Learning",
  entries: ["money", "starting a business", "coding", "new recipes"],
  example: "drawing",
};

const FIXED_GROUPS: Record<Exclude<AboutYouSection, "focus">, readonly SuggestionGroup[]> = {
  who: [
    {
      name: "Family and home",
      entries: ["dad", "mum", "parent", "husband", "wife", "partner", "son", "daughter", "grandparent", "carer", "pet owner", "homeowner"],
      example: "stepdad",
    },
    {
      name: "Where you are in life",
      entries: ["student", "graduate", "mid-career", "between jobs", "new in town", "first-time parent", "retired"],
      example: "back at uni",
    },
  ],
  time: [
    {
      name: "Work",
      entries: [
        "software",
        "design",
        "my own business",
        "freelancing",
        "teaching",
        "healthcare",
        "finance",
        "sales",
        "a trade",
        "studying",
      ],
      example: "nursing",
    },
    {
      name: "Fun",
      entries: ["basketball", "running", "gym", "cooking", "DIY", "gardening", "gaming", "music", "reading", "travel", "photography"],
      example: "climbing",
    },
  ],
};

export function aboutYouSuggestionGroups(section: AboutYouSection, topicNames: readonly string[]): readonly SuggestionGroup[] {
  if (section !== "focus") return FIXED_GROUPS[section];
  const fromTopics = STARTER_TOPICS.filter(({ name }) => topicNames.some((topic) => sameTopicName(topic, name))).map(
    ({ name, suggestions, example }): SuggestionGroup => ({ name: `From ${name}`, entries: suggestions, example }),
  );
  return fromTopics.length === 0 ? [LIFE, LEARNING] : [...fromTopics, LIFE];
}

// How many came from the reader's own words, the only thing analytics hears about what they typed.
export function typedEntryCount(aboutYou: AboutYou, topicNames: readonly string[]): number {
  return ABOUT_YOU_SECTIONS.flatMap((section) => {
    const offered = aboutYouSuggestionGroups(section, topicNames).flatMap(({ entries }) => entries);
    return aboutYou[section].filter((entry) => !offered.includes(entry));
  }).length;
}

export const capitalised = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
