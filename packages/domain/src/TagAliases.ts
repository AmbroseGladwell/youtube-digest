import { z } from "zod";
import { Tag } from "./Filing.js";

// A tag the reader merged or renamed away, and the tag it became; null for one they deleted.
// Kept so that a later overview cannot bring it back (docs/features/tag-reuse.md).
export const TagAliases = z.record(Tag, Tag.nullable());
export type TagAliases = z.infer<typeof TagAliases>;
