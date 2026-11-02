import { z } from "zod";
import { VideoSource } from "./VideoSource.js";

export const YouTubeSource = VideoSource.extend({ kind: z.literal("youtube") });
export type YouTubeSource = z.infer<typeof YouTubeSource>;

// What an overview is of. Each kind carries the fields it has, so a new kind joins this union
// and the compiler names every reader that assumed a video (docs/features/source-identity.md).
export const Source = z.discriminatedUnion("kind", [YouTubeSource]);
export type Source = z.infer<typeof Source>;

export const youTubeSource = (video: VideoSource): YouTubeSource => ({ ...video, kind: "youtube" });
