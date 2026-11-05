import { z } from "zod";

// A finished note matched against the reader's own topics, for an overview they didn't make:
// a sample saved into a new account (docs/features/onboarding.md, "Try a sample"). It needs no
// transcript, and never invents a topic.
export const TopicMatchInput = z.object({
  title: z.string(),
  source: z.string(),
  inOneLine: z.string(),
  keyPoints: z.array(z.string()),
  topics: z
    .array(z.object({ name: z.string().min(1), description: z.string().nullable() }))
    .min(1)
    .max(100),
});
export type TopicMatchInput = z.infer<typeof TopicMatchInput>;

export const TopicMatchResult = z.object({ names: z.array(z.string()) });
export type TopicMatchResult = z.infer<typeof TopicMatchResult>;
