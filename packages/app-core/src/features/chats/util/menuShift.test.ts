import { describe, expect, it } from "vitest";
import { menuShift } from "./menuShift.js";

const screen = { left: 0, right: 360 };

describe("menuShift", () => {
  it("opens from the button's start when there is room", () => {
    expect(menuShift({ left: 100, right: 140 }, 200, { left: 0, right: 800 }, "start")).toBe(0);
  });

  it("ends at the button's end when the end is preferred and fits", () => {
    expect(menuShift({ left: 600, right: 640 }, 200, { left: 0, right: 800 }, "end")).toBe(-160);
  });

  it("keeps a menu wider than the room on either side off the left edge", () => {
    expect(200 + menuShift({ left: 200, right: 240 }, 300, screen, "end")).toBe(16);
  });

  it("keeps a menu off the right edge", () => {
    expect(150 + menuShift({ left: 150, right: 190 }, 300, screen, "start") + 300).toBe(344);
  });

  it("keeps inside a clipping panel narrower than the screen", () => {
    expect(700 + menuShift({ left: 700, right: 740 }, 300, { left: 500, right: 900 }, "end")).toBe(516);
  });
});
