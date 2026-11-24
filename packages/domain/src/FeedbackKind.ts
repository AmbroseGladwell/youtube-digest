import { z } from "zod";

export const FeedbackKind = z.enum(["wrong", "idea"]);
export type FeedbackKind = z.infer<typeof FeedbackKind>;
