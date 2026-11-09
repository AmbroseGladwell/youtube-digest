import { kindChip, type RecipeNote, type Source } from "@overview/domain";
import styles from "./KindChip.module.scss";
import { kindChipTestIds } from "./KindChipTestIds.js";

export interface KindChipProps {
  overview: { source: Source; recipe: RecipeNote | null };
}

// Design 232a: quieter than the verdict's filled pill, so the eye finds the title and the
// verdict first and the kind when it looks for it.
export function KindChip({ overview }: KindChipProps) {
  const label = kindChip(overview);
  if (label === null) return null;
  return (
    <span className={styles.root} data-testid={kindChipTestIds.root}>
      {label}
    </span>
  );
}
