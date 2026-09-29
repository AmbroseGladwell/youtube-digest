import { z } from "zod";

// Whether the reader asked to sign in or to create an account. The server answers both the
// same way; the intent decides which mail goes out and how the sign-in is logged
// (docs/features/sign-in.md, "Creating an account").
export const AuthIntent = z.enum(["signIn", "createAccount"]);
export type AuthIntent = z.infer<typeof AuthIntent>;
