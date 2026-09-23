import test from "node:test";
import assert from "node:assert/strict";
import { VideoId, type TranscriptStore } from "@overview/domain";
import { makeStoredTranscript } from "./makeStoredTranscript.js";

export function defineTranscriptStoreConformanceSuite(
  label: string,
  createStore: () => TranscriptStore | Promise<TranscriptStore>,
): void {
  const behaviour = (description: string) => `${label} TranscriptStore: ${description}`;

  test(behaviour("saveTranscript then getTranscript round-trips the segments and their timings"), async () => {
    const store = await createStore();
    const transcript = makeStoredTranscript();
    await store.saveTranscript(transcript);
    assert.deepEqual(await store.getTranscript(transcript.videoId), transcript);
  });

  test(behaviour("getTranscript returns null for a video nobody has fetched"), async () => {
    const store = await createStore();
    assert.equal(await store.getTranscript(VideoId.parse("never-fetched")), null);
  });

  test(behaviour("a second note on the same video replaces the transcript rather than duplicating it"), async () => {
    const store = await createStore();
    const first = makeStoredTranscript({ fetchedAt: "2026-09-01T00:00:00.000Z" });
    await store.saveTranscript(first);
    await store.saveTranscript({ ...first, fetchedAt: "2026-09-16T00:00:00.000Z" });

    const stored = await store.getTranscript(first.videoId);
    assert.equal(stored?.fetchedAt, "2026-09-16T00:00:00.000Z");
  });

  test(behaviour("two videos keep their own transcripts"), async () => {
    const store = await createStore();
    const first = makeStoredTranscript({ videoId: VideoId.parse("first-video") });
    const second = makeStoredTranscript({
      videoId: VideoId.parse("second-video"),
      segments: [{ text: "A different video entirely.", startMs: 0, endMs: 1000 }],
    });
    await store.saveTranscript(first);
    await store.saveTranscript(second);

    assert.deepEqual((await store.getTranscript(second.videoId))?.segments, second.segments);
    assert.deepEqual((await store.getTranscript(first.videoId))?.segments, first.segments);
  });

  test(behaviour("a video whose captions were machine-generated records that it was"), async () => {
    const store = await createStore();
    const transcript = makeStoredTranscript({ generated: true });
    await store.saveTranscript(transcript);
    assert.equal((await store.getTranscript(transcript.videoId))?.generated, true);
  });

  test(behaviour("the metadata the captions were fetched with is stored beside them"), async () => {
    const store = await createStore();
    const transcript = makeStoredTranscript();
    await store.saveTranscript(transcript);
    assert.deepEqual((await store.getTranscript(transcript.videoId))?.video, transcript.video);
  });

  test(behaviour("a record stored before metadata was kept round-trips without one being invented"), async () => {
    const store = await createStore();
    const { video, ...withoutVideo } = makeStoredTranscript();
    assert.ok(video);
    await store.saveTranscript(withoutVideo);
    assert.equal((await store.getTranscript(withoutVideo.videoId))?.video, undefined);
  });

  test(behaviour("deleteTranscript removes it"), async () => {
    const store = await createStore();
    const transcript = makeStoredTranscript();
    await store.saveTranscript(transcript);
    await store.deleteTranscript(transcript.videoId);
    assert.equal(await store.getTranscript(transcript.videoId), null);
  });

  test(behaviour("deleting a transcript that was never saved does not throw"), async () => {
    const store = await createStore();
    await assert.doesNotReject(() => store.deleteTranscript(VideoId.parse("never-fetched")));
  });
}
