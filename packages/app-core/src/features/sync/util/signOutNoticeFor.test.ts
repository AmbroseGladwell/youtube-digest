import { describe, expect, it } from "vitest";
import { INITIAL_SYNC_STATUS } from "@overview/sync";
import { signOutNoticeFor } from "./signOutNoticeFor.js";
import { signOutOutcomeOf } from "./signOutOutcomeOf.js";

const ONLINE = { online: true, timedOut: false };

describe("signOutOutcomeOf", () => {
  it("counts what is still queued and what the server refused", () => {
    expect(signOutOutcomeOf({ ...INITIAL_SYNC_STATUS, pending: 3, stuck: 1 }, ONLINE)).toEqual({
      pending: 3,
      stuck: 1,
      offline: false,
      timedOut: false,
    });
  });

  it("knows the device was offline from the browser or from the last cycle", () => {
    expect(signOutOutcomeOf(INITIAL_SYNC_STATUS, { online: false, timedOut: false }).offline).toBe(true);
    expect(signOutOutcomeOf({ ...INITIAL_SYNC_STATUS, phase: "offline" }, ONLINE).offline).toBe(true);
  });

  it("says when the last cycle was given up on", () => {
    expect(signOutOutcomeOf(INITIAL_SYNC_STATUS, { online: true, timedOut: true }).timedOut).toBe(true);
  });
});

describe("signOutNoticeFor", () => {
  it("has nothing to say when everything reached the account", () => {
    expect(signOutNoticeFor(signOutOutcomeOf(INITIAL_SYNC_STATUS, ONLINE))).toBeNull();
  });

  it("keeps what the reader is told: the counts and whether the device was offline", () => {
    expect(signOutNoticeFor({ pending: 2, stuck: 0, offline: true, timedOut: false })).toEqual({
      pending: 2,
      stuck: 0,
      offline: true,
    });
  });
});
