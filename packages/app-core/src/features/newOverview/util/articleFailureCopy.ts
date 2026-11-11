import { domainOf } from "@overview/domain";
import type { ArticleFailure } from "../api/ArticleReadError.js";

export type ArticleFailureWay = "askAgain" | "tryAgain" | "tryAnother" | "reload" | null;

export interface ArticleFailureCopy {
  title: string;
  body: string;
  way: ArticleFailureWay;
  wayLabel: string | null;
}

// Designs 77ai–77al. Each title says what happened, not what the reader did, and each body
// says that the month's count is untouched, which holds because nothing is reserved until
// the page has been read. The site's own name is only known if the page gave it. The last
// three reasons of no-access's group come from our server, so only a pasted link meets them
// (pastedLinkFailureCopy.ts).
export function articleFailureCopy(failure: ArticleFailure, url: string): ArticleFailureCopy {
  const host = domainOf(url);
  const site = failure.siteName ?? host;
  switch (failure.reason) {
    case "declined":
      return {
        title: `Chrome didn’t allow ${host}`,
        body: "So we couldn’t read the article. Nothing was made, and nothing counted.",
        way: "askAgain",
        wayLabel: "Ask Chrome again",
      };
    case "paywalled":
      return {
        title: "Only the opening is showing",
        body: `The page gave us ${(failure.shownWords ?? 0).toLocaleString("en-GB")} words, and the rest is behind ${site}’s paywall. If you subscribe, sign in on the page, then try again. Nothing counted.`,
        way: "tryAgain",
        wayLabel: "Try again",
      };
    case "not-loaded":
      return {
        title: "The page didn’t finish loading",
        body: `${host} stopped answering before we could read it. Nothing counted.`,
        way: "reload",
        wayLabel: "Reload and try again",
      };
    case "no-access":
    case "blocked":
    case "not-found":
    case "no-answer":
      return {
        title: "Chrome doesn’t let us read this page",
        body: "Some pages are closed to every extension. Nothing counted.",
        way: null,
        wayLabel: null,
      };
    case "unfinished":
      return {
        title: "We couldn’t finish reading this page",
        body: "Try again in a moment. Nothing counted.",
        way: "tryAgain",
        wayLabel: "Try again",
      };
    case "nothing-readable":
      return {
        title: "This page isn’t an article",
        body: "It doesn’t look like a single story or post. Open one, and you can make an overview of it here. Nothing counted.",
        way: null,
        wayLabel: null,
      };
  }
}
