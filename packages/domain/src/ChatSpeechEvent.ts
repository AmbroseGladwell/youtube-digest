import { z } from "zod";

const SpokenAnswerPlace = z.discriminatedUnion("part", [
  z.object({ part: z.literal("text") }),
  z.object({ part: z.literal("intro") }),
  z.object({ part: z.literal("heading"), section: z.number().int().nonnegative() }),
  z.object({ part: z.literal("paragraph"), section: z.number().int().nonnegative(), paragraph: z.number().int().nonnegative() }),
  z.object({ part: z.literal("numbered"), section: z.number().int().nonnegative(), item: z.number().int().nonnegative() }),
  z.object({ part: z.literal("bullet"), section: z.number().int().nonnegative(), item: z.number().int().nonnegative() }),
  z.object({ part: z.literal("takeaway") }),
]);

const SentenceOnScreen = z.object({
  place: SpokenAnswerPlace,
  block: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

const SentenceRange = z.object({ first: z.number().int().nonnegative(), count: z.number().int().positive() });

export const SPEECH_WARM_PATH = "/speech/warm";

// One NDJSON line each: docs/features/chat-read-aloud.md, "The live lane".
export const ChatSpeechEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sentences"), sentences: z.array(SentenceOnScreen) }),
  z.object({
    type: z.literal("audio"),
    ...SentenceRange.shape,
    sentenceStartsSeconds: z.array(z.number().nonnegative()),
    durationSeconds: z.number().positive(),
    audioBase64: z.string().min(1),
  }),
  z.object({ type: z.literal("skipped"), ...SentenceRange.shape }),
  z.object({ type: z.literal("done") }),
]);
export type ChatSpeechEvent = z.infer<typeof ChatSpeechEvent>;
