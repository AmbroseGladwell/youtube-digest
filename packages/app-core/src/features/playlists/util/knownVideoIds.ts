import type { CaptureQueueStore, OverviewStore } from "@overview/domain";

// Every video this library already has an overview of, readable or not: one overview per
// video (docs/features/capture-queue.md).
export async function libraryVideoIds(overviewStore: OverviewStore): Promise<Set<string>> {
  const [overviews, unreadable] = await Promise.all([overviewStore.listOverviews(), overviewStore.listUnreadable()]);
  return new Set<string>([
    ...overviews.flatMap(({ video }) => (video.id === null ? [] : [video.id])),
    ...unreadable.flatMap(({ salvaged }) => (salvaged?.video?.id == null ? [] : [salvaged.video.id])),
  ]);
}

// ...and every video already queued, so none of them is queued twice.
export async function knownVideoIds(overviewStore: OverviewStore, captureQueueStore: CaptureQueueStore): Promise<Set<string>> {
  const [held, queue] = await Promise.all([libraryVideoIds(overviewStore), captureQueueStore.listQueue()]);
  return new Set<string>([...held, ...queue.map((capture) => capture.videoId)]);
}
