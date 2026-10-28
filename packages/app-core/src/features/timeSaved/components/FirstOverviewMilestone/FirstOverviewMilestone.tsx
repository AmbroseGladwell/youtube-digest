import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./FirstOverviewMilestone.module.scss";
import { firstOverviewMilestoneTestIds } from "./FirstOverviewMilestoneTestIds.js";

// Design 46m: OV-34's milestone card in stone, the one hue the time milestones don't use. Time
// saved counts only once an overview is read, so the line says so.
export function FirstOverviewMilestone({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className={styles.root} data-testid={firstOverviewMilestoneTestIds.root}>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Hide until your next milestone"
        onClick={onDismiss}
        data-testid={firstOverviewMilestoneTestIds.dismiss}
      >
        <StrokeIcon name="close" size={16} />
      </button>
      <p className={styles.pill}>First overview</p>
      <p className={styles.figure}>1 made</p>
      <p className={styles.line}>Read it and we'll start counting the time you save.</p>
    </div>
  );
}
