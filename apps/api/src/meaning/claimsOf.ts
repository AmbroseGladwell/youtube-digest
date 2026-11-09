import type { Overview } from "@overview/domain";

// The claim is the unit, not the overview: a long interview is about several things, and
// each claim and key point is already one short proposition (docs/features/search-by-meaning.md).
export function claimsOf(overview: Overview): string[] {
  return [overview.bigPicture ?? "", overview.coreClaim, ...overview.keyPoints.map((point) => point.text), overview.recipe?.summary ?? ""]
    .map((text) => text.trim())
    .filter((text) => text !== "");
}
