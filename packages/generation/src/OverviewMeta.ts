import type { OverviewId, SourceKey } from "@overview/domain";

export interface OverviewMeta {
  id: OverviewId;
  savedAt: string;
}

export interface AssembledOverviewMeta extends OverviewMeta {
  sourceId: SourceKey;
}
