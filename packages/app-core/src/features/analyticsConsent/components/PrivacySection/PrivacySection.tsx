import { useId } from "react";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { savedHere } from "../../../accountLibraries/util/libraryPlace.js";
import { PolicyLinks } from "../../../settings/components/PolicyLinks/PolicyLinks.js";
import { useShareUsage } from "../../useShareUsage.js";
import { shareUsageOn, shareUsageStatus } from "../../util/shareUsageStatus.js";
import styles from "./PrivacySection.module.scss";
import { privacySectionTestIds } from "./PrivacySectionTestIds.js";

const NEVER = "Shares which features you use, never what you watch, read or type";

// Designs 62d–62h (docs/features/analytics-consent.md, "Settings › Privacy"): one switch,
// the same for everyone, whose line says what it means. Error reports sit apart with no
// switch, because they aren't part of the choice.
export function PrivacySection() {
  const { state, switchTo } = useShareUsage();
  const surface = useSurface();
  const labelId = useId();
  const statusId = useId();
  const on = shareUsageOn(state);

  return (
    <div className={styles.root} data-testid={privacySectionTestIds.root}>
      <div className={styles.card}>
        <div className={styles.switchRow}>
          <span className={styles.switchText}>
            <span className={styles.switchLabel} id={labelId}>
              Share usage
            </span>
            <span className={styles.status} id={statusId} data-testid={privacySectionTestIds.status}>
              {shareUsageStatus(state, new Date())}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            className={styles.switch}
            aria-checked={on}
            aria-labelledby={labelId}
            aria-describedby={statusId}
            onClick={() => void switchTo(!on)}
            data-testid={privacySectionTestIds.shareUsageSwitch}
          >
            <span className={styles.knob} />
          </button>
        </div>
        <p className={styles.body} data-testid={privacySectionTestIds.explanation}>
          {state.signedIn
            ? `${NEVER}, so we can improve the app.`
            : `${NEVER}, under a random ID ${savedHere(surface)} that’s deleted when you turn this off. If you create an account later, it’s linked to your account.`}
        </p>
      </div>
      <div className={styles.card} data-testid={privacySectionTestIds.errorReports}>
        <p className={styles.cardLabel}>Error reports</p>
        <p className={styles.body}>
          Always sent, so we can fix what breaks. They never include what you watch, read or type, and Share usage
          doesn’t affect them.
        </p>
      </div>
      <div className={styles.links}>
        <PolicyLinks />
      </div>
    </div>
  );
}
