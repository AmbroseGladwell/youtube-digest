import type { ArticleLink, ExtractedArticle } from "@overview/domain";

export const MOST_LINKS_OFFERED = 60;

export interface OfferedLink extends ArticleLink {
  index: number;
  section: number;
}

// Numbered across the piece, so the model names a link and code copies it. Past the cap a
// long read's citations are cut rather than the prompt grown (docs/features/article-resources.md).
export const offeredLinks = ({ sections }: Pick<ExtractedArticle, "sections">): OfferedLink[] =>
  sections
    .flatMap(({ links }, section) => links.map((link) => ({ ...link, section })))
    .slice(0, MOST_LINKS_OFFERED)
    .map((link, index) => ({ ...link, index }));
