import { describe, expect, it } from "vitest";
import { madeOnLine } from "./madeOnLine.js";

describe("madeOnLine", () => {
  it("says nothing for an overview the first key made, or one from before keys were recorded", () => {
    expect(madeOnLine(null)).toBeNull();
    expect(madeOnLine({ key: "own", fallback: null })).toBeNull();
    expect(madeOnLine({ key: "ours", fallback: null })).toBeNull();
  });

  it("names the reader's key and why it was passed over when ours made it", () => {
    expect(madeOnLine({ key: "ours", fallback: { from: "own", provider: "anthropic", cause: "out-of-credit" } })).toBe(
      "On us: your Anthropic key was out of credit",
    );
    expect(madeOnLine({ key: "ours", fallback: { from: "own", provider: "openai", cause: "provider-down" } })).toBe(
      "On us: OpenAI wasn’t answering",
    );
  });

  it("names the reader's key when it made a Plus overview our key couldn't", () => {
    expect(madeOnLine({ key: "own", fallback: { from: "ours", provider: "anthropic", cause: "quota-spent" } })).toBe(
      "Made on your Anthropic key: you’d made this month’s overviews on us",
    );
    expect(madeOnLine({ key: "own", fallback: { from: "ours", provider: "gemini", cause: "busy" } })).toBe(
      "Made on your Gemini key: we’d made all we can today",
    );
  });
});
