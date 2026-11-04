import { useNavigate } from "react-router";
import type { Sample } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { sampleKindOf } from "./util/sampleKindOf.js";
import { startOnboardingFromShare } from "./useOnboardingProgress.js";
import { useSampleApi } from "./useSampleApi.js";

// A sample chosen at Start begins onboarding around it, the way Save to my overviews does around
// a shared copy: nothing is made, and it's saved into the account once there is one
// (docs/features/onboarding.md, "Try a sample"). Says whether it could be opened.
export function useStartFromSample(): (sample: Sample, index: number) => Promise<boolean> {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const sampleApi = useSampleApi();
  return async (sample, index) => {
    if (sampleApi === null) return false;
    const snapshot = await sampleApi.api.get(sample.token).catch(() => null);
    if (snapshot === null) return false;
    analytics.onboarding.start.sampleChosen({ sample: index, kind: sampleKindOf(sample.note) });
    startOnboardingFromShare(sample.token, snapshot, true);
    void navigate(Routes.onboarding());
    return true;
  };
}
