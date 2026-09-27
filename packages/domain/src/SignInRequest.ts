import { z } from "zod";

export const SignInRequest = z.object({
  token: z.string().min(1),
});
export type SignInRequest = z.infer<typeof SignInRequest>;
