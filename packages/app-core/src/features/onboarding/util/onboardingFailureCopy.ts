import { domainOf, TRIAL_READS, TRIAL_READS_PER_ADDRESS_DAILY } from "@overview/domain";
import type { ReaderPlace } from "../../newOverview/util/pastedLinkFailureCopy.js";
import type { OnboardingFailure } from "./onboardingFailureOf.js";
import { podcastLinkFailureCopy } from "../../newOverview/util/podcastLinkFailureCopy.js";

export interface OnboardingFailureCopy {
  title: string;
  body: string;
  tryAgain: boolean;
  // Out of reads, only a video link is worth asking for: it uses none.
  videoOnly: boolean;
  extension: string | null;
  // Where Transcribe it will go once speech-to-text exists (design 106i).
  comingSoon: boolean;
}

const failed = (title: string, body: string, more: Partial<OnboardingFailureCopy> = {}): OnboardingFailureCopy => ({
  title,
  body,
  tryAgain: false,
  videoOnly: false,
  extension: null,
  comingSoon: false,
  ...more,
});

const isFrontPage = (url: string): boolean => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") === "";
  } catch {
    return false;
  }
};

// Designs 154l–154n: say why, then ask for another link. Never "nothing counted", since a trial
// read counts whether or not the page could be read; the free overview is what's untouched. A
// new reader isn't sent to the extension mid-onboarding, only told of it for afterwards.
export function onboardingFailureCopy(failure: OnboardingFailure, link: string, place: ReaderPlace): OnboardingFailureCopy {
  switch (failure.kind) {
    case "trialReads":
      return failed(
        `You've tried ${TRIAL_READS} pages on this device`,
        "That's as many as we can read before you have an account. Video links still work, so try one of those.",
        { videoOnly: true },
      );
    case "trialReadsAddress":
      return failed(
        "We've read a lot of pages from your network today",
        `Each network can read ${TRIAL_READS_PER_ADDRESS_DAILY} pages a day before an account. Video links still work, or try a page again tomorrow.`,
        { videoOnly: true },
      );
    case "other":
      return failed("We couldn't read that page", "Something went wrong reading it. Try again in a moment, or use another link.", {
        tryAgain: true,
      });
    case "podcastRead": {
      // The foot says the free overview is untouched, so the line the dialog ends on goes.
      const copy = podcastLinkFailureCopy(failure.reason, failure.showName);
      return failed(copy.title, copy.body.replace(/ No overview was used\.$/, ""), { tryAgain: copy.way === "tryAgain" });
    }
    case "podcastNoTranscript":
      return failed(
        "There’s no transcript for this episode yet",
        "We found the episode, but we couldn’t find a transcript for it, and an overview is written from the words. Many episodes don’t have one yet. Have it on YouTube? Paste that link instead.",
        { comingSoon: true },
      );
    case "read":
      break;
  }
  const site = failure.failure.siteName ?? domainOf(link);
  switch (failure.failure.reason) {
    case "blocked":
      return failed(`${site} didn't let us in`, "Some sites turn away apps like ours. A link from another site should work.", {
        extension:
          place === "computer"
            ? "On Chrome, the extension reads pages from your own browser, so sites like this let it in. You can add it after your first overview."
            : null,
      });
    case "no-answer":
      return failed(`${site} didn't respond`, "The site took too long to answer. Try again in a moment, or use another link.", {
        tryAgain: true,
      });
    case "unfinished":
      return failed("We couldn't finish reading that page", "Try again in a moment, or use another link.", { tryAgain: true });
    case "paywalled":
      return failed(
        "That article is behind a paywall",
        "We could only see the first few paragraphs, which isn't enough for an overview. Try one you can read without signing in.",
      );
    case "not-found":
      return failed("There's nothing we can read at that link", "Check the link, or paste another one.");
    default:
      return isFrontPage(link)
        ? failed(
            "That looks like a front page",
            "We make an overview of one article or recipe at a time. Open the one you want, then copy its link.",
          )
        : failed(
            "We couldn't read that page",
            "The page didn't give us its text. Some sites build their pages in a way we can't read yet.",
          );
  }
}
