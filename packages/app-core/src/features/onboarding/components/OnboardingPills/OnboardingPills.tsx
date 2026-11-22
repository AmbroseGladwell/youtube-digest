import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { ExpectedMinutes } from "../../util/expectedOverviewMinutes.js";
import styles from "./OnboardingPills.module.scss";
import { onboardingPillsTestIds } from "./OnboardingPillsTestIds.js";

export interface OnboardingPillsProps {
  pills: "readListen" | "cook";
  minutes: ExpectedMinutes | null;
}

export const OnboardingPills = ({ pills, minutes }: OnboardingPillsProps) => {
  return (
    <ul className={styles.root} aria-label="What you can do with it" data-testid={onboardingPillsTestIds.root}>
      {pills === "cook" ? (
        <li className={styles.pill}>
          <StrokeIcon name="chefHat" size={14} />
          Cook <span className={styles.aside}>cooking mode</span>
        </li>
      ) : null}
      <li className={styles.pill}>
        <StrokeIcon name="fileText" size={14} />
        Read{pills === "readListen" && minutes !== null ? <span className={styles.aside}>{minutes.read} min</span> : null}
      </li>
      {pills === "readListen" ? (
        <li className={styles.pill}>
          <StrokeIcon name="headphones" size={14} />
          Listen{minutes !== null ? <span className={styles.aside}>{minutes.listen} min</span> : null}
        </li>
      ) : null}
      <li className={styles.pill}>
        <StrokeIcon name="share" size={14} />
        Share
      </li>
    </ul>
  );
};
