import { z } from "zod";

export const LinkCodeRequest = z.object({
  code: z.string().min(1),
});
export type LinkCodeRequest = z.infer<typeof LinkCodeRequest>;
