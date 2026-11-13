import type { Overview } from "./Overview.js";
import type { PodcastSource } from "./Source.js";

// A podcast episode's overview, until PodcastSource joins Source with the screens; then it is an
// Overview like any other (docs/features/podcast-notes.md).
export type PodcastOverview = Omit<Overview, "source"> & { source: PodcastSource };
