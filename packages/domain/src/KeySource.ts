import { z } from "zod";

// Each key has its own monthly quota: docs/architecture/tiers.md, "Counting".
export const KeySource = z.enum(["ours", "own"]);
export type KeySource = z.infer<typeof KeySource>;
