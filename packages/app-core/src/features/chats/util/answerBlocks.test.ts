import { describe, expect, it } from "vitest";
import { answerBlocks, holdsCodeBlock } from "./answerBlocks.js";

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

  it("splits a list item's text around its fence, and says which items hold one (OV-372)", () => {
    const item = 'Ban explicit any:\n```js\nrules: {\n  "no-explicit-any": "error",\n}\n```\nThis flags `value: any`.';
    expect(answerBlocks(item)).toEqual([
      { kind: "paragraph", text: "Ban explicit any:" },
      { kind: "code", language: "js", code: 'rules: {\n  "no-explicit-any": "error",\n}' },
      { kind: "paragraph", text: "This flags `value: any`." },
    ]);
    expect(holdsCodeBlock(item)).toBe(true);
    expect(holdsCodeBlock("Use `useEffect` sparingly.")).toBe(false);
  });
});
