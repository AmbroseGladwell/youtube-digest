import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./SortPill.module.scss";
import { sortPillTestIds } from "./SortPillTestIds.js";

// Design 2a's sort control, placed but disabled: the library has one order and nothing to
// change it to yet (docs/features/stone-theme.md, "Placed but not wired").
export function SortPill() {
  return (
    <button
      type="button"
      className={styles.root}
      disabled
      title="Sorting isn't wired up yet"
      data-testid={sortPillTestIds.root}
    >
      Newest saved first
      <StrokeIcon name="chevronDown" />
    </button>
  );
}
