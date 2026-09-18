import { z } from "zod";
import { TopicId } from "./Brands.js";

export const Topic = z.object({
  id: TopicId,
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Topic = z.infer<typeof Topic>;

export const sameTopicName = (left: string, right: string): boolean =>
  left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
