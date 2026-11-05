import { useSurface } from "../../../../app/SurfaceContext.js";
import { useKnownApiUrl } from "../../../sync/useKnownApiUrl.js";
import { policyPageUrl } from "../../../analyticsConsent/util/policyPageUrl.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingAnalytics.module.scss";
import { onboardingAnalyticsTestIds } from "./OnboardingAnalyticsTestIds.js";

export interface OnboardingAnalyticsProps {
  onAllow: () => void;
  onNoThanks: () => void;
}

// Designs 46b and 175l: a reason that's the reader's whatever they answer, two equal answers with
// nothing chosen for them, and what's shared said on the screen with the policy beside it, as the
// Chrome Web Store asks. No thanks is the skip (docs/features/analytics-consent.md, "In onboarding").
export function OnboardingAnalytics({ onAllow, onNoThanks }: OnboardingAnalyticsProps) {
  const apiUrl = useKnownApiUrl();
  const panel = useSurface() === "extension";
  return (
    <div className={styles.root} data-testid={onboardingAnalyticsTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>Help shape what we build next?</OnboardingHeading>
        <p className={styles.lead}>
          {panel
            ? "We're a small team, so how you use the app counts. It shows us what to build and fix next, so The Overview gets better for you."
            : "We're a small team, so how you use the app counts for a lot. It shows us what to build next and what's confusing, so The Overview gets better for you, and problems get fixed sooner without you having to tell us."}
        </p>
      </div>
      <div className={styles.shared} data-testid={onboardingAnalyticsTestIds.shared}>
        <span className={styles.sharedTitle}>What's shared</span>
        <span>
          Which features you use, never what you read, watch or type. Errors are reported either way, so nothing breaks
          unnoticed if you say no.
        </span>
        <span className={styles.change}>
          Change it any time in Settings › Privacy.{" "}
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
        </span>
      </div>
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
