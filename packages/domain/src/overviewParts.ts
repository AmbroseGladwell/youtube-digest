import type { Overview } from "./Overview.js";

export const OVERVIEW_PARTS = [
  "verdict",
  "dubiousClaim",
  "keyPoint",
  "step",
  "howToApply",
  "selling",
  "watchAnyway",
  "ingredient",
  "method",
  "chapter",
] as const;
export type OverviewPart = (typeof OVERVIEW_PARTS)[number];

export interface OverviewPartItem {
  part: OverviewPart;
  index: number;
  text: string;
}

const SINGLE_PARTS: ReadonlySet<OverviewPart> = new Set(["verdict", "selling", "watchAnyway"]);

const PART_ID_PREFIX: Record<OverviewPart, string> = {
  verdict: "verdict",
  dubiousClaim: "dubious",
  keyPoint: "kp",
  step: "step",
  howToApply: "apply",
  selling: "sells",
  watchAnyway: "anyway",
  ingredient: "ing",
  method: "method",
  chapter: "ch",
};

export const overviewPartId = (part: OverviewPart, index: number): string =>
  SINGLE_PARTS.has(part) ? PART_ID_PREFIX[part] : `${PART_ID_PREFIX[part]}${index + 1}`;

// Exactly the ids the model sees: docs/features/chats.md, "Citing the overview".
export const overviewParts = (overview: Overview): OverviewPartItem[] => {
  const items: OverviewPartItem[] = [];
  const add = (part: OverviewPart, texts: readonly string[]) => texts.forEach((text, index) => items.push({ part, index, text }));
  const { recipe, verdict } = overview;
  if (recipe !== null) {
    add("ingredient", recipe.ingredients);
    add(
      "method",
      recipe.steps.map(({ text }) => text),
    );
  } else {
    if (verdict !== null) {
      add("verdict", [verdict.reasoning]);
      add("dubiousClaim", verdict.dubiousClaims?.map(({ claim }) => claim) ?? []);
    }
    add(
      "keyPoint",
      overview.keyPoints.map(({ text }) => text),
    );
    add("step", overview.sourceSteps?.items.map(({ text }) => text) ?? []);
    add("howToApply", overview.howToApply?.items ?? []);
    if (overview.selling !== null && overview.selling.type !== "none") {
      add("selling", [overview.selling.detail]);
    }
    if (overview.watchAnyway !== null) {
      add("watchAnyway", [overview.watchAnyway.reason]);
    }
    if (overview.article?.readAnyway) {
      add("watchAnyway", [overview.article.readAnyway.reason]);
    }
  }
  add(
    "chapter",
    (overview.article?.chapters ?? overview.chapters ?? []).map(({ title }) => title),
  );
  return items;
};

// FNV-1a, 32 bits: the same on server and every client, without an async digest.
export const overviewPartHash = (text: string): string => {
  let hash = 0x811c9dc5;
  for (const char of text.trim()) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

export interface OverviewPartCitation {
  part: OverviewPart;
  index: number;
  textHash: string;
}

export interface CitedPart {
  part: OverviewPart;
  index: number | null;
}

// The item still holding the cited text, else its section (index null), else null.
export const citedOverviewPart = (overview: Overview, citation: OverviewPartCitation): CitedPart | null => {
  const inPart = overviewParts(overview).filter(({ part }) => part === citation.part);
  if (inPart.length === 0) {
    return null;
  }
  const same = (item: OverviewPartItem) => overviewPartHash(item.text) === citation.textHash;
  const atPlace = inPart.find(({ index }) => index === citation.index);
  const found = atPlace !== undefined && same(atPlace) ? atPlace : inPart.find(same);
  return { part: citation.part, index: found?.index ?? null };
};
