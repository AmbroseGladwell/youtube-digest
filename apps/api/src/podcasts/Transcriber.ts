import { z } from "zod";
import { TranscriptSegment } from "@overview/domain";

export const TranscribedAudio = z.object({
  segments: z.array(TranscriptSegment).min(1),
  audioSeconds: z.number().nonnegative(),
  language: z.string().nullable(),
  gpu: z.string(),
  cold: z.boolean(),
  modelLoadSeconds: z.number().nonnegative(),
  workerSeconds: z.number().nonnegative(),
});
export type TranscribedAudio = z.infer<typeof TranscribedAudio>;

// What the GPU host says of one job: `waiting` for a card, `running` once the worker has started.
export const HostJobState = z.discriminatedUnion("state", [
  z.object({ state: z.literal("waiting") }),
  z.object({ state: z.literal("running") }),
  z.object({ state: z.literal("done"), result: TranscribedAudio }),
  z.object({ state: z.literal("failed"), error: z.string(), detail: z.string().optional() }),
]);
export type HostJobState = z.infer<typeof HostJobState>;

// The GPU host behind the speech-to-text rung (services/stt/modal_app.py): a job is submitted,
// asked after until it ends, and cancelled when the reader's wait runs out.
export interface Transcriber {
  submit(audioUrl: string, maxSeconds: number): Promise<string>;
  status(callId: string): Promise<HostJobState>;
  cancel(callId: string): Promise<void>;
}
