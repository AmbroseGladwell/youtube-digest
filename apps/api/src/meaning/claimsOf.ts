import type { Overview } from "@overview/domain";

// Why the claim is the unit: docs/features/search-by-meaning.md, "The unit is the claim".
export const claimsOf = (overview: Overview): string[] => {
  return [overview.bigPicture ?? "", overview.coreClaim, ...overview.keyPoints.map((point) => point.text), overview.recipe?.summary ?? ""]
    .map((text) => text.trim())
    .filter((text) => text !== "");
};
