import { readArticle } from "@overview/articles";
import type { ArticleRead } from "@overview/domain";
import { parseHTML } from "linkedom";
import { parse, serialize } from "parse5";

const EMPTY_PAGE = "<!doctype html><html><head></head><body></body></html>";

const documentOf = (html: string): Document => {
  const { document } = parseHTML(html);
  if (document.implementation === undefined) {
    Object.defineProperty(document, "implementation", { value: { createHTMLDocument: () => parseHTML(EMPTY_PAGE).document } });
  }
  return document as unknown as Document;
};

// parse5 lays the page out as a browser would before linkedom builds it; neither runs script
// or loads anything (docs/features/pasted-article-links.md, "Parsing").
export function parseArticlePage(html: string, url: string): ArticleRead {
  return readArticle(documentOf(serialize(parse(html))), url);
}
