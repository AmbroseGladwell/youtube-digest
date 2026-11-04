import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./RecipeCookButton.module.scss";
import { recipeCookButtonTestIds } from "./RecipeCookButtonTestIds.js";

export interface RecipeCookButtonProps {
  // The step the reader left cooking at, kept on this device, or null to start at step 1.
  placeStep: number | null;
  onStart: () => void;
  onCarryOn: () => void;
}

// Cooking step by step from the top of the recipe, above the summary, so it's in sight when the
// note opens (OV-172). The method's own buttons stay where they are.
export function RecipeCookButton({ placeStep, onStart, onCarryOn }: RecipeCookButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={placeStep === null ? onStart : onCarryOn}
      data-testid={recipeCookButtonTestIds.root}
    >
      <StrokeIcon name="chefHat" size={16} />
      {placeStep === null ? "Cook step by step" : `Carry on from step ${placeStep + 1}`}
    </button>
  );
}
