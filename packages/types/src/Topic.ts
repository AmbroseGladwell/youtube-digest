import { z } from "zod";

export const Topic = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Topic = z.infer<typeof Topic>;
