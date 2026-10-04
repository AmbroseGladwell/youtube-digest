import { useId } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useKnownApiUrl } from "../../../sync/useKnownApiUrl.js";
import { answerAnalyticsConsent } from "../../useAnalyticsConsent.js";
import type { ConsentAsk } from "../../util/consentAskOf.js";
import { privacyPolicyUrl } from "../../util/privacyPolicyUrl.js";
import styles from "./AnalyticsConsentPrompt.module.scss";
import { analyticsConsentPromptTestIds } from "./AnalyticsConsentPromptTestIds.js";

export interface AnalyticsConsentPromptProps {
  ask: ConsentAsk;
  panel?: boolean;
}

const NEVER = "never what you watch, read or type. If you sign up later, this is linked to your account.";

// Designs 62a and 62b: a region in the strip slot, not a dialog, with two answers drawn
// alike and what is counted said before anything is (docs/features/analytics-consent.md).
export function AnalyticsConsentPrompt({ ask, panel = false }: AnalyticsConsentPromptProps) {
  const titleId = useId();
  const analytics = useAnalytics();
  const apiUrl = useKnownApiUrl();
  const opensElsewhere = useSurface() === "extension";

  const share = () => {
    answerAnalyticsConsent("share");
    analytics.analyticsConsent.prompt.accepted({ asked: ask.kind });
  };

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      className={`${styles.root} ${panel ? styles.panel : ""}`}
      data-ask={ask.kind}
      data-testid={analyticsConsentPromptTestIds.root}
    >
      <span className={styles.text}>
        <span className={styles.icon}>
          <StrokeIcon name={ask.kind === "first" ? "chart" : "refreshCw"} size={16} />
        </span>
        <span className={styles.words}>
          <span id={titleId} className={styles.title} data-testid={analyticsConsentPromptTestIds.title}>
            {ask.kind === "first" ? "Help improve The Overview?" : "We’ve updated what we collect"}
          </span>
          <span className={styles.body} data-testid={analyticsConsentPromptTestIds.body}>
            {ask.kind === "first"
              ? `Share which features you use, ${NEVER}`
              : `Now including ${ask.added}. Still ${NEVER}`}{" "}
            {apiUrl !== null && (
              <a
                className={styles.privacyLink}
                href={privacyPolicyUrl(apiUrl)}
                {...(opensElsewhere ? { target: "_blank", rel: "noreferrer" } : {})}
                data-testid={analyticsConsentPromptTestIds.privacyLink}
              >
                Privacy policy
              </a>
            )}
          </span>
        </span>
      </span>
      <span className={styles.answers}>
        <button type="button" className={styles.answer} onClick={share} data-testid={analyticsConsentPromptTestIds.share}>
          Share usage
        </button>
        <button
          type="button"
          className={styles.answer}
          onClick={() => answerAnalyticsConsent("dontShare")}
          data-testid={analyticsConsentPromptTestIds.dontShare}
        >
          Don’t share
        </button>
      </span>
    </div>
  );
}
