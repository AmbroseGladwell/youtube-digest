import {
  citedOverviewPart,
  LISTEN_ANYWAY_HEADING,
  OVERVIEW_PARTS,
  overviewParts,
  READ_ANYWAY_SECTION,
  WATCH_ANYWAY_SECTION,
  type ArticlePlace,
  type ChatCitation,
  type Overview,
  type OverviewPart,
  type OverviewPartCitation,
  isWrittenSource,
} from "@overview/domain";

export type OverviewCitationView =
  | { kind: "item"; part: OverviewPart; index: number; label: string; opening: string; place?: ArticlePlace }
  | { kind: "changed"; part: OverviewPart; label: string }
  | { kind: "gone"; part: OverviewPart; section: string };

const OPENING_WORDS = 6;

const anywaySectionOf = (overview: Overview): string => {
  if (overview.source.kind === "podcast") {
    return LISTEN_ANYWAY_HEADING;
  }
  return isWrittenSource(overview.source) ? READ_ANYWAY_SECTION : WATCH_ANYWAY_SECTION;
};

const sectionOf = (part: OverviewPart, overview: Overview): string =>
  ({
    verdict: "Verdict",
    dubiousClaim: "Why it's dubious",
    keyPoint: "Key points",
    step: "The steps it gives",
    howToApply: "How to apply",
    selling: "What it's selling",
    watchAnyway: anywaySectionOf(overview),
    chapter: "Chapters",
    ingredient: "Ingredients",
    method: "Method",
  })[part];

// An unnumbered section is numbered only when one answer cites two of its items (319b).
const labelOf = (part: OverviewPart, index: number, text: string | null, overview: Overview, twice: boolean): string => {
  const numbered = (name: string) => `${name} ${index + 1}`;
  switch (part) {
    case "keyPoint":
      return numbered("Key point");
    case "step":
      return numbered("Step");
    case "method":
      return numbered("Method step");
    case "chapter":
      return text === null ? sectionOf(part, overview) : `Chapter: ${text}`;
    case "ingredient":
      return text === null ? sectionOf(part, overview) : `Ingredient: ${text}`;
    case "howToApply":
    case "dubiousClaim":
      return twice ? `${sectionOf(part, overview)}, ${index + 1}` : sectionOf(part, overview);
    default:
      return sectionOf(part, overview);
  }
};

const openingOf = (text: string): string => {
  const words = text.trim().split(/\s+/);
  return words.length > OPENING_WORDS ? `${words.slice(0, OPENING_WORDS).join(" ")}…` : words.join(" ");
};

const chapterIndexOf = (article: NonNullable<Overview["article"]>, part: OverviewPart, index: number): number | null | undefined => {
  if (part === "chapter") {
    return index;
  }
  return part === "keyPoint" ? article.keyPointChapters[index] : null;
};

const placeOf = (overview: Overview, part: OverviewPart, index: number): ArticlePlace | undefined => {
  const article = overview.article;
  if (article === null) {
    return undefined;
  }
  const chapter = chapterIndexOf(article, part, index);
  return chapter === null || chapter === undefined ? undefined : article.chapters[chapter]?.place;
};

const isOverviewCitation = (citation: ChatCitation): citation is Extract<ChatCitation, OverviewPartCitation> => "part" in citation;

export const overviewCitationViews = (overview: Overview, citations: readonly ChatCitation[]): OverviewCitationView[] => {
  const cited = citations
    .filter(isOverviewCitation)
    .sort((a, b) => OVERVIEW_PARTS.indexOf(a.part) - OVERVIEW_PARTS.indexOf(b.part) || a.index - b.index);
  const items = overviewParts(overview);
  const citedTwice = (part: OverviewPart) => cited.filter((citation) => citation.part === part).length > 1;
  return cited.map((citation): OverviewCitationView => {
    const landed = citedOverviewPart(overview, citation);
    if (landed === null) {
      return { kind: "gone", part: citation.part, section: sectionOf(citation.part, overview) };
    }
    if (landed.index === null) {
      return {
        kind: "changed",
        part: citation.part,
        label: labelOf(citation.part, citation.index, null, overview, citedTwice(citation.part)),
      };
    }
    const text = items.find(({ part, index }) => part === landed.part && index === landed.index)?.text ?? "";
    const place = placeOf(overview, landed.part, landed.index);
    return {
      kind: "item",
      part: landed.part,
      index: landed.index,
      label: labelOf(landed.part, landed.index, text, overview, citedTwice(landed.part)),
      opening: openingOf(text),
      ...(place === undefined ? {} : { place }),
    };
  });
};
