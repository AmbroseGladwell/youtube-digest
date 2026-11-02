import type { ArticlePlace, ExtractedArticle } from "@overview/domain";

const WORDS_IN_A_QUOTE = 8;

export interface ArticleParagraph {
  text: string;
  heading: string | null;
  place: ArticlePlace;
}

// The article numbered the way a transcript is, so the model names a paragraph and code
// decides where that is. Only a section's first paragraph can use the heading's id.
export const articleParagraphs = ({ sections }: ExtractedArticle): ArticleParagraph[] =>
  sections.flatMap(({ heading, anchor, text }) =>
    text.split("\n\n").map((paragraph, index) => ({
      text: paragraph,
      heading,
      place: {
        anchor: index === 0 ? anchor : null,
        quote: paragraph.split(/\s+/).slice(0, WORDS_IN_A_QUOTE).join(" "),
      },
    })),
  );
