import { describe, expect, it } from "vitest";
import { answerBlocks } from "./answerBlocks.js";

describe("answerBlocks", () => {
  it("reads paragraphs a line each, and a fenced block whole with its lines and indentation", () => {
    expect(answerBlocks("First.\n\nRun this:\n```ts\nconst a = 1;\n  if (a) go();\n```\nThen done.")).toEqual([
      { kind: "paragraph", text: "First." },
      { kind: "paragraph", text: "Run this:" },
      { kind: "code", language: "ts", code: "const a = 1;\n  if (a) go();" },
      { kind: "paragraph", text: "Then done." },
    ]);
  });

  it("draws a fence still open as code, as the answer streams in", () => {
    expect(answerBlocks("Like so:\n```\nnpm i")).toEqual([
      { kind: "paragraph", text: "Like so:" },
      { kind: "code", language: "", code: "npm i" },
    ]);
  });
});
