import type { Overview } from "@overview/domain";
import { labelledClaimsOf } from "./labelledClaimsOf.js";

// Why the claim is the unit: docs/features/search-by-meaning.md, "The unit is the claim".
export const claimsOf = (overview: Overview): string[] => labelledClaimsOf(overview).map((claim) => claim.text);
