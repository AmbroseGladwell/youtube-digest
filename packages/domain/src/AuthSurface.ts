import { z } from "zod";

// The web app signs in by cookie, the extension by a bearer token (docs/features/sign-in.md).
export const AuthSurface = z.enum(["web", "extension"]);
export type AuthSurface = z.infer<typeof AuthSurface>;
