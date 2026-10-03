import { useIsPanel } from "../../../../app/LayoutContext.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSync } from "../../../sync/SyncContext.js";
import { signOutNoticeCopy } from "../../util/signOutNoticeCopy.js";
import styles from "./SignOutNotice.module.scss";
import { signOutNoticeTestIds } from "./SignOutNoticeTestIds.js";

// Designs 47d-2 and 47d-3: told after the fact, never asked. It stays until dismissed and
// does not take focus, which goes to the page (docs/features/account-libraries.md).
export function SignOutNotice() {
  const sync = useSync();
  const surface = useSurface();
  const isPanel = useIsPanel();
  const notice = sync.signOutNotice;
  if (notice === null) return null;
  const copy = signOutNoticeCopy(notice, surface);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${styles.root} ${isPanel ? styles.panel : ""}`}
      data-testid={signOutNoticeTestIds.root}
    >
      <span className={styles.icon}>
        <StrokeIcon name={notice.offline ? "wifiOff" : "cloudUpload"} size={17} />
      </span>
      <div className={styles.text}>
        <p className={styles.lead} data-testid={signOutNoticeTestIds.lead}>
          {copy.lead}
        </p>
        {copy.then !== null && <p className={styles.then}>{copy.then}</p>}
        {copy.stuck !== null && (
          <p className={styles.stuck} data-testid={signOutNoticeTestIds.stuck}>
            <span className={styles.stuckIcon}>
              <StrokeIcon name="alertCircle" size={14} />
            </span>
            <span>{copy.stuck}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        className={styles.dismiss}
        onClick={sync.dismissSignOutNotice}
        aria-label="Dismiss"
        data-testid={signOutNoticeTestIds.dismiss}
      >
        <StrokeIcon name="close" size={16} />
      </button>
    </div>
  );
}
