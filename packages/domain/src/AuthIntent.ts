import { z } from "zod";

// It decides only the mail and the log line: docs/features/sign-in.md, "Creating an account".
export const AuthIntent = z.enum(["signIn", "createAccount"]);
export type AuthIntent = z.infer<typeof AuthIntent>;
