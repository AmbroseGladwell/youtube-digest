import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSync } from "../sync/SyncContext.js";
import { answerAnalyticsConsent, useAnalyticsConsent } from "./useAnalyticsConsent.js";
import { consentOutdated } from "./util/consentAllowsSharing.js";
import { shareUsageOn, type ShareUsageState } from "./util/shareUsageStatus.js";

export interface ShareUsage {
  state: ShareUsageState;
  switchTo: (on: boolean) => Promise<void>;
}

// Turning it off sends its own event first, so what the yes recorded goes out before the id is deleted.
export const useShareUsageState = (): ShareUsageState => {
  const { connected } = useSync();
  const { consent } = useAnalyticsConsent();
  const settings = useSettingsQuery().data;
  return connected
    ? {
        signedIn: true,
        optedOut: settings?.analyticsOptOut ?? false,
        changedAt: settings?.analyticsOptOutChangedAt ?? null,
      }
    : { signedIn: false, consent, outdated: consentOutdated(consent) };
};

export const useShareUsage = (): ShareUsage => {
  const state = useShareUsageState();
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();

  const switchTo = async (on: boolean): Promise<void> => {
    if (on === shareUsageOn(state)) {
      return;
    }
    if (!on) {
      analytics.analyticsConsent.settings.switched({ on });
      await analytics.flush();
    }
    const switchedOn = () => {
      if (on) {
        analytics.analyticsConsent.settings.switched({ on });
      }
    };
    if (state.signedIn) {
      updateSettings.mutate({ analyticsOptOut: !on, analyticsOptOutChangedAt: new Date().toISOString() }, { onSuccess: switchedOn });
      return;
    }
    answerAnalyticsConsent(on ? "share" : "dontShare");
    switchedOn();
  };

  return { state, switchTo };
};
