import { describe, expect, it } from "vitest";
import { shareStatusLine } from "./shareStatusLine.js";

describe("shareStatusLine", () => {
  it("reads the design's line: when it was shared, and how often it has been opened", () => {
    expect(shareStatusLine("2026-08-04T11:00:00.000Z", 12)).toBe("Shared 4 Aug · 12 views");
  });

  it("counts one view as one, rather than 1 views", () => {
    expect(shareStatusLine("2026-08-04T11:00:00.000Z", 1)).toBe("Shared 4 Aug · 1 view");
  });

  it("says nobody has opened it yet rather than leaving the count off", () => {
    expect(shareStatusLine("2026-08-04T11:00:00.000Z", 0)).toBe("Shared 4 Aug · 0 views");
  });

  it("abbreviates September to four letters, as the saved date beside it does", () => {
    expect(shareStatusLine("2026-09-30T11:00:00.000Z", 3)).toBe("Shared 30 Sept · 3 views");
  });
});
