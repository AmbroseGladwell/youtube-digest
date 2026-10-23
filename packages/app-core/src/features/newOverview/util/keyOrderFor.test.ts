import { describe, expect, it } from "vitest";
import { keyOrderFor } from "./keyOrderFor.js";

const context = { ourKeyUsable: true, plan: "free" as const, hasOwnKey: true, onlyMyKey: false };

describe("keyOrderFor", () => {
  it("tries the reader's own key first and ours after it, on Free and BYO Plus", () => {
    expect(keyOrderFor(context)).toEqual(["own", "ours"]);
    expect(keyOrderFor({ ...context, plan: "byo-plus" })).toEqual(["own", "ours"]);
  });

  it("tries ours first on Plus, because that is what Plus pays for", () => {
    expect(keyOrderFor({ ...context, plan: "plus" })).toEqual(["ours", "own"]);
  });

  it("uses ours alone for a reader with no key of their own", () => {
    expect(keyOrderFor({ ...context, hasOwnKey: false })).toEqual(["ours"]);
  });

  it("never falls back with Only ever use my key on, on any plan", () => {
    expect(keyOrderFor({ ...context, onlyMyKey: true })).toEqual(["own"]);
    expect(keyOrderFor({ ...context, plan: "plus", onlyMyKey: true })).toEqual(["own"]);
  });

  it("uses the reader's key alone where our key can't be used, and nothing with no key either", () => {
    expect(keyOrderFor({ ...context, ourKeyUsable: false })).toEqual(["own"]);
    expect(keyOrderFor({ ...context, ourKeyUsable: false, hasOwnKey: false })).toEqual([]);
  });
});
