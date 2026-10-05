import { z } from "zod";

export const EmailCodeRequest = z.object({
  email: z.string().min(1),
  code: z.string().min(1),
});
export type EmailCodeRequest = z.infer<typeof EmailCodeRequest>;
