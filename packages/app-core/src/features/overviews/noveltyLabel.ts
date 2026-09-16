import type { Novelty } from "@overview/types";

export const NOVELTY_LABEL: Record<Novelty, string> = {
  novel: "Novel",
  established: "Established",
  recycled: "Recycled",
};

export const NOVELTY_ORDER: Novelty[] = ["novel", "established", "recycled"];
