import { z } from "zod";

// Decided before writing: docs/features/overview-generation-decisions.md, "The kind check".
export const NoteKind = z.enum(["default", "recipe", "process"]);
export type NoteKind = z.infer<typeof NoteKind>;
