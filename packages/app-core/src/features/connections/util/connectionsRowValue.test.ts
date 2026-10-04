import { describe, expect, it } from "vitest";
import { connectionsRowValue, type ConnectionsRowState } from "./connectionsRowValue.js";

const PLUS: ConnectionsRowState = { signedIn: true, planStatus: "known", canConnect: true, count: 2, countFailed: false };

describe("connectionsRowValue", () => {
  it.each<[Partial<ConnectionsRowState>, string]>([
    [{ signedIn: false, planStatus: "known", canConnect: false }, "Sign in first"],
    [{ planStatus: "checking", canConnect: false, count: undefined }, "Checking…"],
    [{ planStatus: "unreachable", canConnect: false, count: undefined }, "Couldn't check"],
    [{ canConnect: false, count: undefined }, "Needs Plus"],
    [{ count: undefined }, "Checking…"],
    [{ count: undefined, countFailed: true }, "Couldn't check"],
    [{ count: 0 }, "None"],
    [{}, "2 connected"],
  ])("%j reads %s", (overrides, value) => {
    expect(connectionsRowValue({ ...PLUS, ...overrides })).toBe(value);
  });
});
