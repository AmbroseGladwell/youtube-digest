import { z } from "zod";

// Whose key made an overview: ours, through our server, or the reader's own, on the device.
// Each has its own monthly quota on an account (docs/architecture/tiers.md, "Counting").
export const KeySource = z.enum(["ours", "own"]);
export type KeySource = z.infer<typeof KeySource>;
