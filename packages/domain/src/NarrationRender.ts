import { z } from "zod";

const Key = z.string().regex(/^[0-9a-f]{64}$/);

// docs/features/tts-pre-rendered-speech.md, "The API side".
export const NarrationRender = z.discriminatedUnion("status", [
  z.object({ key: Key, status: z.literal("queued") }),
  z.object({
    key: Key,
    status: z.literal("rendering"),
    lineStartsSeconds: z.array(z.number().nonnegative()).optional(),
    renderedSeconds: z.number().nonnegative().optional(),
    playlistUrl: z.string().min(1).optional(),
  }),
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
export type RenderingNarration = Extract<NarrationRender, { status: "rendering" }>;

// A render far enough along to be played from its playlist: docs/features/audio-player.md, "Playing while it renders".
export type StreamingNarration = RenderingNarration & { lineStartsSeconds: number[]; renderedSeconds: number; playlistUrl: string };

export const isStreaming = (render: NarrationRender): render is StreamingNarration =>
  render.status === "rendering" &&
  render.playlistUrl !== undefined &&
  render.lineStartsSeconds !== undefined &&
  render.renderedSeconds !== undefined;
