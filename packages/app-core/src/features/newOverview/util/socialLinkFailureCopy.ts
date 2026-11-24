import { SOCIAL_PLATFORM_NAME, type SocialPlatform, type SocialReadFailure } from "@overview/domain";
import type { SocialStop } from "../useSocialLink.js";
import type { ArticleFailureCopy } from "./articleFailureCopy.js";

const NOTHING_USED = "Nothing was used.";
const TRY_ANOTHER = "Try another link";

// As TikTok's (130l–130n): says what happened, never names the vendor, ends "Nothing was used."
export const socialLinkFailureCopy = (reason: SocialReadFailure | "unreachable", platform: SocialPlatform | null): ArticleFailureCopy => {
  const name = platform === null ? "Instagram and Facebook" : SOCIAL_PLATFORM_NAME[platform];
  switch (reason) {
    case "unavailable":
      return { title: "This post is private or has been removed", body: NOTHING_USED, way: "tryAnother", wayLabel: TRY_ANOTHER };
    case "blocked":
      return {
        title: `${name} didn’t let us read this one`,
        body: `Try again in a while. ${NOTHING_USED}`,
        way: "tryAgain",
        wayLabel: "Try again",
      };
    case "not-a-post":
      return {
        title: "That’s not a post",
        body: `Paste a link to one post, reel or video. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: TRY_ANOTHER,
      };
    case "unreadable":
      return { title: "We couldn’t read this post", body: NOTHING_USED, way: "tryAnother", wayLabel: TRY_ANOTHER };
    default:
      return {
        title: `${name} links aren’t working right now`,
        body: `Try again later. Links from YouTube, TikTok, web pages and podcasts still work. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: TRY_ANOTHER,
      };
  }
};

const STOP_TITLE: Record<SocialStop, string> = {
  "no-words": "This video has no words we can find",
  "no-speech": "There’s no speech in this to make an overview from",
  "too-few-words": "There isn’t enough written in this post to make an overview from",
};

// Found before Create, never counted; comments are never read, so a post's words are its description's.
export const socialStopCopy = (stop: SocialStop): ArticleFailureCopy => ({
  title: STOP_TITLE[stop],
  body: NOTHING_USED,
  way: "tryAnother",
  wayLabel: TRY_ANOTHER,
});
