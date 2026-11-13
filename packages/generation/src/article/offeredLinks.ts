import type { ExtractedArticle, PageLink } from "@overview/domain";

export const MOST_LINKS_OFFERED = 60;

export interface OfferedLink extends PageLink {
  index: number;
  // Numbered as articleParagraphs numbers it, across the whole piece.
  articleParagraph: number;
}

// Numbered across the piece, so the model names a link and code copies it. Past the cap a
// long read's citations are cut rather than the prompt grown (docs/features/article-resources.md).
export function offeredLinks({ sections }: Pick<ExtractedArticle, "sections">): OfferedLink[] {
  let before = 0;
  return sections
    .flatMap(({ text, links }) => {
      const first = before;
      before += text.split("\n\n").length;
      return links.map((link) => ({ ...link, articleParagraph: first + link.paragraph }));
    })
    .slice(0, MOST_LINKS_OFFERED)
    .map((link, index) => ({ ...link, index }));
}
