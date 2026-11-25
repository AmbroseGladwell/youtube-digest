import { recipeStepGroups, type MethodAmount, type RecipeAction, type RecipeStep } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
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
  methodAmounts: readonly MethodAmount[];
  onChoose: (step: number) => void;
  onClose: () => void;
}

export const CookingStepsSheet = ({
  open,
  steps,
  actions,
  at,
  usTemperatures,
  methodAmounts,
  onChoose,
  onClose,
}: CookingStepsSheetProps) => {
  const current = actions[at]?.step ?? 0;

  return (
    <BottomSheet open={open} title="Steps" onClose={onClose} wide="dialog" testId={cookingStepsSheetTestIds.root}>
      <div className={styles.content}>
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
                        <span className={styles.hidden}>
                          Step {step + 1}
                          {step < current ? ", done" : ""}.{" "}
                        </span>
                        <OvenText text={first?.text ?? ""} us={usTemperatures} amounts={methodAmounts} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
};
