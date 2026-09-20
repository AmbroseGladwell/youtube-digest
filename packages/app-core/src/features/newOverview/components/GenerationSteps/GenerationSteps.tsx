import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import { generationRunSteps } from "../../util/generationRunSteps.js";
import styles from "./GenerationSteps.module.scss";
import { generationStepsTestIds } from "./GenerationStepsTestIds.js";

const STEP_MARK: Record<string, string> = { done: "✓", running: "●", waiting: "" };

export interface GenerationStepsProps {
  run: NewOverviewRun;
}

// The numbered progress list design 5a draws, shared by the dialog and the side panel's
// own working screen so both report the same thing the same way
// (docs/features/extension-panel.md).
export function GenerationSteps({ run }: GenerationStepsProps) {
  return (
    <ol className={styles.root} aria-live="polite" data-testid={generationStepsTestIds.root}>
      {generationRunSteps(run).map((step) => (
        <li
          key={step.number}
          className={styles.step}
          data-testid={generationStepsTestIds.step(step.number)}
          data-state={step.state}
        >
          <span className={styles.stepNumber} aria-hidden="true">
            {step.number}
          </span>
          <span className={styles.stepBody}>
            <span className={styles.stepLabel}>{step.label}</span>
            <span
              className={styles.stepDetail}
              data-testid={generationStepsTestIds.stepDetail(step.number)}
            >
              {step.detail}
            </span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} />
            </span>
          </span>
          <span className={styles.stepMark} aria-hidden="true">
            {STEP_MARK[step.state]}
          </span>
        </li>
      ))}
    </ol>
  );
}
