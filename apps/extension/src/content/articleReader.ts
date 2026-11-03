import { readArticle, showArticlePlace } from "@overview/articles";
import type { ArticlePlace } from "@overview/domain";
import { ARTICLE_PLACE_GLOBAL, ARTICLE_READER_GLOBAL } from "./articleReaderGlobal.js";

Object.assign(globalThis, {
  [ARTICLE_READER_GLOBAL]: () => readArticle(document, location.href),
  [ARTICLE_PLACE_GLOBAL]: (place: ArticlePlace) => showArticlePlace(document, place),
});
