import { useEffect, useRef, useState } from "react";
import type { Overview, VideoSource } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { GenerationCancelledError } from "../newOverview/api/GenerationCancelledError.js";
import { useRunOverviewGeneration } from "../newOverview/useRunOverviewGeneration.js";

export type OnboardingRunPhase = "fetching" | "waiting" | "writing" | "ready" | "failed";

export interface OnboardingRun {
  phase: OnboardingRunPhase;
  video: VideoSource | null;
  overview: Overview | null;
  error: string | null;
}

const FETCHING: OnboardingRun = { phase: "fetching", video: null, overview: null, error: null };

// Onboarding's one overview: the video and its transcript straight away, the writing once
// the reader may be written for, so it is made from their answers. Signed out it is made on
// us through the device's trial, into the library that moves into the account
// (docs/features/onboarding.md, "Writing waits for the answers").
export function useOnboardingRun({
  videoUrl,
  mayWrite,
  attempt,
  onMade,
}: {
  videoUrl: string | null;
  mayWrite: boolean;
  attempt: number;
  onMade: (overview: Overview) => void;
}): OnboardingRun {
  const { apiKeys } = useApiKeys();
  const runGeneration = useRunOverviewGeneration(apiKeys);
  const analytics = useAnalytics();
  const [run, setRun] = useState<OnboardingRun>(FETCHING);
  const latest = useRef({ runGeneration, onMade, analytics });
  latest.current = { runGeneration, onMade, analytics };
  const mayWriteNow = useRef(mayWrite);
  const releaseWriting = useRef<(() => void) | null>(null);

  useEffect(() => {
    mayWriteNow.current = mayWrite;
    if (mayWrite) releaseWriting.current?.();
    setRun((current) => (mayWrite && current.phase === "waiting" ? { ...current, phase: "writing" } : current));
  }, [mayWrite]);

  useEffect(() => {
    if (videoUrl === null) return;
    let cancelled = false;
    setRun(FETCHING);
    latest.current.analytics.capture.newOverview.started({ from: "onboarding" });
    const writing = new Promise<void>((resolve) => {
      releaseWriting.current = resolve;
      if (mayWriteNow.current) resolve();
    });

    latest.current
      .runGeneration(videoUrl, {
        isCancelled: () => cancelled,
        onProgress: ({ video }) => {
          if (!cancelled) setRun({ phase: mayWriteNow.current ? "writing" : "waiting", video, overview: null, error: null });
        },
        waitToWrite: () => writing,
      })
      .then((overview) => {
        if (cancelled) return;
        latest.current.onMade(overview);
        setRun({ phase: "ready", video: overview.video, overview, error: null });
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
  }, [videoUrl, attempt]);

  return run;
}
