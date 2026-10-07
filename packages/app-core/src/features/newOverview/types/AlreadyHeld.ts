import type { OverviewId } from "@overview/domain";

// The library already holds an overview of the video the reader pasted, so nothing is
// generated and the dialog offers to open it instead (docs/features/one-overview-per-video.md).
export interface AlreadyHeld {
  url: string;
  overviewId: OverviewId;
  // False for a record this app cannot read, which is still the reader's and still opens.
  readable: boolean;
}
