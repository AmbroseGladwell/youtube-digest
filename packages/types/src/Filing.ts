import { z } from "zod";
import { TopicId } from "./Brands.js";

export const tagPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const Filing = z.object({
  topicIds: z.array(TopicId),
  tags: z.array(z.string().regex(tagPattern)).min(3).max(6),
});
export type Filing = z.infer<typeof Filing>;
