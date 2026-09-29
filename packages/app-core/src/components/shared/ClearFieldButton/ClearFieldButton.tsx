import { StrokeIcon } from "../StrokeIcon/StrokeIcon.js";
import styles from "./ClearFieldButton.module.scss";

export interface ClearFieldButtonProps {
  label: string;
  onClick: () => void;
  testId: string;
}

// Every search field in the app empties from this one button, in place of the browser's
// own blue cancel glyph, so the round controls inside a field are all the one size,
// colour and hover (docs/features/stone-theme.md, "Transcript search").
export function ClearFieldButton({ label, onClick, testId }: ClearFieldButtonProps) {
  return (
    <button
      type="button"
      className={styles.root}
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
    >
      <StrokeIcon name="close" size={15} />
    </button>
  );
}
