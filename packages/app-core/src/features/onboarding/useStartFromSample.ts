import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Sample, ShareToken } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { sampleKindOf } from "./util/sampleFacts.js";
import { startOnboardingFromShare } from "./useOnboardingProgress.js";
import { useSampleApi } from "./useSampleApi.js";

// A wait shorter than this shows nothing, so a quick open doesn't flash (155f).
const OPENING_SHOWN_AFTER_MS = 300;

export interface SampleOpening {
  // The sample being fetched, once the wait has gone on long enough to say so.
  opening: ShareToken | null;
  // Pressed and not yet answered, shown or not.
  busy: boolean;
  failed: boolean;
  open: (sample: Sample, index: number) => Promise<boolean>;
}

// A sample chosen at Start begins onboarding around it, the way Save to my overviews does around
// a shared copy: nothing is made, and it's saved into the account once there is one. The choice
// is counted on the press, so a failed open still records it (docs/features/onboarding.md,
// "Try a sample").
export function useStartFromSample(): SampleOpening {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const sampleApi = useSampleApi();
  const [opening, setOpening] = useState<ShareToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const shownAfter = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(shownAfter.current ?? undefined), []);

  const open = async (sample: Sample, index: number): Promise<boolean> => {
    if (sampleApi === null || busy) return false;
    analytics.onboarding.start.sampleChosen({ sample: index, kind: sampleKindOf(sample.note) });
    setBusy(true);
    setFailed(false);
    shownAfter.current = setTimeout(() => setOpening(sample.token), OPENING_SHOWN_AFTER_MS);
    const snapshot = await sampleApi.api.get(sample.token).catch(() => null);
    clearTimeout(shownAfter.current);
    setOpening(null);
    setBusy(false);
    if (snapshot === null) {
      setFailed(true);
      return false;
    }
    startOnboardingFromShare(sample.token, snapshot, true);
    void navigate(Routes.onboarding());
    return true;
  };

  return { opening, busy, failed, open };
}
