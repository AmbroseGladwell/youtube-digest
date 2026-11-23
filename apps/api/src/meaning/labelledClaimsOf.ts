import type { Overview } from "@overview/domain";

export type ClaimField = "bigPicture" | "coreClaim" | "keyPoint" | "recipe";

export interface LabelledClaim {
  field: ClaimField;
  text: string;
}

// In the order claimsOf embeds them, so a stored position names its claim.
export const labelledClaimsOf = (overview: Overview): LabelledClaim[] =>
  [
    { field: "bigPicture" as const, text: overview.bigPicture ?? "" },
    { field: "coreClaim" as const, text: overview.coreClaim },
    ...overview.keyPoints.map((point) => ({ field: "keyPoint" as const, text: point.text })),
    { field: "recipe" as const, text: overview.recipe?.summary ?? "" },
  ]
    .map((claim) => ({ ...claim, text: claim.text.trim() }))
    .filter((claim) => claim.text !== "");
