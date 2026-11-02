import { isProbablyReaderable, Readability } from "@mozilla/readability";
import { wordCount, type ArticleRead } from "@overview/domain";
import { articleMetadata } from "./articleMetadata.js";
import { articleSections } from "./articleSections.js";
import { canonicalArticleUrl } from "./canonicalArticleUrl.js";

const FEWEST_WORDS_IN_AN_ARTICLE = 100;
const MOST_WORDS_IN_A_PAYWALL_TEASER = 400;
const FEWEST_WORDS_TO_READ_WITHOUT_MARKUP = 500;
const MOST_WORDS_PER_SENTENCE_OF_PROSE = 60;

const wordsPerSentence = (text: string): number =>
  wordCount(text) / Math.max(text.match(/[.!?]["”’)]?(\s|$)/g)?.length ?? 1, 1);

// Readability takes the document apart as it reads, so it is handed a copy: this one is the
// page in the reader's tab. isProbablyReaderable looks for paragraphs, so prose laid out
// with line breaks has to qualify another way (docs/features/article-extraction.md).
export function readArticle(document: Document, pageUrl: string): ArticleRead {
  const metadata = articleMetadata(document);
  const parsed = new Readability(document.cloneNode(true) as Document).parse();
  const body = document.implementation.createHTMLDocument("").body;
  body.innerHTML = parsed?.content ?? "";
  const sections = articleSections(body, parsed?.title ?? "");
  const words = sections.reduce((total, { text }) => total + wordCount(text), 0);

  if (metadata.declaredPaywalled && words < MOST_WORDS_IN_A_PAYWALL_TEASER) {
    return { status: "failed", reason: "paywalled" };
  }
  const isMostlyProse =
    words >= FEWEST_WORDS_TO_READ_WITHOUT_MARKUP && wordsPerSentence(body.textContent ?? "") <= MOST_WORDS_PER_SENTENCE_OF_PROSE;
  const looksLikeAnArticle = metadata.isDeclaredArticle || isProbablyReaderable(document) || isMostlyProse;
  const title = parsed?.title?.trim() || document.title.trim();
  if (!looksLikeAnArticle || words < FEWEST_WORDS_IN_AN_ARTICLE || title === "") {
    return { status: "failed", reason: "nothing-readable" };
  }

  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
  return {
    status: "read",
    article: {
      url: canonicalArticleUrl(pageUrl, canonical),
      title,
      siteName: metadata.siteName ?? parsed?.siteName ?? null,
      author: metadata.author ?? parsed?.byline ?? null,
      publishedAt: metadata.publishedAt,
      language: document.documentElement.getAttribute("lang") || parsed?.lang || null,
      sections,
      wordCount: words,
    },
  };
}
