export interface RecipeCountsOptions {
  ingredients: number;
  steps: number;
}

export const recipeCounts = ({ ingredients, steps }: RecipeCountsOptions, separator = ", "): string =>
  `${ingredients} ${ingredients === 1 ? "ingredient" : "ingredients"}${separator}${steps} ${steps === 1 ? "step" : "steps"}`;
