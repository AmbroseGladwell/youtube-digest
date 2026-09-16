import { z } from "zod";

export const HowToApply = z.object({
  items: z.array(z.string()).max(3),
});
export type HowToApply = z.infer<typeof HowToApply>;
