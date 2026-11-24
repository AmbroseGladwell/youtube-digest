import { z } from "zod";
import { AuthSurface } from "./AuthSurface.js";
import { OverviewId } from "./Brands.js";
import { ClientErrorTrailEntry, MAX_ERROR_TRAIL } from "./ClientErrorBatch.js";
import { FeedbackKind } from "./FeedbackKind.js";

export const FEEDBACK_PATH = "/feedback";
export const MAX_FEEDBACK_LENGTH = 4000;

export const TriageOutcome = z.enum(["supports", "adds", "new-card", "not-for-us"]);
export type TriageOutcome = z.infer<typeof TriageOutcome>;

// docs/features/feedback.md, "What is sent".
export const FeedbackRequest = z.strictObject({
  text: z.string().trim().min(1).max(MAX_FEEDBACK_LENGTH),
  surface: AuthSurface,
  kind: FeedbackKind.optional(),
  overviewId: OverviewId.optional(),
  trail: z.array(ClientErrorTrailEntry).max(MAX_ERROR_TRAIL).optional(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequest>;
