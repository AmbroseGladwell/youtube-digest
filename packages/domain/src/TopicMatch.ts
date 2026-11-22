import { z } from "zod";

// Never invents a topic: docs/features/onboarding.md, "Try a sample".
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
