import { z } from "zod";

export const TOPIC_SUGGESTION_TEXT_CHARACTERS = 4000;
export const TOPIC_SUGGESTION_NEW_NAME_CHARACTERS = 40;

// Before an account, naming at most one new topic: docs/features/onboarding.md, "Suggested topics".
export const TopicSuggestionInput = z.object({
  title: z.string().min(1).max(500),
  kind: z.enum(["video", "article", "recipe"]),
  // A video's description and the start of its transcript, or a page's opening.
  text: z.string().max(TOPIC_SUGGESTION_TEXT_CHARACTERS),
});
export type TopicSuggestionInput = z.infer<typeof TopicSuggestionInput>;

export const TopicSuggestionResult = z.object({
  starter: z.array(z.string()).max(3),
  newTopic: z.string().min(1).max(TOPIC_SUGGESTION_NEW_NAME_CHARACTERS).nullable(),
});
export type TopicSuggestionResult = z.infer<typeof TopicSuggestionResult>;
