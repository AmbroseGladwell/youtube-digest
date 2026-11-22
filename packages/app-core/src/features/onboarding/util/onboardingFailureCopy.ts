import { domainOf, TRIAL_READS, TRIAL_READS_PER_ADDRESS_DAILY, type TikTokReadFailure } from "@overview/domain";
import type { ReaderPlace } from "../../newOverview/util/pastedLinkFailureCopy.js";
import type { OnboardingFailure } from "./onboardingFailureOf.js";
import { podcastLinkFailureCopy } from "../../newOverview/util/podcastLinkFailureCopy.js";
import { transcriptionCopy } from "../../podcasts/util/transcriptionCopy.js";

export interface OnboardingFailureCopy {
  title: string;
  body: string;
  tryAgain: boolean;
  extension: string | null;
  transcribe: string | null;
}

const failed = (title: string, body: string, more: Partial<OnboardingFailureCopy> = {}): OnboardingFailureCopy => ({
  title,
  body,
  tryAgain: false,
  extension: null,
  transcribe: null,
  ...more,
});

const isFrontPage = (url: string): boolean => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") === "";
  } catch {
    return false;
  }
};

// Until the Design round's failure frames (OV-130), in the words the other kinds use.
const tiktokReadCopy = (reason: TikTokReadFailure): OnboardingFailureCopy => {
  if (reason === "not-a-video") {
    return failed("That isn’t a TikTok video", "It may be a photo post or a profile. Paste a link to a video.");
  }
  if (reason === "unavailable") {
    return failed("We couldn't find that TikTok", "It may be private or taken down. Try another link.");
  }
  return failed("We couldn't reach TikTok just now", "Try again in a moment, or use another link.", { tryAgain: true });
};

// Why these words aren't the paste field's: docs/features/onboarding.md, "Any kind of link".
export const onboardingFailureCopy = (failure: OnboardingFailure, link: string, place: ReaderPlace): OnboardingFailureCopy => {
  switch (failure.kind) {
    case "trialReads":
      return failed(
        `You've tried ${TRIAL_READS} links on this device`,
        "That's as many as we can read before you have an account. Sign in if you have one, or try again tomorrow.",
      );
    case "trialReadsAddress":
      return failed(
        "We've read a lot of links from your network today",
        `Each network can read ${TRIAL_READS_PER_ADDRESS_DAILY} links a day before an account. Sign in if you have one, or try again tomorrow.`,
      );
    case "videoRead":
      return failure.reason === "not-found"
        ? failed("We couldn't find that video", "It may be private or taken down. Try another link.")
        : failed("We couldn't reach YouTube just now", "Try again in a moment, or use another link.", { tryAgain: true });
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
      );
    case "podcastNeedsTranscribing": {
      const ask = transcriptionCopy.ask(failure.episodeSeconds);
      return failed(ask.heading, ask.body, { transcribe: "Transcribe and create" });
    }
    case "transcriptionFailed": {
      const copy = transcriptionCopy.failed(failure.reason);
      return failed(copy.heading, copy.body.replace(/ Nothing was counted: no transcribing time and no overview\.$/, ""), {
        transcribe: copy.retry ? "Try again" : null,
      });
    }
    case "transcriptionRefused":
      return failure.refusal === "too-long"
        ? failed("Episodes over 4 hours can’t be transcribed", "If the show has it on YouTube, that link makes an overview of it instead.")
        : failed(
            "There isn’t enough transcribing left on this device",
            "A free account transcribes 5 hours a month. Have it on YouTube? Paste that link instead.",
          );
    case "tiktokRead":
      return tiktokReadCopy(failure.reason);
    case "tiktokNoCaptions":
      return failed(
        "This TikTok has no captions",
        "We found it, but TikTok has no words for it, and an overview is written from what’s said. Try another link.",
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
};
