import { z } from "zod";
import { ShareToken } from "./shareLink.js";
import { SharedNote } from "./SharedNote.js";

// A ready-made overview Start offers, so a new reader can begin onboarding without leaving to
// find a link. It's a live share owned by a house account, listed by its note alone: the
// transcript and narration come with the whole copy once one is chosen
// (docs/features/onboarding.md, "Try a sample").
export const Sample = z.object({
  token: ShareToken,
  note: SharedNote,
});
export type Sample = z.infer<typeof Sample>;

export const Samples = z.object({ samples: z.array(Sample) });
export type Samples = z.infer<typeof Samples>;
