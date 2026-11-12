import { useId, useState } from "react";
import { formatTimestamp } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import styles from "./DubiousStepFlag.module.scss";
import { dubiousStepFlagTestIds } from "./DubiousStepFlagTestIds.js";

export interface DubiousStepFlagProps {
  reason: string;
  // Where in the video the step was said, or null for an article or a step with no moment.
  saidAtMs: number | null;
}

// Design 250i–250k: flagged in text under the step, never hidden or greyed out, opening the
// reason in place. The byline's Dubious claim flag is the same button.
export function DubiousStepFlag({ reason, saidAtMs }: DubiousStepFlagProps) {
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const analytics = useOverviewPageAnalytics();

  return (
    <span className={styles.root} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`${styles.flag} ${open ? styles.flagOpen : ""}`}
        aria-expanded={open}
        aria-controls={reasonId}
        onClick={() => {
          if (!open) analytics.sourceSteps.dubiousOpened();
          setOpen(!open);
        }}
        data-testid={dubiousStepFlagTestIds.flag}
      >
        <StrokeIcon name="alert" size={13} />
        Dubious step
        <StrokeIcon name={open ? "chevronUp" : "chevronDown"} size={14} />
      </button>
      {open && (
        <span className={styles.panel} id={reasonId}>
          <span className={styles.heading}>Why this step is flagged</span>
          <span className={styles.reason} data-testid={dubiousStepFlagTestIds.reason}>
            {reason}
          </span>
          {saidAtMs !== null && (
            <span className={styles.saidAt} data-testid={dubiousStepFlagTestIds.saidAt}>
              Said at {formatTimestamp(saidAtMs)}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
