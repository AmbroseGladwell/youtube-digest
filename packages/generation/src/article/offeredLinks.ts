import type { ExtractedArticle, PageLink } from "@overview/domain";

export const MOST_LINKS_OFFERED = 60;

export interface OfferedLink extends PageLink {
  index: number;
  articleParagraph: number;
}

// Why long reads lose links past the cap: docs/features/article-resources.md, "The model points, code copies".
export const offeredLinks = ({ sections }: Pick<ExtractedArticle, "sections">): OfferedLink[] => {
  let before = 0;
  return sections
    .flatMap(({ text, links }) => {
      const first = before;
      before += text.split("\n\n").length;
      return links.map((link) => ({ ...link, articleParagraph: first + link.paragraph }));
    })
    .slice(0, MOST_LINKS_OFFERED)
    .map((link, index) => ({ ...link, index }));
};
