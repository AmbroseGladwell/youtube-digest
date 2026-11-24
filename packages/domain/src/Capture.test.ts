import assert from "node:assert/strict";
import test from "node:test";
import { Capture } from "./Capture.js";

const base = {
  id: "8d0b1b52-6c1f-4a43-9a0e-0c2f4a1e9b11",
  sourceKey: "dQw4w9WgXcQ",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  keptAt: "2026-11-23T09:00:00.000Z",
  keptFrom: "phone",
  captureReason: null,
};

const source = {
  kind: "youtube",
  id: "dQw4w9WgXcQ",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "A video",
  channel: "A channel",
  description: null,
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  durationMs: 600_000,
  publishedAt: null,
};

test("a kept link needs only its address and what it waits for", () => {
  const read = Capture.safeParse({ ...base, stage: "kept", source: null, waitingFor: "extension", resumesAt: null });

  assert.equal(read.success, true);
});

test("a saved capture must carry its source, since its transcript is kept with it", () => {
  const withSource = Capture.safeParse({ ...base, stage: "saved", source, savedAt: "2026-11-23T09:30:00.000Z" });
  const withoutSource = Capture.safeParse({ ...base, stage: "saved", source: null, savedAt: "2026-11-23T09:30:00.000Z" });

  assert.equal(withSource.success, true);
  assert.equal(withoutSource.success, false);
});

test("a kept link waits only for our server, the extension or the month's reset", () => {
  const read = Capture.safeParse({ ...base, stage: "kept", source: null, waitingFor: "tomorrow", resumesAt: null });

  assert.equal(read.success, false);
});
