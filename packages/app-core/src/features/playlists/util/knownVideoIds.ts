import { sourceKey, type CaptureQueueStore, type OverviewStore } from "@overview/domain";

// Unreadable overviews count too: there is one overview per video.
export const libraryVideoIds = async (overviewStore: OverviewStore): Promise<Set<string>> => {
  const [overviews, unreadable] = await Promise.all([overviewStore.listOverviews(), overviewStore.listUnreadable()]);
  return new Set<string>([
    ...overviews.flatMap(({ source }) => sourceKey(source) ?? []),
    ...unreadable.flatMap(({ salvaged }) => (salvaged?.source == null ? [] : (sourceKey(salvaged.source) ?? []))),
  ]);
};

// Queued videos count too, so none of them is queued twice.
export const knownVideoIds = async (overviewStore: OverviewStore, captureQueueStore: CaptureQueueStore): Promise<Set<string>> => {
  const [held, queue] = await Promise.all([libraryVideoIds(overviewStore), captureQueueStore.listQueue()]);
  return new Set<string>([...held, ...queue.map((capture) => capture.videoId)]);
};
