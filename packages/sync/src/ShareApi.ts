import type { Overview, Share, SharedNarration, StoredTranscript } from "@overview/domain";

export interface ShareOverviewInput {
  overview: Overview;
  transcript: StoredTranscript | null;
  narration: SharedNarration | null;
}

// Making, listing and stopping the links a reader has given out
// (docs/features/sharing.md). `share` both makes a link and replaces the copy behind one
// that already exists, because to the reader those are the same act.
export interface ShareApi {
  list(): Promise<Share[]>;
  share(input: ShareOverviewInput): Promise<Share>;
  stop(token: string): Promise<void>;
}
