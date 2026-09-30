import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { minutesLeftPhrase } from "../../util/minutesLeft.js";
import styles from "./ConsentPlusCard.module.scss";
import { consentPlusCardTestIds } from "./ConsentPlusCardTestIds.js";

export interface ConsentPlusCardProps {
  minutesLeft: number;
  declining: boolean;
  onDecline: () => void;
}

// A free reader has nothing to approve, so there is no Approve at all: what Plus would do,
// how long the request waits, and still a way to answer it (design 58g).
export function ConsentPlusCard({ minutesLeft, declining, onDecline }: ConsentPlusCardProps) {
  return (
    <div className={styles.root} data-testid={consentPlusCardTestIds.root}>
      <h2 className={styles.title}>Connecting an assistant comes with Plus</h2>
      <p className={styles.body}>
        With Plus, an assistant can read every overview and transcript you’ve saved and answer across them.
        You’re on Free, so there’s nothing to approve yet.
      </p>
      <p className={styles.openFor} data-testid={consentPlusCardTestIds.openFor}>
        <StrokeIcon name="clock" size={15} />
        This request stays open for {minutesLeftPhrase(minutesLeft)}. Get Plus and you’ll come back here to approve it.
      </p>
      <div className={styles.actions}>
        <Link to={Routes.settingsSection("plan")} className={styles.seePlus} data-testid={consentPlusCardTestIds.seePlusLink}>
          See Plus
        </Link>
        <button
          type="button"
          className={styles.decline}
          disabled={declining}
          onClick={onDecline}
          data-testid={consentPlusCardTestIds.declineButton}
        >
          {declining ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  );
}
