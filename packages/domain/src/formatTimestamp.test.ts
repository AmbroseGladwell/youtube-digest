import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTimestamp } from "./formatTimestamp.js";

describe("formatTimestamp", () => {
  it("formats a millisecond offset as a clock", () => {
    assert.equal(formatTimestamp(0), "0:00");
    assert.equal(formatTimestamp(135_000), "2:15");
    assert.equal(formatTimestamp(3_661_000), "1:01:01");
  });

  it("floors sub-second precision rather than rounding past the moment", () => {
    assert.equal(formatTimestamp(1_999), "0:01");
  });
});
