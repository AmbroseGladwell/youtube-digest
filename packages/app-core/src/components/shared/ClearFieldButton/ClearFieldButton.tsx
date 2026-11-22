import { StrokeIcon } from "../StrokeIcon/StrokeIcon.js";
import styles from "./ClearFieldButton.module.scss";

export interface ClearFieldButtonProps {
  label: string;
  onClick: () => void;
  testId: string;
}

// Why in place of the browser's cancel glyph: docs/features/stone-theme.md, "Transcript search".
export const ClearFieldButton = ({ label, onClick, testId }: ClearFieldButtonProps) => {
  return (
    <button type="button" className={styles.root} onClick={onClick} aria-label={label} data-testid={testId}>
      <StrokeIcon name="close" size={15} />
    </button>
  );
};
