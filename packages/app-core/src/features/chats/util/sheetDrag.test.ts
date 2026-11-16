import { describe, expect, it } from "vitest";
import { resistedOffset, restAfterDrag } from "./sheetDrag.js";

describe("resistedOffset", () => {
  it("follows the finger between the rests", () => {
    expect(resistedOffset(120, 500)).toBe(120);
  });

  it("resists past either end", () => {
    expect(resistedOffset(-100, 500)).toBeCloseTo(-(100 ** 0.7));
    expect(resistedOffset(600, 500)).toBeCloseTo(500 + 100 ** 0.7);
  });
});

describe("restAfterDrag", () => {
  it("springs to the nearer rest", () => {
    expect(restAfterDrag(200, 500, 0)).toBe("raised");
    expect(restAfterDrag(300, 500, 0)).toBe("lowered");
  });

  it("lets a flick win over where the sheet was let go", () => {
    expect(restAfterDrag(50, 500, 0.8)).toBe("lowered");
    expect(restAfterDrag(450, 500, -0.8)).toBe("raised");
  });
});
