import { readArticle } from "@overview/articles";
import { ARTICLE_READER_GLOBAL } from "./articleReaderGlobal.js";

Object.assign(globalThis, { [ARTICLE_READER_GLOBAL]: () => readArticle(document, location.href) });
