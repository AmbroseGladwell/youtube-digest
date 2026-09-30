import { z } from "zod";

const Key = z.string().regex(/^[0-9a-f]{64}$/);

// What POST /api/audio and GET /api/audio/:key answer: the render's status, and once it is
// ready, a start for every line of the spoken script and the file to play
// (docs/features/tts-pre-rendered-speech.md, "The API side").
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
