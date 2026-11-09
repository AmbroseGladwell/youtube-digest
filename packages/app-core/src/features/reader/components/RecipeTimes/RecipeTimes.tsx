import { recipeFigures, sourceName, type Recipe, type Source } from "@overview/domain";
import styles from "./RecipeTimes.module.scss";
import { recipeTimesTestIds } from "./RecipeTimesTestIds.js";

export interface RecipeTimesProps {
  recipe: Pick<Recipe, "prepMinutes" | "cookMinutes" | "totalMinutes" | "yield">;
  source: Source;
}

// Designs 144f and 122f: only what the page or the video's description states, labelled, with
// a caption saying whose figures they are so nothing suggests we timed it. Nothing stated,
// nothing shown.
export function RecipeTimes({ recipe, source }: RecipeTimesProps) {
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
      <p className={styles.caption}>
        {source.kind === "youtube" ? "As the video’s description gives them." : `As the recipe gives them on ${sourceName(source)}.`}
      </p>
    </div>
  );
}
