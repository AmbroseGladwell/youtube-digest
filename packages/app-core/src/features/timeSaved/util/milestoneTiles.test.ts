import { describe, expect, it } from "vitest";
import { formatReachedOn, milestoneTiles, reachedCount, spokenTimeToGo, timeToGo } from "./milestoneTiles.js";

const TOTAL = 9 * 60 + 47;
const MARKS = {
  "30m": { crossedAt: "2026-08-02T09:00:00.000Z", dismissedAt: "2026-08-02T10:00:00.000Z" },
  "1h": { crossedAt: "2026-08-09T09:00:00.000Z", dismissedAt: null },
  "5h": { crossedAt: "2026-09-14T09:00:00.000Z", dismissedAt: null },
};

describe("milestoneTiles", () => {
  const tiles = milestoneTiles(MARKS, TOTAL);

  it("lists all ten, shortest first", () => {
    expect(tiles.map((tile) => tile.milestone.id)).toEqual(["30m", "1h", "5h", "10h", "15h", "20h", "30h", "50h", "75h", "100h"]);
  });

  it("dates every reached milestone, a dismissed one included", () => {
    expect(tiles.slice(0, 3)).toMatchObject([
      { state: "reached", reachedAt: "2026-08-02T09:00:00.000Z" },
      { state: "reached", reachedAt: "2026-08-09T09:00:00.000Z" },
      { state: "reached", reachedAt: "2026-09-14T09:00:00.000Z" },
    ]);
  });

  it("gives the next one how far it has to go, from the last one reached", () => {
    expect(tiles[3]).toMatchObject({ state: "next", toGo: 13, from: 300 });
  });

  it("leaves the rest quiet, with how long to go", () => {
    expect(tiles.slice(4).map((tile) => tile.state)).toEqual(Array(6).fill("ahead"));
    expect(tiles[4]).toMatchObject({ toGo: 5 * 60 + 13 });
  });

  it("counts a milestone the total reaches as reached before its crossing is recorded, without a date", () => {
    expect(milestoneTiles({}, 45)[0]).toEqual(expect.objectContaining({ state: "reached", reachedAt: null }));
  });

  it("does not count a crossed milestone the total no longer reaches", () => {
    expect(milestoneTiles(MARKS, 20)[0]).toMatchObject({ state: "next", toGo: 10, from: 0 });
  });

  it("has no next once all ten are reached", () => {
    expect(milestoneTiles({}, 100 * 60).every((tile) => tile.state === "reached")).toBe(true);
  });
});

describe("reachedCount", () => {
  it("counts the milestones the total reaches", () => {
    expect(reachedCount(TOTAL)).toBe(3);
    expect(reachedCount(0)).toBe(0);
  });
});

describe("timeToGo", () => {
  it("says minutes under an hour and hours and minutes after", () => {
    expect(timeToGo(13)).toBe("13 min to go");
    expect(timeToGo(5 * 60 + 13)).toBe("5h 13m to go");
    expect(spokenTimeToGo(5 * 60 + 13)).toBe("5 hours 13 minutes to go");
  });
});

describe("formatReachedOn", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  it("is the day and month this year, and carries the year before it", () => {
    expect(formatReachedOn("2026-09-14T09:00:00.000Z", now)).toBe("14 Sep");
    expect(formatReachedOn("2025-12-24T09:00:00.000Z", now)).toBe("24 Dec 2025");
  });
});
