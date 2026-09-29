import { z } from "zod";

export const FIRST_NAME_MAX_LENGTH = 80;

export const FirstName = z.string().trim().min(1).max(FIRST_NAME_MAX_LENGTH);
export type FirstName = z.infer<typeof FirstName>;
