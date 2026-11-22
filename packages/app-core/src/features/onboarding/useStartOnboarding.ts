import { useNavigate } from "react-router";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { onboardingSourceOf } from "./onboardingSources.js";
import { startOnboarding } from "./useOnboardingProgress.js";

export const useStartOnboarding = (): ((link: string, tabId?: number) => boolean) => {
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
};
