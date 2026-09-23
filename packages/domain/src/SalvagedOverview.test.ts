import test from "node:test";
import assert from "node:assert/strict";
import { salvageOverview } from "./SalvagedOverview.js";

test("the video and the saved date survive a record that will not parse", () => {
  assert.deepEqual(
    salvageOverview({
      id: "9f1c2e7a-5d3b-4f8e-9a1b-2c3d4e5f6a7b",
      savedAt: "2026-01-04T09:30:00.000Z",
      video: { id: "kQu7vN2wLpE", url: "https://www.youtube.com/watch?v=kQu7vN2wLpE", title: "A title", channel: 7 },
      coreClaim: 7,
    }),
    {
      savedAt: "2026-01-04T09:30:00.000Z",
      video: { id: "kQu7vN2wLpE", url: "https://www.youtube.com/watch?v=kQu7vN2wLpE", title: "A title" },
    },
  );
});

test("a missing saved date salvages as null rather than failing the salvage", () => {
  assert.deepEqual(salvageOverview({ video: { url: "https://example.com/v", title: "A title" } }), {
    savedAt: null,
    video: { id: null, url: "https://example.com/v", title: "A title" },
  });
});

test("a record with nothing left to salvage salvages nothing rather than throwing", () => {
  assert.deepEqual(salvageOverview({}), { savedAt: null, video: null });
  assert.equal(salvageOverview("not a record"), null);
});
