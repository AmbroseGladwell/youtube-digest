import { z } from "zod";
import { ShareToken } from "./shareLink.js";
import { SharedNote } from "./SharedNote.js";

// A house account's live share: docs/features/onboarding.md, "Try a sample".
export const Sample = z.object({
  token: ShareToken,
  note: SharedNote,
});
export type Sample = z.infer<typeof Sample>;

export const Samples = z.object({ samples: z.array(Sample) });
export type Samples = z.infer<typeof Samples>;
