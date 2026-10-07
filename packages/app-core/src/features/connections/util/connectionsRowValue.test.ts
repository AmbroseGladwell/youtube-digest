import { describe, expect, it } from "vitest";
import { connectionsRowValue, type ConnectionsRowState } from "./connectionsRowValue.js";

const CONNECTED: ConnectionsRowState = { signedIn: true, accountUnreachable: false, count: 2, countFailed: false };

describe("connectionsRowValue", () => {
  it.each<[Partial<ConnectionsRowState>, string]>([
    [{ signedIn: false }, "Sign in first"],
    [{ accountUnreachable: true, count: undefined }, "Couldn't check"],
    [{ count: undefined }, "Checking…"],
    [{ count: undefined, countFailed: true }, "Couldn't check"],
    [{ count: 0 }, "None"],
    [{}, "2 connected"],
  ])("%j reads %s", (overrides, value) => {
    expect(connectionsRowValue({ ...CONNECTED, ...overrides })).toBe(value);
  });
});
