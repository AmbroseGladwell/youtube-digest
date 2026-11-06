import { domainOf } from "@overview/domain";
import { useActiveVideoUrl } from "../../app/ActiveVideoContext.js";
import { useActivePage, useArticlePages } from "../../app/ArticlePagesContext.js";
import { isOfferedPage } from "../../app/isOfferedPage.js";
import { useWatchedTranscriptQuery } from "../transcripts/queries/watchedTranscriptQuery.js";
import { rememberPageAccess } from "./pageAccess.js";
import { START_VERB } from "./util/sampleFacts.js";
import { useStartOnboarding } from "./useStartOnboarding.js";

export interface StartSubject {
  // The headline's verb while the tab holds this (205g-2, 205g-3). A page is "Learn More,"
  // whatever it turns out to be: we don't read one until Create, so a recipe isn't known
  // here and Cook More waits for the deck's front card.
  verb: string;
  noun: "video" | "page";
  // The same card as signed in (205a), once the tab says enough to draw it: a video's
  // channel and title arrive with the captions, which noticing it fetched anyway.
  offer: { source: string; title: string; video: boolean } | null;
  make: () => void;
}

// What Start is beside, which in the panel is the tab and on the web is nothing: the shell
// supplies neither context there (docs/features/extension-panel.md).
export function useStartSubject(): StartSubject | null {
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  const pages = useArticlePages();
  const watchedVideo = useWatchedTranscriptQuery().data ?? null;
  const startOnboarding = useStartOnboarding();

  if (activeVideoUrl !== null) {
    return {
      verb: START_VERB.video,
      noun: "video",
      offer: watchedVideo === null ? null : { source: watchedVideo.channel, title: watchedVideo.title, video: true },
      make: () => void startOnboarding(activeVideoUrl),
    };
  }

  if (!isOfferedPage(activePage)) return null;

  return {
    verb: START_VERB.article,
    noun: "page",
    offer: { source: domainOf(activePage.url), title: activePage.title, video: false },
    // Chrome is asked inside the press, so the read spends no trial read (`pageAccess.ts`).
    make: () => {
      if (pages !== null) rememberPageAccess(activePage.url, pages.requestAccess(activePage.url));
      void startOnboarding(activePage.url, activePage.tabId);
    },
  };
}
