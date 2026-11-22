import { kindChip, type RecipeNote, type Source } from "@overview/domain";
import styles from "./KindChip.module.scss";
import { kindChipTestIds } from "./KindChipTestIds.js";

export interface KindChipProps {
  overview: { source: Source; recipe: RecipeNote | null };
}

export const KindChip = ({ overview }: KindChipProps) => {
  const label = kindChip(overview);
  if (label === null) {
    return null;
  }
  return (
    <span className={styles.root} data-testid={kindChipTestIds.root}>
      {label}
    </span>
  );
};
