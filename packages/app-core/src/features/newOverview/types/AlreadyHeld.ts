import type { OverviewId } from "@overview/domain";

export interface AlreadyHeld {
  url: string;
  overviewId: OverviewId;
  // False for a record this app cannot read, which is still the reader's and still opens.
  readable: boolean;
}
