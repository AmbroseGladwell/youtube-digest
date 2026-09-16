import { z } from "zod";

export const OverviewId = z.uuid().brand("OverviewId");
export type OverviewId = z.infer<typeof OverviewId>;

export const TopicId = z.uuid().brand("TopicId");
export type TopicId = z.infer<typeof TopicId>;
