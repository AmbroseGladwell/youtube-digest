import { describe, expect, it } from "vitest";
import { fittingChipCount } from "./fittingChipCount.js";

describe("fittingChipCount", () => {
  it("keeps every chip that fits, with no +N needed", () => {
    expect(fittingChipCount([185, 114], 358, 44, 8)).toBe(2);
  });

  it("leaves room for the +N chip, and never cuts a chip short", () => {
    expect(fittingChipCount([185, 114, 118], 360, 44, 8)).toBe(2);
    expect(fittingChipCount([185, 114, 118], 328, 44, 8)).toBe(1);
  });

  it("can fit none when even the first chip and +N do not", () => {
    expect(fittingChipCount([300, 114], 200, 44, 8)).toBe(0);
  });
});
