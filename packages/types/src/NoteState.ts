import { z } from "zod";

export const NoteState = z.object({
  noteId: z.string(),
  read: z.boolean(),
  favourite: z.boolean(),
});
export type NoteState = z.infer<typeof NoteState>;

export const DEFAULT_NOTE_STATE: Omit<NoteState, "noteId"> = {
  read: false,
  favourite: false,
};
