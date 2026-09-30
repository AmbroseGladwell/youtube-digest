import { z } from "zod";
import { SharedOverview, ShareToken } from "@overview/domain";

// What the visitor was in the middle of when they were asked to make an account. Kept so
// that confirming the account finishes what they started rather than dropping them in an
// empty library (design 30l, docs/features/sharing.md).
export const SharedPageIntent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("save"), token: ShareToken, title: z.string(), snapshot: SharedOverview }),
  z.object({ kind: z.literal("generate"), videoUrl: z.url() }),
]);
export type SharedPageIntent = z.infer<typeof SharedPageIntent>;
