import type { Overview, Share, SharedNarration } from "@overview/domain";

export interface ShareOverviewInput {
  overview: Overview;
  narration: SharedNarration | null;
}

// `share` both makes a link and replaces the copy behind one: to the reader they're the same act.
export interface ShareApi {
  list(): Promise<Share[]>;
  share(input: ShareOverviewInput): Promise<Share>;
  stop(token: string): Promise<void>;
}
