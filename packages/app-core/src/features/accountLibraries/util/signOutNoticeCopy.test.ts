import { describe, expect, it } from "vitest";
import { signOutNoticeCopy } from "./signOutNoticeCopy.js";

describe("signOutNoticeCopy", () => {
  it("says what will sync on the next sign-in in this browser (47d-2)", () => {
    expect(signOutNoticeCopy({ pending: 3, stuck: 1, offline: false }, "web")).toEqual({
      lead: "Signed out. 3 changes will sync when you sign back in on this browser.",
      then: null,
      stuck: "1 more couldn’t be sent and won’t retry on its own. You’ll see it in Account & sync when you sign in.",
    });
  });

  it("says the extension where the web app says this browser", () => {
    expect(signOutNoticeCopy({ pending: 3, stuck: 0, offline: false }, "extension").lead).toBe(
      "Signed out. 3 changes will sync when you sign back in to the extension.",
    );
  });

  it("leads with the reason when the device was offline (47d-3)", () => {
    expect(signOutNoticeCopy({ pending: 3, stuck: 0, offline: true }, "web")).toEqual({
      lead: "Signed out while offline. 3 changes haven’t synced to your account yet.",
      then: "They’ll sync next time you sign in on this browser.",
      stuck: null,
    });
  });

  it("counts one change as one", () => {
    expect(signOutNoticeCopy({ pending: 1, stuck: 0, offline: true }, "web")).toEqual({
      lead: "Signed out while offline. 1 change hasn’t synced to your account yet.",
      then: "It’ll sync next time you sign in on this browser.",
      stuck: null,
    });
  });

  it("names refused writes on their own when nothing else was waiting", () => {
    expect(signOutNoticeCopy({ pending: 0, stuck: 2, offline: false }, "web")).toEqual({
      lead: "Signed out.",
      then: null,
      stuck: "2 changes couldn’t be sent and won’t retry on their own. You’ll see them in Account & sync when you sign in.",
    });
  });
});
