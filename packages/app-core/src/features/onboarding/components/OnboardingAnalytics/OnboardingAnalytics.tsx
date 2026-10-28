import { useKnownApiUrl } from "../../../sync/useKnownApiUrl.js";
import { policyPageUrl } from "../../../analyticsConsent/util/policyPageUrl.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingAnalytics.module.scss";
import { onboardingAnalyticsTestIds } from "./OnboardingAnalyticsTestIds.js";

export interface OnboardingAnalyticsProps {
  onAllow: () => void;
  onNoThanks: () => void;
}

// Design 46b: two equal answers, nothing chosen for the reader, and what is counted said on
// the screen with the policy beside it, as the Chrome Web Store asks. No Thanks is the skip
// (docs/features/analytics-consent.md, "In onboarding").
export function OnboardingAnalytics({ onAllow, onNoThanks }: OnboardingAnalyticsProps) {
  const apiUrl = useKnownApiUrl();
  return (
    <div className={styles.root} data-testid={onboardingAnalyticsTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>Help us improve The Overview?</OnboardingHeading>
        <p className={styles.lead}>
          We'd like to see how the app is used so we can make it better. You can change this any time in Settings.
        </p>
      </div>
      <p className={styles.counted}>
        We count which features are used, never what you read or watch.{" "}
        {apiUrl !== null && (
          <a
            href={policyPageUrl(apiUrl, "privacy")}
            target="_blank"
            rel="noreferrer"
            data-testid={onboardingAnalyticsTestIds.policyLink}
          >
            Privacy policy
          </a>
        )}
      </p>
      <div className={styles.foot}>
        <div className={styles.answers} role="group" aria-label="Analytics">
          <button type="button" className={styles.answer} onClick={onAllow} data-testid={onboardingAnalyticsTestIds.allow}>
            Allow
          </button>
          <button
            type="button"
            className={styles.answer}
            onClick={onNoThanks}
            data-testid={onboardingAnalyticsTestIds.noThanks}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
