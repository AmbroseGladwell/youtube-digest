import { z } from "zod";

// Which shell asked for the sign-in, because the two are signed in differently: the web
// app by a cookie on its own origin, the extension by a bearer it exchanges a code for
// (docs/features/sign-in.md).
export const AuthSurface = z.enum(["web", "extension"]);
export type AuthSurface = z.infer<typeof AuthSurface>;
