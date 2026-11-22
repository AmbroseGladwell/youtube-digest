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

// Why parse5 then linkedom: docs/features/pasted-article-links.md, "Parsing".
export const parseArticlePage = (html: string, url: string): ArticleRead => {
  return readArticle(documentOf(serialize(parse(html))), url);
};
