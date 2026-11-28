import type { KeptCapture } from "@overview/domain";
import type { KeyedFeedEntry } from "../types/KeyedFeedEntry.js";

export interface KeptNewest {
  arriving: KeyedFeedEntry[];
  dropped: KeptCapture[];
}

const droppable = (capture: KeptCapture): boolean => capture.queueStatus === "waiting" && capture.chosenAt === null;

// Chosen, failed and being made never drop: docs/features/followed-feeds.md, "Entries".
export const keptNewest = (waiting: readonly KeptCapture[], fresh: readonly KeyedFeedEntry[], now: Date, most: number): KeptNewest => {
  const arrivedAt = now.toISOString();
  const candidates = [
    ...waiting.filter(droppable).map((capture) => ({ at: capture.addedAt ?? capture.keptAt, capture, keyed: null })),
    ...fresh.map((keyed) => ({ at: keyed.entry.publishedAt ?? arrivedAt, capture: null, keyed })),
  ].sort((left, right) => right.at.localeCompare(left.at));
  const kept = candidates.slice(0, most);
  const left = candidates.slice(most);
  return {
    arriving: kept.flatMap(({ keyed }) => (keyed === null ? [] : [keyed])),
    dropped: left.flatMap(({ capture }) => (capture === null ? [] : [capture])),
  };
};
