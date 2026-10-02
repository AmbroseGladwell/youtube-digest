import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { spokenOpening } from "./spokenOpening.js";

const video = (overrides: Partial<ReturnType<typeof makeOverview>["video"]>) => ({
  ...makeOverview().video,
  title: "Bigger Arms",
  channel: "Lift Lab",
  ...overrides,
});

test("names the title, the channel and the month and year it was published", () => {
  assert.equal(
    spokenOpening(video({ publishedAt: "2024-03-09T12:00:00Z" })),
    "Bigger Arms, from Lift Lab, published in March 2024.",
  );
});

test("reads the month in UTC, the way the date was stored", () => {
  assert.equal(
    spokenOpening(video({ publishedAt: "2024-03-31T23:30:00Z" })),
    "Bigger Arms, from Lift Lab, published in March 2024.",
  );
});

test("leaves out what it does not know rather than guessing", () => {
  assert.equal(spokenOpening(video({ publishedAt: null })), "Bigger Arms, from Lift Lab.");
  assert.equal(
    spokenOpening(video({ channel: "", publishedAt: "2024-03-09T12:00:00Z" })),
    "Bigger Arms, published in March 2024.",
  );
  assert.equal(spokenOpening(video({ title: "", channel: "", publishedAt: null })), null);
});
