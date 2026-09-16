import { z } from "zod";
import { tagPattern } from "./Filing.js";

export const NoteState = z.object({
  noteId: z.string(),
  read: z.boolean(),
  favourite: z.boolean(),
  userTags: z.array(z.string().regex(tagPattern)),
});
export type NoteState = z.infer<typeof NoteState>;

export const DEFAULT_NOTE_STATE: Omit<NoteState, "noteId"> = {
  read: false,
  favourite: false,
  userTags: [],
};
