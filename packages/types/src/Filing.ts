import { z } from "zod";

export const Filing = z.object({
  topicIds: z.array(z.string()),
  tags: z
    .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/))
    .min(3)
    .max(6),
});
export type Filing = z.infer<typeof Filing>;
