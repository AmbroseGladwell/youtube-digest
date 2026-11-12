import { describe, expect, it } from "vitest";
import { ModelRefusedError } from "@overview/generation";
import { ArticleReadError } from "../api/ArticleReadError.js";
import { ChosenModelFailedError } from "../api/ChosenModelFailedError.js";
import { runErrorOf } from "./runErrorOf.js";

describe("runErrorOf", () => {
  it("keeps the provider's response off a chosen model's failure, naming only provider and model", () => {
    const refused = new ModelRefusedError(400, '{"type":"error","error":{"message":"The compiled grammar is too large"}}');

    expect(runErrorOf(new ChosenModelFailedError("anthropic", "claude-haiku-5-5", refused))).toEqual({
      kind: "chosenModel",
      provider: "anthropic",
      model: "claude-haiku-5-5",
    });
  });

  it("shows any other failure by its message", () => {
    expect(runErrorOf(new Error("Add your Anthropic API key first."))).toEqual({
      kind: "message",
      message: "Add your Anthropic API key first.",
    });
  });

  it("gives an article our server fetched the failure and the link, so it can be said as a pasted link's is", () => {
    const blocked = new ArticleReadError({ status: "failed", reason: "blocked" });

    expect(runErrorOf(blocked, { url: "https://example.com/a", regenerating: true })).toEqual({
      kind: "articleFetch",
      failure: { status: "failed", reason: "blocked" },
      url: "https://example.com/a",
      regenerating: true,
    });
  });

  it("leaves a page read beside the panel to the panel's own words", () => {
    expect(runErrorOf(new ArticleReadError({ status: "failed", reason: "blocked" }))).toMatchObject({ kind: "message" });
  });
});
