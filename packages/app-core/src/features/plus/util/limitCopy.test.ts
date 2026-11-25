import { describe, expect, it } from "vitest";
import { limitCopy } from "./limitCopy.js";

const HOUR = 3600;
const RESETS_ON = "2026-12-01";

describe("limitCopy", () => {
  it("says the month's hours are used, what the episode needs and what Plus gives (351g)", () => {
    expect(
      limitCopy.hours({ plan: "free", resetsOn: RESETS_ON, usedSeconds: 5 * HOUR, limitSeconds: 5 * HOUR, episodeSeconds: 72 * 60 }),
    ).toEqual({
      heading: "You’ve used this month’s 5 hours of transcribing.",
      body: "This episode needs about 1 hr 12 min of it. Your hours come back on 1 December.",
      plusLine: "30 hours of transcribing a month, and 50 overviews on us. From £7.99 a month, cancel anytime.",
      waitTitle: "Wait for 1 December",
      waitBody: "We’ll keep this link and transcribe it when your hours are back.",
    });
  });

  it("says when what's left is too little for this episode", () => {
    const copy = limitCopy.hours({
      plan: "byo-plus",
      resetsOn: RESETS_ON,
      usedSeconds: 14 * HOUR,
      limitSeconds: 15 * HOUR,
      episodeSeconds: 2 * HOUR,
    });
    expect(copy.heading).toBe("You have 1 hr of transcribing left, and this episode needs about 2 hr.");
    expect(copy.body).toBe("Your hours come back on 1 December.");
  });

  it("offers a Plus reader only the wait", () => {
    expect(
      limitCopy.hours({ plan: "plus", resetsOn: RESETS_ON, usedSeconds: 30 * HOUR, limitSeconds: 30 * HOUR, episodeSeconds: null })
        .plusLine,
    ).toBeNull();
    expect(limitCopy.chat("plus", RESETS_ON).plusLine).toBeNull();
    expect(limitCopy.saves("plus", RESETS_ON).plusLine).toBeNull();
  });

  it("weighs chat against the reader's own allowance (351h)", () => {
    expect(limitCopy.chat("free", RESETS_ON).plusLine).toBe(
      "About 1,000 questions a month, against 100. From £7.99 a month, cancel anytime.",
    );
    expect(limitCopy.chat("byo-plus", RESETS_ON).plusLine).toBe(
      "About 1,000 questions a month, against 500. From £7.99 a month, cancel anytime.",
    );
  });

  it("counts BYO Plus's saves as Free's (351i)", () => {
    expect(limitCopy.saves("byo-plus", RESETS_ON).heading).toBe("You’ve saved 50 this month without an overview.");
    expect(limitCopy.saves("free", RESETS_ON).waitBody).toBe("Save this link then, or paste it again when your 5 overviews are back.");
  });
});
