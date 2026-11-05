import { useEffect, useRef, useState } from "react";
import type { Overview } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { GenerationCancelledError } from "../newOverview/api/GenerationCancelledError.js";
import { useRunArticleGeneration, useRunOverviewGeneration } from "../newOverview/useRunOverviewGeneration.js";
import { useArticlePages } from "../../app/ArticlePagesContext.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useOpenLibrary } from "../../stores/OpenLibraryContext.js";
import { useStores } from "../../stores/StoresContext.js";
import type { Library } from "../../stores/Library.js";
import { createTrialArticleApi } from "../signedOutTrial/api/createTrialArticleApi.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { foundIn, type OnboardingFound, type OnboardingMakers, type OnboardingSource } from "./onboardingSources.js";
import { pageAccessFor } from "./pageAccess.js";
import { onboardingFailureOf, type OnboardingFailure } from "./util/onboardingFailureOf.js";

export type OnboardingRunPhase = "fetching" | "waiting" | "writing" | "ready" | "failed";

export interface OnboardingRun {
  phase: OnboardingRunPhase;
  found: OnboardingFound | null;
  overview: Overview | null;
  failure: OnboardingFailure | null;
}

const FETCHING: OnboardingRun = { phase: "fetching", found: null, overview: null, failure: null };

// Onboarding's one overview, of whatever kind the link is: found straight away, written once
// the reader may be written for, so it is made from their answers. Signed out it is read and
// made on us through the device's trial, into the no-account library, which it holds open
// beside whatever the app shows: a sign-in mid-run swaps the app's library, and the run
// finishes where it started, then the move brings the overview in. A run started signed in
// writes into the account's library. A page the panel was beside is read in the browser where
// Chrome allows it, spending no trial read (docs/features/onboarding.md, "Writing waits for
// the answers" and "Into the account").
export function useOnboardingRun({
  source,
  target,
  tabId,
  mayWrite,
  attempt,
  onFound,
  onMade,
}: {
  source: OnboardingSource | null;
  target: string | null;
  tabId: number | null;
  mayWrite: boolean;
  attempt: number;
  onFound: (found: OnboardingFound) => void;
  onMade: (overview: Overview) => void;
}): OnboardingRun {
  const { apiKeys } = useApiKeys();
  const runVideo = useRunOverviewGeneration(apiKeys);
  const runArticle = useRunArticleGeneration(apiKeys);
  const knownApiUrl = useKnownApiUrl();
  const pages = useArticlePages();
  const analytics = useAnalytics();
  const shown = useStores();
  const shownAccountId = useLibraryAccountId();
  const openLibrary = useOpenLibrary();
  // Kept with the try it belongs to, so a new try never shows the last one's result.
  const key = `${target ?? ""}#${attempt}`;
  const [state, setState] = useState<{ key: string; run: OnboardingRun }>({ key, run: FETCHING });
  const setRun = (next: OnboardingRun | ((current: OnboardingRun) => OnboardingRun)) =>
    setState((current) => ({ key, run: typeof next === "function" ? next(current.run) : next }));
  const readArticle = async (url: string) => {
    if (tabId !== null && pages !== null && (await pageAccessFor(pages, url))) return pages.read(tabId);
    if (knownApiUrl === null) throw new Error("There's no server to read that link through.");
    return createTrialArticleApi({ baseUrl: knownApiUrl }).read(url);
  };
  const latest = useRef({ source, runVideo, runArticle, readArticle, onFound, onMade, analytics, shown, shownAccountId, openLibrary });
  latest.current = { source, runVideo, runArticle, readArticle, onFound, onMade, analytics, shown, shownAccountId, openLibrary };
  const mayWriteNow = useRef(mayWrite);
  const releaseWriting = useRef<(() => void) | null>(null);

  useEffect(() => {
    mayWriteNow.current = mayWrite;
    if (mayWrite) releaseWriting.current?.();
    setRun((current) => (mayWrite && current.phase === "waiting" ? { ...current, phase: "writing" } : current));
  }, [mayWrite]);

  useEffect(() => {
    const kind = latest.current.source;
    if (target === null || kind === null) return;
    let cancelled = false;
    let beside: Library | null = null;
    setRun(FETCHING);
    latest.current.analytics.capture.newOverview.started({ from: "onboarding" });
    const writing = new Promise<void>((resolve) => {
      releaseWriting.current = resolve;
      if (mayWriteNow.current) resolve();
    });

    const library = async () => {
      if (latest.current.shownAccountId !== null || latest.current.openLibrary === null) return latest.current.shown;
      beside = await latest.current.openLibrary(null, { shown: false });
      return beside.stores;
    };
    const makers = (stores: Awaited<ReturnType<typeof library>>): OnboardingMakers => ({
      video: (url, options) => latest.current.runVideo(url, options, stores),
      article: (read, options) => latest.current.runArticle(read, options, stores),
      readArticle: (url) => latest.current.readArticle(url),
    });

    library()
      .then((stores) =>
        kind.make(target, makers(stores), {
          isCancelled: () => cancelled,
          waitToWrite: () => writing,
          onFound: (found) => {
            if (cancelled) return;
            latest.current.onFound(found);
            setRun((current) =>
              current.phase === "fetching"
                ? { phase: mayWriteNow.current ? "writing" : "waiting", found, overview: null, failure: null }
                : current,
            );
          },
        }),
      )
      .then((overview) => {
        if (cancelled) return;
        latest.current.onMade(overview);
        setRun({ phase: "ready", found: foundIn(overview), overview, failure: null });
      })
      .catch((error: unknown) => {
        if (cancelled || error instanceof GenerationCancelledError) return;
        setRun((current) => ({ ...current, phase: "failed", failure: onboardingFailureOf(error) }));
      })
      .finally(() => beside?.close());

    return () => {
      cancelled = true;
      releaseWriting.current?.();
    };
  }, [target, attempt]);

  return target === null || state.key === key ? state.run : FETCHING;
}
