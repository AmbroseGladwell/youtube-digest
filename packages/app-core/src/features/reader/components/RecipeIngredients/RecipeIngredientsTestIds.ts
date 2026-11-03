export const recipeIngredientsTestIds = {
  root: "RecipeIngredients.root",
  line: "RecipeIngredients.line",
  activeLine: "RecipeIngredients.activeLine",
  changed: "RecipeIngredients.changed",
  fewer: "RecipeIngredients.fewer",
  more: "RecipeIngredients.more",
  servings: "RecipeIngredients.servings",
  multiplier: (label: string) => `RecipeIngredients.multiplier.${label}`,
  units: (units: string) => `RecipeIngredients.units.${units}`,
  status: "RecipeIngredients.status",
  backToWritten: "RecipeIngredients.backToWritten",
  readAloud: "RecipeIngredients.readAloud",
};
