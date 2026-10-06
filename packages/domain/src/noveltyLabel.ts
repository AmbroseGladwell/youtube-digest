import type { Novelty } from "./Verdict.js";

export const NOVELTY_LABEL: Record<Novelty, string> = {
  common_knowledge: "Common knowledge",
  fresh_angle: "Fresh angle",
  original: "Original",
};

export const NOVELTY_ORDER: Novelty[] = ["common_knowledge", "fresh_angle", "original"];

export const STANDS_OUT_LABEL = "What stands out";

export const REASONING_LABEL = "Why";

export const NOVELTY_BASIS =
  "Judged by the AI against what it knows of the field. Very recent work may be missed and it can make mistakes.";
