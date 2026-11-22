import { FIRST_OVERVIEW_MARK, MilestoneId } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";

export interface FirstOverviewMilestone {
  shown: boolean;
  dismiss: () => void;
}

export const useFirstOverviewMilestone = (overviews: number): FirstOverviewMilestone => {
  const settings = useSettingsQuery().data;
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();
  const marks = settings?.milestones ?? {};
  const timeMilestoneReached = Object.keys(marks).some((key) => MilestoneId.safeParse(key).success);

  return {
    shown:
      settings !== undefined &&
      settings.showMilestoneCards &&
      overviews > 0 &&
      !timeMilestoneReached &&
      marks[FIRST_OVERVIEW_MARK]?.dismissedAt == null,
    dismiss: () => {
      const now = new Date().toISOString();
      updateSettings.mutate({ milestones: { [FIRST_OVERVIEW_MARK]: { crossedAt: now, dismissedAt: now } } });
      analytics.timeSaved.firstOverview.dismissed();
    },
  };
};
