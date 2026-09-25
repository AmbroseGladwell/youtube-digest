import { describe, expect, it } from "vitest";
import { captureReasonFromDraft } from "./captureReasonFromDraft.js";

describe("captureReasonFromDraft", () => {
  it("keeps what was typed, less the space around it", () => {
    expect(captureReasonFromDraft("  Does the capacity argument hold for the UK?  ")).toBe(
      "Does the capacity argument hold for the UK?",
    );
  });

  it("reads nothing typed as no reason rather than an empty one", () => {
    expect(captureReasonFromDraft("")).toBeNull();
    expect(captureReasonFromDraft("   ")).toBeNull();
  });
});
