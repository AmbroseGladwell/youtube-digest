import { useEffect, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import { generationRunSteps } from "../../util/generationRunSteps.js";
import styles from "./GenerationSteps.module.scss";
import { generationStepsTestIds } from "./GenerationStepsTestIds.js";

export interface GenerationStepsProps {
  run: NewOverviewRun;
}

export const GenerationSteps = ({ run }: GenerationStepsProps) => {
  const now = useMinuteClock(run.podcast?.transcription?.state === "transcribing" && run.podcast.words === null);
  return (
    <ol className={styles.root} aria-live="polite" data-testid={generationStepsTestIds.root}>
      {generationRunSteps(run, now).map((step) => (
        <li key={step.number} className={styles.step} data-testid={generationStepsTestIds.step(step.number)} data-state={step.state}>
          <span className={styles.stepNumber} aria-hidden="true">
            {step.number}
          </span>
          <span className={styles.stepBody}>
            <span className={styles.stepLabel}>{step.label}</span>
            <span className={styles.stepDetail} data-testid={generationStepsTestIds.stepDetail(step.number)}>
              {step.detail}
            </span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} />
            </span>
          </span>
          <span className={styles.stepMark} aria-hidden="true">
            {step.state === "done" && <StrokeIcon name="check" size={15} />}
          </span>
        </li>
      ))}
    </ol>
  );
};

// A transcription's estimate counts down in whole minutes, so the steps redraw often enough to change on it.
const useMinuteClock = (ticking: boolean): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
};
