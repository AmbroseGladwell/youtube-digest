import { describe, expect, it } from "vitest";
import { INITIAL_SYNC_STATUS } from "@overview/sync";
import { signOutNoticeFor } from "./signOutNoticeFor.js";

describe("signOutNoticeFor", () => {
  it("has nothing to say when everything reached the account", () => {
    expect(signOutNoticeFor(INITIAL_SYNC_STATUS, true)).toBeNull();
  });

  it("counts what is still queued and what the server refused", () => {
    expect(signOutNoticeFor({ ...INITIAL_SYNC_STATUS, pending: 3, stuck: 1 }, true)).toEqual({
      pending: 3,
      stuck: 1,
      offline: false,
    });
  });

  it("knows the device was offline from the browser or from the last cycle", () => {
    expect(signOutNoticeFor({ ...INITIAL_SYNC_STATUS, pending: 2 }, false)?.offline).toBe(true);
    expect(signOutNoticeFor({ ...INITIAL_SYNC_STATUS, pending: 2, phase: "offline" }, true)?.offline).toBe(true);
  });
});
