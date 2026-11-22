import { z } from "zod";

export const OverviewId = z.uuid().brand("OverviewId");
export type OverviewId = z.infer<typeof OverviewId>;

export const TopicId = z.uuid().brand("TopicId");
export type TopicId = z.infer<typeof TopicId>;

export const ProjectId = z.uuid().brand("ProjectId");
export type ProjectId = z.infer<typeof ProjectId>;

// The platform's id, so one transcript serves every note on it: docs/features/transcript-storage.md.
export const VideoId = z.string().min(1).brand("VideoId");
export type VideoId = z.infer<typeof VideoId>;

// A YouTube key is its bare VideoId, so the two are one type (docs/features/source-identity.md).
export const SourceKey = VideoId;
export type SourceKey = VideoId;

// The value of a link's list= parameter (docs/features/playlists.md).
export const PlaylistId = z.string().min(1).brand("PlaylistId");
export type PlaylistId = z.infer<typeof PlaylistId>;
