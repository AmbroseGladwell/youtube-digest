import { describe, expect, it } from "vitest";
import { elapsedLabel } from "./elapsedLabel.js";

const START = 1_000_000;
const after = (seconds: number) => elapsedLabel(START, START + seconds * 1000);

describe("elapsedLabel", () => {
  it("starts at zero", () => {
    expect(after(0)).toBe("0:00");
  });

  it("pads the seconds so the label cannot change width mid-run", () => {
    expect(after(9)).toBe("0:09");
  });

  it("rolls over into minutes", () => {
    expect(after(72)).toBe("1:12");
  });

  it("keeps counting past ten minutes", () => {
    expect(after(671)).toBe("11:11");
  });

  // A run started before the page's clock was set, or on another machine's clock, must
  // not print a negative time on the pill.
  it("never counts backwards from a start in the future", () => {
    expect(elapsedLabel(START, START - 5000)).toBe("0:00");
  });
});
