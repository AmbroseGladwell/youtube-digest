export interface RecipeCountsOptions {
  ingredients: number;
  steps: number;
}

// "10 ingredients, 6 steps": counted by code from the page's recipe (design 144p).
export const recipeCounts = ({ ingredients, steps }: RecipeCountsOptions, separator = ", "): string =>
  `${ingredients} ${ingredients === 1 ? "ingredient" : "ingredients"}${separator}${steps} ${steps === 1 ? "step" : "steps"}`;
