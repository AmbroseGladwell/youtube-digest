import { readArticle } from "@overview/articles";
import type { ArticleRead } from "@overview/domain";
import { JSDOM } from "jsdom";

// jsdom's defaults are what make this safe to run on a stranger's page: it runs no script
// and loads no resource, so the page can't make our server do anything further.
export function parseArticlePage(html: string, url: string): ArticleRead {
  const dom = new JSDOM(html, { url });
  try {
    return readArticle(dom.window.document, url);
  } finally {
    dom.window.close();
  }
}
