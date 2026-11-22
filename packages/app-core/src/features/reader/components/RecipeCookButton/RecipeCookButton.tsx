import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./RecipeCookButton.module.scss";
import { recipeCookButtonTestIds } from "./RecipeCookButtonTestIds.js";

export interface RecipeCookButtonProps {
  placeStep: number | null;
  onStart: () => void;
  onCarryOn: () => void;
}

export const RecipeCookButton = ({ placeStep, onStart, onCarryOn }: RecipeCookButtonProps) => {
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
};
