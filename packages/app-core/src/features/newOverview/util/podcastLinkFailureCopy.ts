import type { PodcastReadFailure } from "@overview/domain";
import type { ArticleFailureCopy } from "./articleFailureCopy.js";

const NOTHING_USED = "No overview was used.";

// Designs 106d–106f: one message for each of our server's reasons, in the reader's terms, each
// saying nothing was used, which holds because nothing is reserved until the words are found.
export function podcastLinkFailureCopy(reason: PodcastReadFailure, showName: string | null): ArticleFailureCopy {
  const show = showName ?? "This show";
  switch (reason) {
    case "not-an-episode":
      return {
        title: "That’s a link to the whole show",
        body: `We make an overview of one episode at a time. Open the episode you want, share it, and paste that link. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: "Use a different link",
      };
    case "not-found":
      return {
        title: showName === null ? "This episode isn’t in its show’s public feed" : `This episode isn’t in ${showName}’s public feed`,
        body: `We found the show, but not this episode. Some shows keep bonus episodes on Spotify only, and we only read what a show publishes openly. We won’t make an overview of a different episode instead. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: "Use a different link",
      };
    case "no-public-feed":
      return {
        title: `${show} looks like a Spotify exclusive`,
        body: `We couldn’t find a public feed for it, which usually means it’s only on Spotify. We can only read shows that publish openly. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: "Use a different link",
      };
    case "feed-unreadable":
      return {
        title: showName === null ? "We couldn’t read this show’s feed" : `We couldn’t read ${showName}’s feed`,
        body: `The show’s feed came back in a form we couldn’t make sense of. That’s usually down to the show’s host. Try again later, or try another episode. ${NOTHING_USED}`,
        way: "tryAnother",
        wayLabel: "Use a different link",
      };
    case "no-answer":
      return {
        title: "We didn’t hear back in time",
        body: `Looking up the episode took longer than 20 seconds. Try again in a moment. ${NOTHING_USED}`,
        way: "tryAgain",
        wayLabel: "Try again",
      };
  }
}
