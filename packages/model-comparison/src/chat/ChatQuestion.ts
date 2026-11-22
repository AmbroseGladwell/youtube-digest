import { z } from "zod";

export const QUESTION_KINDS = ["inOverview", "transcriptOnly", "notInSource", "twoMoments"] as const;

export const ChatQuestion = z.object({
  id: z.string().min(1),
  kind: z.enum(QUESTION_KINDS),
  question: z.string().min(1),
  quotes: z.array(z.string().min(1)),
  mentions: z.array(z.string().min(1)),
});
export type ChatQuestion = z.infer<typeof ChatQuestion>;

export const ChatQuestionSet = z.object({
  overviewId: z.string(),
  videoId: z.string(),
  questions: z.array(ChatQuestion).min(1),
});
export type ChatQuestionSet = z.infer<typeof ChatQuestionSet>;

const QUOTES_NEEDED: Record<ChatQuestion["kind"], number> = {
  inOverview: 1,
  transcriptOnly: 1,
  notInSource: 0,
  twoMoments: 2,
};

export const quotesNeeded = (kind: ChatQuestion["kind"]): number => QUOTES_NEEDED[kind];
