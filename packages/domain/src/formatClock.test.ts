import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatClock } from "./formatClock.js";

describe("formatClock", () => {
  it("pads the seconds and drops the hour when there isn't one", () => {
    assert.equal(formatClock(0), "0:00");
    assert.equal(formatClock(9), "0:09");
    assert.equal(formatClock(698), "11:38");
  });

  it("shows hours once past one, padding the minutes", () => {
    assert.equal(formatClock(3661), "1:01:01");
  });

  it("never renders a negative clock", () => {
    assert.equal(formatClock(-5), "0:00");
  });
});
