import test from "node:test";
import assert from "node:assert/strict";
import { PlaylistId, VideoId, type CaptureQueueStore } from "@overview/domain";
import { makeQueuedCapture } from "./makeQueuedCapture.js";

export function defineCaptureQueueStoreConformanceSuite(
  label: string,
  createStore: () => CaptureQueueStore | Promise<CaptureQueueStore>,
): void {
  const behaviour = (description: string) => `${label} CaptureQueueStore: ${description}`;
  const capture = (videoId: string, queuedAt: string, overrides: Parameters<typeof makeQueuedCapture>[0] = {}) =>
    makeQueuedCapture({ videoId: VideoId.parse(videoId), queuedAt, ...overrides });

  test(behaviour("the queue starts empty"), async () => {
    const store = await createStore();
    assert.deepEqual(await store.listQueue(), []);
  });

  test(behaviour("listQueue() is oldest queued first, whatever order they were added in"), async () => {
    const store = await createStore();
    await store.enqueue([capture("c", "2026-10-05T09:00:00.002Z"), capture("a", "2026-10-05T09:00:00.000Z")]);
    await store.enqueue([capture("b", "2026-10-05T09:00:00.001Z")]);
    assert.deepEqual((await store.listQueue()).map((queued) => queued.videoId), ["a", "b", "c"]);
  });

  test(behaviour("enqueue() keeps a video already in the queue where it is"), async () => {
    const store = await createStore();
    await store.enqueue([capture("a", "2026-10-05T09:00:00.000Z")]);
    await store.enqueue([capture("a", "2026-10-05T11:00:00.000Z", { title: "Queued again" })]);
    const queue = await store.listQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0]!.queuedAt, "2026-10-05T09:00:00.000Z");
  });

  test(behaviour("saveQueued() replaces one item, keeping its place"), async () => {
    const store = await createStore();
    await store.enqueue([capture("a", "2026-10-05T09:00:00.000Z"), capture("b", "2026-10-05T09:00:00.001Z")]);
    await store.saveQueued(capture("a", "2026-10-05T09:00:00.000Z", { status: "failed", problem: "noCaptions" }));
    const queue = await store.listQueue();
    assert.deepEqual(queue.map((queued) => [queued.videoId, queued.status]), [["a", "failed"], ["b", "waiting"]]);
  });

  test(behaviour("removeQueued() takes one video out"), async () => {
    const store = await createStore();
    await store.enqueue([capture("a", "2026-10-05T09:00:00.000Z"), capture("b", "2026-10-05T09:00:00.001Z")]);
    await store.removeQueued(VideoId.parse("a"));
    assert.deepEqual((await store.listQueue()).map((queued) => queued.videoId), ["b"]);
  });

  test(behaviour("removeWaiting() clears what is waiting and leaves what needs attention"), async () => {
    const store = await createStore();
    await store.enqueue([
      capture("a", "2026-10-05T09:00:00.000Z"),
      capture("b", "2026-10-05T09:00:00.001Z", { status: "skipped", problem: "private" }),
    ]);
    await store.removeWaiting();
    assert.deepEqual((await store.listQueue()).map((queued) => queued.videoId), ["b"]);
  });

  test(behaviour("removeWaiting() for one playlist leaves every other playlist's videos"), async () => {
    const store = await createStore();
    const other = { id: PlaylistId.parse("PLother"), title: "Overview" };
    await store.enqueue([
      capture("a", "2026-10-05T09:00:00.000Z"),
      capture("b", "2026-10-05T09:00:00.001Z", { fromPlaylist: other }),
    ]);
    await store.removeWaiting(PlaylistId.parse("PLpsychology"));
    assert.deepEqual((await store.listQueue()).map((queued) => queued.videoId), ["b"]);
  });
}
