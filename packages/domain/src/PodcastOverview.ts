import type { Overview } from "./Overview.js";
import type { PodcastSource } from "./Source.js";

export type PodcastOverview = Omit<Overview, "source"> & { source: PodcastSource };
