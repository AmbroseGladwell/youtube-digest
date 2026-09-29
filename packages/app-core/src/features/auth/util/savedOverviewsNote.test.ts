import { describe, expect, it } from "vitest";
import { savedOverviewsNote } from "./savedOverviewsNote.js";

describe("savedOverviewsNote", () => {
  it("says how many overviews in this browser signing in adds, and where they will be", () => {
    expect(savedOverviewsNote(31, "signIn", "browser")).toBe(
      "Signing in adds the 31 overviews saved in this browser to your account, so they're there on your phone, in the extension and on any other device.",
    );
  });

  it("says the overviews come along when creating an account", () => {
    expect(savedOverviewsNote(12, "createAccount", "extension")).toBe(
      "The 12 overviews saved in the extension come with you.",
    );
  });

  it("speaks of one overview as one", () => {
    expect(savedOverviewsNote(1, "signIn", "phone")).toBe(
      "Signing in adds the overview saved on this phone to your account.",
    );
    expect(savedOverviewsNote(1, "createAccount", "phone")).toBe("The overview saved on this phone comes with you.");
  });

  it("says nothing about an empty library", () => {
    expect(savedOverviewsNote(0, "signIn", "browser")).toBeNull();
  });
});
