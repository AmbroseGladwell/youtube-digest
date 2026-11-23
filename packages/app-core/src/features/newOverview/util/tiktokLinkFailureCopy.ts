import type { TikTokLinkFailure, TikTokStop } from "../useTikTokLink.js";
import type { ArticleFailureCopy } from "./articleFailureCopy.js";

const NOTHING_USED = "Nothing was used.";
const TRY_ANOTHER = "Try another link";

// Designs 130l to 130n: each says what happened, never names the vendor, and ends "Nothing was used."
export const tiktokLinkFailureCopy = (reason: TikTokLinkFailure | "unreachable"): ArticleFailureCopy => {
  switch (reason) {
    case "unavailable":
      return { title: "This TikTok is private or has been removed", body: NOTHING_USED, way: "tryAnother", wayLabel: TRY_ANOTHER };
    case "blocked":
      return {
        title: "TikTok didn’t let us read this one",
        body: `Try again in a while. ${NOTHING_USED}`,
        way: "tryAgain",
        wayLabel: "Try again",
      };
    case "photo":
      return {
        title: "That’s a photo post, not a video",
        body: `Overviews need something said aloud. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: TRY_ANOTHER,
      };
    case "profile":
      return {
        title: "That’s a profile, not a video",
        body: `Paste a link to one video. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: TRY_ANOTHER,
      };
    default:
      return {
        title: "TikTok links aren’t working right now",
        body: `Try again later. Links from YouTube, web pages and podcasts still work. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: TRY_ANOTHER,
      };
  }
};

// Designs 130e and 130f: stops found before Create, never counted.
export const tiktokStopCopy = (stop: TikTokStop): ArticleFailureCopy =>
  stop === "no-captions"
    ? {
        title: "This TikTok has no captions",
        body: `So there are no words to make an overview from yet. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: TRY_ANOTHER,
      }
    : { title: "There’s no speech in this to make an overview from", body: NOTHING_USED, way: "tryAnother", wayLabel: TRY_ANOTHER };
