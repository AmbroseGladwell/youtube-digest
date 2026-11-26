import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { readAloudControlTestIds } from "../ReadAloudControl/ReadAloudControlTestIds.js";
import styles from "./ReadAloudBack.module.scss";

export const ReadAloudBack = ({ onBack }: { onBack: () => void }) => (
  <button type="button" className={styles.root} onClick={onBack} data-testid={readAloudControlTestIds.back}>
    <StrokeIcon name="arrowDown" size={14} />
    Back to where it’s reading
  </button>
);
