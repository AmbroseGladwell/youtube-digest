import { z } from "zod";

export const EmailChangeRequest = z.object({
  email: z.string().min(1),
});
export type EmailChangeRequest = z.infer<typeof EmailChangeRequest>;
