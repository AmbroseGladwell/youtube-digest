import { domainOf } from "@overview/domain";
import type { ArticleFailure } from "../api/ArticleReadError.js";
import { CHROME_EXTENSION_URL } from "../../../util/chromeExtensionUrl.js";
import type { ArticleFailureCopy } from "./articleFailureCopy.js";

// Where the reader could read it themselves: already in the extension, on a computer that
// could have it, or on a phone that can't.
export type ReaderPlace = "extension" | "computer" | "phone";

export interface PastedLinkFailureCopy extends ArticleFailureCopy {
  href: string | null;
  after: string | null;
  sentToExtension: boolean;
}

const plain = (title: string, body: string, way: "tryAgain" | "tryAnother", wayLabel: string): PastedLinkFailureCopy => ({
  title,
  body,
  way,
  wayLabel,
  href: null,
  after: null,
  sentToExtension: false,
});

const elsewhere = (url: string, place: ReaderPlace, title: string, why: string): PastedLinkFailureCopy => {
  switch (place) {
    case "extension":
      return {
        title,
        body: `${why} The extension reads it in your own Chrome, so it works there. Nothing counted.`,
        way: "reload",
        wayLabel: "Open the article in a new tab",
        href: url,
        after: "Then press Create overview in the side panel.",
        sentToExtension: true,
      };
    case "computer":
      return {
        title,
        body: `${why} The Chrome extension can read it from your own browser. Nothing counted.`,
        way: "reload",
        wayLabel: "Get the extension on the Chrome Web Store",
        href: CHROME_EXTENSION_URL,
        after: null,
        sentToExtension: true,
      };
    case "phone":
      return plain(title, `${why} On a computer, the Chrome extension can read it. Nothing counted.`, "tryAnother", "Try another link");
  }
};

// Designs 77an–77aq: says why in the publisher's terms, then sends the reader to the one place
// it can work. What failed here failed on our server, so the reader's own browser may still
// get in.
export function pastedLinkFailureCopy(failure: ArticleFailure, url: string, place: ReaderPlace): PastedLinkFailureCopy {
  const site = failure.siteName ?? domainOf(url);
  switch (failure.reason) {
    case "blocked":
      return elsewhere(url, place, `${site} doesn’t let us read it from here`, "Some sites turn away readers that aren’t a browser.");
    case "paywalled":
      return elsewhere(
        url,
        place,
        "Only the opening came through",
        `The rest is behind ${site}’s paywall. If you subscribe, you’re signed in where the extension reads it.`,
      );
    case "no-answer":
      return plain(`${domainOf(url)} didn’t answer`, "It may be down for a while. Nothing counted.", "tryAgain", "Try again");
    case "unfinished":
      return plain("We couldn’t finish reading that page", "Try again in a moment. Nothing counted.", "tryAgain", "Try again");
    case "not-found":
      return plain(
        "There’s nothing we can read at that link",
        "Check the link, or paste another one. Nothing counted.",
        "tryAnother",
        "Try another link",
      );
    default:
      return plain(
        "That link isn’t an article",
        "It doesn’t look like a single story or post. Paste the link to one. Nothing counted.",
        "tryAnother",
        "Try another link",
      );
  }
}
