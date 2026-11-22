import { z } from "zod";

const Key = z.string().regex(/^[0-9a-f]{64}$/);

// docs/features/tts-pre-rendered-speech.md, "The API side".
export const NarrationRender = z.discriminatedUnion("status", [
  z.object({ key: Key, status: z.literal("queued") }),
  z.object({ key: Key, status: z.literal("rendering") }),
  z.object({ key: Key, status: z.literal("failed") }),
  z.object({
    key: Key,
    status: z.literal("ready"),
    lineStartsSeconds: z.array(z.number().nonnegative()),
    durationSeconds: z.number().positive(),
    fileUrl: z.string().min(1),
  }),
]);
export type NarrationRender = z.infer<typeof NarrationRender>;
export type ReadyNarration = Extract<NarrationRender, { status: "ready" }>;
