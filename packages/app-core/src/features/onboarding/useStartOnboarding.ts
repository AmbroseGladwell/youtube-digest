import { useNavigate } from "react-router";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { youTubeLink } from "../newOverview/util/parseYouTubeUrl.js";
import { startOnboarding } from "./useOnboardingProgress.js";

// Start, wherever it sits: a video or playlist link begins onboarding, anything else is refused
// (designs 46a and 46n). Says whether the link was taken.
export function useStartOnboarding(): (link: string) => boolean {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  return (link) => {
    const parsed = youTubeLink(link);
    const videoUrl = parsed === null || parsed.kind === "playlist" ? null : parsed.videoUrl;
    if (parsed === null || (parsed.kind !== "playlist" && videoUrl === null)) {
      analytics.onboarding.start.linkRefused();
      return false;
    }
    analytics.onboarding.start.linkSubmitted({ kind: parsed.kind === "playlist" ? "playlist" : "video" });
    startOnboarding(link.trim(), videoUrl);
    void navigate(Routes.onboarding());
    return true;
  };
}
