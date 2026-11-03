// "10 ingredients, 6 steps": counted by code from the page's recipe (design 144p).
export const recipeCounts = ({ ingredients, steps }: { ingredients: number; steps: number }, separator = ", "): string =>
  `${ingredients} ${ingredients === 1 ? "ingredient" : "ingredients"}${separator}${steps} ${steps === 1 ? "step" : "steps"}`;
