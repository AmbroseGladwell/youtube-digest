import type { Overview } from "./Overview.js";
import type { PodcastSource } from "./Source.js";

// An overview known to be of an episode, as generation makes one.
export type PodcastOverview = Omit<Overview, "source"> & { source: PodcastSource };
