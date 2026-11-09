import { describe, expect, it } from "vitest";
import { EMPTY_HISTORY_TRAIL, advanceHistoryTrail, previousPathname, type HistoryMove, type HistoryTrail } from "./historyTrail.js";

const walk = (steps: Array<[HistoryMove, string, string]>): HistoryTrail =>
  steps.reduce((trail, [type, key, pathname]) => advanceHistoryTrail(trail, type, { key, pathname }), EMPTY_HISTORY_TRAIL);

describe("advanceHistoryTrail", () => {
  it("has nothing behind the first location", () => {
    expect(previousPathname(walk([["POP", "a", "/"]]))).toBeNull();
  });

  it("puts the library behind an overview pushed from it", () => {
    expect(
      previousPathname(
        walk([
          ["POP", "a", "/"],
          ["PUSH", "b", "/overview/1"],
        ]),
      ),
    ).toBe("/");
  });

  it("puts the first overview behind the next one stepped to, not the library", () => {
    const trail = walk([
      ["POP", "a", "/"],
      ["PUSH", "b", "/overview/1"],
      ["PUSH", "c", "/overview/2"],
    ]);
    expect(previousPathname(trail)).toBe("/overview/1");
  });

  it("finds the library behind the first overview again after stepping back to it", () => {
    const trail = walk([
      ["POP", "a", "/"],
      ["PUSH", "b", "/overview/1"],
      ["PUSH", "c", "/overview/2"],
      ["POP", "b", "/overview/1"],
    ]);
    expect(previousPathname(trail)).toBe("/");
  });

  it("drops what lay ahead once a new push forks the trail", () => {
    const trail = walk([
      ["POP", "a", "/"],
      ["PUSH", "b", "/overview/1"],
      ["POP", "a", "/"],
      ["PUSH", "c", "/overview/2"],
    ]);
    expect(trail.entries.map(({ key }) => key)).toEqual(["a", "c"]);
    expect(previousPathname(trail)).toBe("/");
  });

  it("keeps what lies behind a replaced location", () => {
    const trail = walk([
      ["POP", "a", "/"],
      ["PUSH", "b", "/overview/1"],
      ["REPLACE", "c", "/overview/9"],
    ]);
    expect(trail.entries.map(({ pathname }) => pathname)).toEqual(["/", "/overview/9"]);
    expect(previousPathname(trail)).toBe("/");
  });

  it("appends a popped location it has never seen, such as one from before a reload", () => {
    const trail = walk([
      ["POP", "a", "/overview/1"],
      ["POP", "z", "/"],
    ]);
    expect(trail.index).toBe(1);
    expect(previousPathname(trail)).toBe("/overview/1");
  });

  it("treats a replace of nothing as the first location", () => {
    expect(walk([["REPLACE", "a", "/"]])).toEqual({ entries: [{ key: "a", pathname: "/" }], index: 0 });
  });
});
