import { z } from "zod";
import { TopicId } from "./Brands.js";

export const Topic = z.object({
  id: TopicId,
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Topic = z.infer<typeof Topic>;

export const TopicPatch = z
  .object({ name: z.string().trim().min(1), description: z.string().nullable() })
  .partial()
  .strict();
export type TopicPatch = z.infer<typeof TopicPatch>;

export const sameTopicName = (left: string, right: string): boolean => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
