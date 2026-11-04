import { useEffect, useId, useRef } from "react";
import { recipeStepGroups, type RecipeAction, type RecipeStep } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OvenText } from "../OvenText/OvenText.js";
import styles from "./CookingStepsSheet.module.scss";
import { cookingStepsSheetTestIds } from "./CookingStepsSheetTestIds.js";

export interface CookingStepsSheetProps {
  open: boolean;
  steps: readonly RecipeStep[];
  actions: readonly RecipeAction[];
  at: number;
  usTemperatures: boolean;
  onChoose: (step: number) => void;
  onClose: () => void;
}

// Design 150m: every step by its first action, done ones ticked and the current one tinted.
// Choosing one goes to its first action and reads it, backwards or forwards.
export function CookingStepsSheet({ open, steps, actions, at, usTemperatures, onChoose, onClose }: CookingStepsSheetProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const headingId = useId();
  const current = actions[at]?.step ?? 0;

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      data-testid={cookingStepsSheetTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.head}>
          <h2 className={styles.heading} id={headingId}>
            Steps
          </h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <StrokeIcon name="close" size={16} />
          </button>
        </div>
        {recipeStepGroups(steps).map(({ name, start, steps: grouped }) => (
          <div key={start}>
            {name !== null && <h3 className={styles.group}>{name}</h3>}
            <ol className={styles.list}>
              {grouped.map((_, offset) => {
                const step = start - 1 + offset;
                const first = actions.find((action) => action.step === step);
                return (
                  <li key={step}>
                    <button
                      type="button"
                      className={`${styles.row} ${step === current ? styles.here : ""}`}
                      aria-current={step === current ? "step" : undefined}
                      onClick={() => onChoose(step)}
                      data-testid={cookingStepsSheetTestIds.step}
                    >
                      <i className={styles.number} aria-hidden="true">
                        {step < current ? <StrokeIcon name="check" size={13} /> : step + 1}
                      </i>
                      <span className={styles.text}>
                        <span className={styles.hidden}>Step {step + 1}{step < current ? ", done" : ""}. </span>
                        <OvenText text={first?.text ?? ""} us={usTemperatures} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </dialog>
  );
}
