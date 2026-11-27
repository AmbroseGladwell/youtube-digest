import { z } from "zod";
import { NoteKind } from "./NoteKind.js";

const SAMPLE_CHARACTERS = 20_000;

export const KIND_CHECK_PATH = "/generations/kind-check";

// A video's kind before writing, only where About you is asked: docs/features/personalisation.md, "Asked once more".
export const KindCheckInput = z.object({
  title: z.string().max(SAMPLE_CHARACTERS),
  by: z.string().max(SAMPLE_CHARACTERS),
  description: z.string().max(SAMPLE_CHARACTERS),
  opening: z.string().max(SAMPLE_CHARACTERS),
  spoken: z.boolean().optional(),
});
export type KindCheckInput = z.infer<typeof KindCheckInput>;

export const KindCheckResult = z.object({ noteKind: NoteKind });
export type KindCheckResult = z.infer<typeof KindCheckResult>;
