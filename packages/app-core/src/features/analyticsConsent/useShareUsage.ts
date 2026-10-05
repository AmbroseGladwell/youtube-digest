import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSync } from "../sync/SyncContext.js";
import { answerAnalyticsConsent, useAnalyticsConsent } from "./useAnalyticsConsent.js";
import { consentAskOf } from "./util/consentAskOf.js";
import { shareUsageOn, type ShareUsageState } from "./util/shareUsageStatus.js";

export interface ShareUsage {
  state: ShareUsageState;
  switchTo: (on: boolean) => Promise<void>;
}

// The one switch in Settings › Privacy. Signed out it is the same answer the prompt records;
// signed in it is the account's opt-out, which syncs and the server enforces. Turning it off
// sends the switch's own event first, so what was recorded under the yes goes out before the
// id is deleted (docs/features/analytics-consent.md, "Settings › Privacy").
export function useShareUsageState(): ShareUsageState {
  const { connected } = useSync();
  const { consent } = useAnalyticsConsent();
  const settings = useSettingsQuery().data;
  return connected
    ? {
        signedIn: true,
        optedOut: settings?.analyticsOptOut ?? false,
        changedAt: settings?.analyticsOptOutChangedAt ?? null,
      }
    : { signedIn: false, consent, outdated: consentAskOf(consent)?.kind === "again" };
}

export function useShareUsage(): ShareUsage {
  const state = useShareUsageState();
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();

  const switchTo = async (on: boolean): Promise<void> => {
    if (on === shareUsageOn(state) && !(state.signedIn === false && state.outdated)) return;
    if (!on) {
      analytics.analyticsConsent.settings.switched({ on });
      await analytics.flush();
    }
    const switchedOn = () => {
      if (on) analytics.analyticsConsent.settings.switched({ on });
    };
    if (state.signedIn) {
      updateSettings.mutate(
        { analyticsOptOut: !on, analyticsOptOutChangedAt: new Date().toISOString() },
        { onSuccess: switchedOn },
      );
      return;
    }
    answerAnalyticsConsent(on ? "share" : "dontShare", { notice: false });
    switchedOn();
  };

  return { state, switchTo };
}
