import { z } from "zod";
import { AuthSurface } from "./AuthSurface.js";

export const MagicLinkRequest = z.object({
  email: z.string().min(1),
  surface: AuthSurface,
});
export type MagicLinkRequest = z.infer<typeof MagicLinkRequest>;
