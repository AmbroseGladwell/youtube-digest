import { describe, expect, it } from "vitest";
import { placeTip } from "./FloatingTip.js";

const box = (left: number, top: number, width: number, height: number) => new DOMRect(left, top, width, height);
const screen = { width: 390, height: 800 };

describe("placeTip", () => {
  it("sits below the element, lined up with its left edge", () => {
    expect(placeTip(box(40, 100, 120, 28), { width: 200, height: 40 }, screen)).toEqual({ top: 134, left: 40 });
  });

  it("moves left to stay on screen when the element is near the right edge", () => {
    expect(placeTip(box(300, 100, 80, 28), { width: 200, height: 40 }, screen)).toEqual({ top: 134, left: 182 });
  });

  it("never starts left of the gutter", () => {
    expect(placeTip(box(-20, 100, 80, 28), { width: 200, height: 40 }, screen).left).toBe(8);
  });

  it("goes above when there's no room below, and stays below when there's no room above either", () => {
    expect(placeTip(box(40, 740, 120, 28), { width: 200, height: 40 }, screen).top).toBe(694);
    expect(placeTip(box(40, 20, 120, 28), { width: 200, height: 790 }, screen).top).toBe(54);
  });
});
