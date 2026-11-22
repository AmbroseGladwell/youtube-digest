import { z } from "zod";
import { Tag } from "./Filing.js";

// null for a deleted tag; kept so a later overview can't bring it back (docs/features/tag-reuse.md).
export const TagAliases = z.record(Tag, Tag.nullable());
export type TagAliases = z.infer<typeof TagAliases>;
