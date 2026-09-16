import type { Novelty } from "@overview/types";

export const NOVELTY_LABEL: Record<Novelty, string> = {
  novel: "Novel",
  competent_not_new: "Established",
  recycled: "Recycled",
};

export const NOVELTY_ORDER: Novelty[] = ["novel", "competent_not_new", "recycled"];
