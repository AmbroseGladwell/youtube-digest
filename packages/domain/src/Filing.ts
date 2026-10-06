import { z } from "zod";
import { TopicId } from "./Brands.js";

export const tagPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const Tag = z.string().regex(tagPattern);
export type Tag = z.infer<typeof Tag>;

// Generation still asks for three to six; a stored note may hold fewer once the reader has
// merged or deleted tags (docs/features/tag-reuse.md).
export const MAX_TAGS = 6;

export const Filing = z.object({
  topicIds: z.array(TopicId),
  tags: z.array(Tag).max(MAX_TAGS),
});
export type Filing = z.infer<typeof Filing>;
