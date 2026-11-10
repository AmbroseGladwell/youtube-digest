import type { ArticlePlace, ExtractedArticle } from "@overview/domain";

const WORDS_IN_A_QUOTE = 8;

export interface ArticleParagraph {
  index: number;
  text: string;
  heading: string | null;
  place: ArticlePlace;
}

// The article numbered the way a transcript is, so the model names a paragraph and code
// decides where that is. Only a section's first paragraph can use the heading's id.
export const articleParagraphs = ({ sections }: ExtractedArticle): ArticleParagraph[] =>
  sections
    .flatMap(({ heading, anchor, text }) =>
      text.split("\n\n").map((paragraph, index) => ({
        text: paragraph,
        heading,
        place: {
          anchor: index === 0 ? anchor : null,
          quote: paragraph.split(/\s+/).slice(0, WORDS_IN_A_QUOTE).join(" "),
        },
      })),
    )
    .map((paragraph, index) => ({ ...paragraph, index }));

export interface ArticleSentence {
  index: number;
  paragraphIndex: number;
  text: string;
}

// A sentence ends at a full stop, a question or exclamation mark or an ellipsis, with any
// closing quote or bracket, before a space and a capital, a digit or an opening quote. "3.5"
// never splits; "Dr. Smith" does, which costs a quotation a word of context, not its truth.
const SENTENCE_END = /(?<=[.!?…]["”’)\]]*)\s+(?=["“‘([]?[\p{Lu}\p{N}])/u;

// Numbered across the whole article, so the model names sentences and code lifts them
// (docs/features/overview-generation-decisions.md, "Evidence").
export const articleSentences = (article: ExtractedArticle): ArticleSentence[] =>
  articleParagraphs(article)
    .flatMap(({ index: paragraphIndex, text }) =>
      text
        .split(SENTENCE_END)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .map((sentence) => ({ paragraphIndex, text: sentence })),
    )
    .map((sentence, index) => ({ ...sentence, index }));
