import { describe, expect, it } from "vitest";
import { MAX_ERROR_FRAMES } from "@overview/domain";
import { parseStackFrames } from "./parseStackFrames.js";

describe("parseStackFrames", () => {
  it("reads Chrome's frames as a function and a path inside the bundle, never the page's address", () => {
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'title')",
      "    at ReaderPage (https://overview.example/assets/index-Bx3k9.js?v=dQw4w9WgXcQ#reader:12:3456)",
      "    at async Object.commit (chrome-extension://abcdefghijklmnop/assets/sidepanel-9f8e.js:1:200)",
      "    at https://overview.example/assets/vendor-77aa.js:3:10",
    ].join("\n");

    expect(parseStackFrames(stack)).toEqual([
      { function: "ReaderPage", file: "assets/index-Bx3k9.js", line: 12, column: 3456 },
      { function: "Object.commit", file: "assets/sidepanel-9f8e.js", line: 1, column: 200 },
      { function: "", file: "assets/vendor-77aa.js", line: 3, column: 10 },
    ]);
  });

  it("reads Firefox's and Safari's frames the same way", () => {
    const stack = "ReaderPage@https://overview.example/assets/index-Bx3k9.js:12:3456\n@https://overview.example/assets/index-Bx3k9.js:1:2";

    expect(parseStackFrames(stack)).toEqual([
      { function: "ReaderPage", file: "assets/index-Bx3k9.js", line: 12, column: 3456 },
      { function: "", file: "assets/index-Bx3k9.js", line: 1, column: 2 },
    ]);
  });

  it("drops frames with no address, and keeps no more than the most a report may carry", () => {
    const native = "    at Array.map (<anonymous>)\n    at native code";
    const many = Array.from({ length: MAX_ERROR_FRAMES + 5 }, (_, i) => `    at f${i} (https://o.example/a.js:${i + 1}:1)`).join("\n");

    expect(parseStackFrames(native)).toEqual([]);
    expect(parseStackFrames(many)).toHaveLength(MAX_ERROR_FRAMES);
    expect(parseStackFrames(undefined)).toEqual([]);
  });
});
