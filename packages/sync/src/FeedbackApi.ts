import type { FeedbackRequest } from "@overview/domain";

export interface FeedbackApi {
  send(feedback: FeedbackRequest): Promise<void>;
}
