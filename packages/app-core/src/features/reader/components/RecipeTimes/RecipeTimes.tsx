import { recipeFigures, type Recipe } from "@overview/domain";
import styles from "./RecipeTimes.module.scss";
import { recipeTimesTestIds } from "./RecipeTimesTestIds.js";

export interface RecipeTimesProps {
  recipe: Pick<Recipe, "prepMinutes" | "cookMinutes" | "totalMinutes" | "yield">;
  from: string;
}

// Design 144f: only what the page states, labelled, with a caption saying whose figures they
// are so nothing suggests we timed it. Nothing stated, nothing shown.
export function RecipeTimes({ recipe, from }: RecipeTimesProps) {
  const figures = recipeFigures(recipe);
  if (figures.length === 0) return null;
  return (
    <div className={styles.root} data-testid={recipeTimesTestIds.root}>
      <dl className={styles.figures}>
        {figures.map(({ label, value }) => (
          <div key={label} className={styles.figure} data-testid={recipeTimesTestIds.figure}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.caption}>As the recipe gives them on {from}.</p>
    </div>
  );
}
