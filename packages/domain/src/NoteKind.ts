import { z } from "zod";

// What kind of note a source gets, decided before it is written, so each kind's schema
// carries only its own sections (docs/features/overview-generation-decisions.md,
// "The kind check").
export const NoteKind = z.enum(["default", "recipe"]);
export type NoteKind = z.infer<typeof NoteKind>;
