import { z } from "zod";

export const OverviewId = z.uuid().brand("OverviewId");
export type OverviewId = z.infer<typeof OverviewId>;

export const TopicId = z.uuid().brand("TopicId");
export type TopicId = z.infer<typeof TopicId>;

// A platform's own id for the video (Supadata's Metadata.id), not a uuid we mint: it is
// what makes one stored transcript answer for every note taken from the same video
// (docs/features/transcript-storage.md).
export const VideoId = z.string().min(1).brand("VideoId");
export type VideoId = z.infer<typeof VideoId>;
