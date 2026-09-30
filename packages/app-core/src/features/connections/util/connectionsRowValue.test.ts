import { describe, expect, it } from "vitest";
import { connectionsRowValue } from "./connectionsRowValue.js";

describe("connectionsRowValue", () => {
  it.each([
    [{ signedIn: false, isPlus: false, count: undefined }, "Sign in first"],
    [{ signedIn: true, isPlus: false, count: undefined }, "Needs Plus"],
    [{ signedIn: true, isPlus: true, count: undefined }, "Plus"],
    [{ signedIn: true, isPlus: true, count: 0 }, "None"],
    [{ signedIn: true, isPlus: true, count: 2 }, "2 connected"],
  ])("%j reads %s", (state, value) => {
    expect(connectionsRowValue(state)).toBe(value);
  });
});
