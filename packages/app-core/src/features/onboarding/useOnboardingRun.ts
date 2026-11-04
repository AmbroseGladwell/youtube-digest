import { useEffect, useRef, useState } from "react";
import type { Overview } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { GenerationCancelledError } from "../newOverview/api/GenerationCancelledError.js";
import { useRunArticleGeneration, useRunOverviewGeneration } from "../newOverview/useRunOverviewGeneration.js";
import { createTrialArticleApi } from "../signedOutTrial/api/createTrialArticleApi.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { foundIn, type OnboardingFound, type OnboardingMakers, type OnboardingSource } from "./onboardingSources.js";

export type OnboardingRunPhase = "fetching" | "waiting" | "writing" | "ready" | "failed";

export interface OnboardingRun {
  phase: OnboardingRunPhase;
  found: OnboardingFound | null;
  overview: Overview | null;
  error: string | null;
}

const FETCHING: OnboardingRun = { phase: "fetching", found: null, overview: null, error: null };

// Onboarding's one overview, of whatever kind the link is: found straight away, written once
// the reader may be written for, so it is made from their answers. Signed out it is read and
// made on us through the device's trial, into the library that moves into the account
// (docs/features/onboarding.md, "Writing waits for the answers").
export function useOnboardingRun({
  source,
  target,
  mayWrite,
  attempt,
  onFound,
  onMade,
}: {
  source: OnboardingSource | null;
  target: string | null;
  mayWrite: boolean;
  attempt: number;
  onFound: (found: OnboardingFound) => void;
  onMade: (overview: Overview) => void;
}): OnboardingRun {
  const { apiKeys } = useApiKeys();
  const runVideo = useRunOverviewGeneration(apiKeys);
  const runArticle = useRunArticleGeneration(apiKeys);
  const knownApiUrl = useKnownApiUrl();
  const analytics = useAnalytics();
  const [run, setRun] = useState<OnboardingRun>(FETCHING);
  const makers: OnboardingMakers = {
    video: runVideo,
    article: runArticle,
    readArticle: (url) => {
      if (knownApiUrl === null) throw new Error("There's no server to read that link through.");
      return createTrialArticleApi({ baseUrl: knownApiUrl }).read(url);
    },
  };
  const latest = useRef({ source, makers, onFound, onMade, analytics });
  latest.current = { source, makers, onFound, onMade, analytics };
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
    setRun(FETCHING);
    latest.current.analytics.capture.newOverview.started({ from: "onboarding" });
    const writing = new Promise<void>((resolve) => {
      releaseWriting.current = resolve;
      if (mayWriteNow.current) resolve();
    });

    kind
      .make(target, latest.current.makers, {
        isCancelled: () => cancelled,
        waitToWrite: () => writing,
        onFound: (found) => {
          if (cancelled) return;
          latest.current.onFound(found);
          setRun((current) =>
            current.phase === "fetching"
              ? { phase: mayWriteNow.current ? "writing" : "waiting", found, overview: null, error: null }
              : current,
          );
        },
      })
      .then((overview) => {
        if (cancelled) return;
        latest.current.onMade(overview);
        setRun({ phase: "ready", found: foundIn(overview), overview, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled || error instanceof GenerationCancelledError) return;
        const message = error instanceof Error ? error.message : String(error);
        setRun((current) => ({ ...current, phase: "failed", error: message }));
      });

    return () => {
      cancelled = true;
      releaseWriting.current?.();
    };
  }, [target, attempt]);

  return run;
}
