import { useNavigate } from "react-router";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { onboardingSourceOf } from "./onboardingSources.js";
import { startOnboarding } from "./useOnboardingProgress.js";

// Start, wherever it sits: a link to any kind of source we read begins onboarding, anything
// else is refused (designs 46a and 46n). Says whether the link was taken.
export function useStartOnboarding(): (link: string, tabId?: number) => boolean {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  return (link, tabId) => {
    const recognised = onboardingSourceOf(link);
    if (recognised === null) {
      analytics.onboarding.start.linkRefused();
      return false;
    }
    analytics.onboarding.start.linkSubmitted({ kind: recognised.linkKind });
    startOnboarding(link.trim(), recognised.source.keyFromLink(link), tabId ?? null);
    void navigate(Routes.onboarding());
    return true;
  };
}
