import type { OverviewId } from "@overview/domain";

export interface AlreadyHeld {
  url: string;
  overviewId: OverviewId;
  // False for a record this app cannot read, which is still the reader's and still opens.
  readable: boolean;
  // Design 358c-2: an overview, an item saved without one, or a link waiting in the queue.
  as: "overview" | "saved" | "queued";
}
