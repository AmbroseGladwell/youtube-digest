import { describe, expect, it } from "vitest";
import { madeWithProps } from "./madeWithProps.js";

describe("madeWithProps", () => {
  it("names the key, provider and model tried", () => {
    expect(madeWithProps({ key: "own", provider: "anthropic", model: "claude-sonnet-5-5" })).toEqual({
      key: "own",
      provider: "anthropic",
      model: "claude-sonnet-5-5",
    });
  });

  it("names nothing when no key was tried", () => {
    expect(madeWithProps(null)).toEqual({ key: undefined, provider: undefined, model: undefined });
  });

  it("keeps the key when our server didn't say its model", () => {
    expect(madeWithProps({ key: "trial", provider: undefined, model: undefined })).toEqual({
      key: "trial",
      provider: undefined,
      model: undefined,
    });
  });

  it("leaves out a model that isn't shaped like a provider's id", () => {
    expect(madeWithProps({ key: "own", provider: "openai", model: "my model, with spaces" }).model).toBeUndefined();
  });
});
