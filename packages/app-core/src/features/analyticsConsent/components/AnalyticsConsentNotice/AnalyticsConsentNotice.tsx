import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { dismissConsentNotice } from "../../useAnalyticsConsent.js";
import type { ConsentAnswer } from "../../types/AnalyticsConsent.js";
import styles from "./AnalyticsConsentNotice.module.scss";
import { analyticsConsentNoticeTestIds } from "./AnalyticsConsentNoticeTestIds.js";

const LEAD: Record<ConsentAnswer, string> = {
  share: "Sharing usage.",
  dontShare: "Not sharing usage.",
};

// Design 62c: the same notice for either answer, so neither reads as the wrong one. It goes
// by itself after ten seconds, as 47e does, or with ×.
export function AnalyticsConsentNotice({ answer, panel = false }: { answer: ConsentAnswer; panel?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${styles.root} ${panel ? styles.panel : ""}`}
      data-testid={analyticsConsentNoticeTestIds.root}
    >
      <span className={styles.text}>
        <span className={styles.icon}>
          <StrokeIcon name="check" size={16} />
        </span>
        <span className={styles.words}>
          <span className={styles.lead} data-testid={analyticsConsentNoticeTestIds.lead}>
            {LEAD[answer]}
          </span>{" "}
          <span className={styles.then}>
            Change this any time in{" "}
            <Link
              className={styles.settingsLink}
              to={Routes.settingsSection("privacy")}
              data-testid={analyticsConsentNoticeTestIds.settingsLink}
            >
              Settings › Privacy
            </Link>
            .
          </span>
        </span>
      </span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={dismissConsentNotice}
        aria-label="Dismiss"
        data-testid={analyticsConsentNoticeTestIds.dismiss}
      >
        <StrokeIcon name="close" size={16} />
      </button>
      <span className={styles.timer} aria-hidden="true">
        <span className={styles.timerBar} onAnimationEnd={dismissConsentNotice} />
      </span>
    </div>
  );
}
