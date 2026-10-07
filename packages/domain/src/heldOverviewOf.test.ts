import assert from "node:assert/strict";
import test from "node:test";
import { OverviewId, VideoId } from "./Brands.js";
import { heldOverviewOf } from "./heldOverviewOf.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import type { UnreadableRecord } from "./UnreadableRecord.js";

const storeWith = (overviews: ReturnType<typeof makeOverview>[], unreadable: UnreadableRecord[] = []) => ({
  listOverviews: async () => overviews,
  listUnreadable: async () => unreadable,
});

const quarantined = (id: string, videoId: string | null): UnreadableRecord => ({
  kind: "overview",
  id,
  schemaVersion: 99,
  reason: "future-version",
  detail: "from the future",
  salvaged: { savedAt: null, video: { id: videoId === null ? null : VideoId.parse(videoId), url: null, title: null } },
});

test("a readable overview of the video is found by its id", async () => {
  const overview = makeOverview({ video: { ...makeOverview().video, id: VideoId.parse("held") } });

  assert.deepEqual(await heldOverviewOf(storeWith([overview]), "held"), { id: overview.id, readable: true });
});

test("a quarantined record of the video counts as held, and says it cannot be read", async () => {
  const id = OverviewId.parse("7b1d9e0e-9f0b-4a8c-9a2e-1c3f5d7e9a0b");

  assert.deepEqual(await heldOverviewOf(storeWith([], [quarantined(id, "held")]), "held"), { id, readable: false });
});

test("a library with no overview of the video answers null", async () => {
  const overview = makeOverview({ video: { ...makeOverview().video, id: VideoId.parse("other") } });

  assert.equal(await heldOverviewOf(storeWith([overview], [quarantined("x", null)]), "held"), null);
});
