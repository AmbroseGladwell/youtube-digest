import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

    assert.deepEqual(parseStackFrames(stack), [
      { function: "ReaderPage", file: "assets/index-Bx3k9.js", line: 12, column: 3456 },
      { function: "Object.commit", file: "assets/sidepanel-9f8e.js", line: 1, column: 200 },
      { function: "", file: "assets/vendor-77aa.js", line: 3, column: 10 },
    ]);
  });

  it("reads Firefox's and Safari's frames the same way", () => {
    const stack = "ReaderPage@https://overview.example/assets/index-Bx3k9.js:12:3456\n@https://overview.example/assets/index-Bx3k9.js:1:2";

    assert.deepEqual(parseStackFrames(stack), [
      { function: "ReaderPage", file: "assets/index-Bx3k9.js", line: 12, column: 3456 },
      { function: "", file: "assets/index-Bx3k9.js", line: 1, column: 2 },
    ]);
  });

  it("drops frames with no address, and keeps no more than the most a report may carry", () => {
    const native = "    at Array.map (<anonymous>)\n    at native code";
    const many = Array.from({ length: MAX_ERROR_FRAMES + 5 }, (_, i) => `    at f${i} (https://o.example/a.js:${i + 1}:1)`).join("\n");

    assert.deepEqual(parseStackFrames(native), []);
    assert.equal(parseStackFrames(many).length, MAX_ERROR_FRAMES);
    assert.deepEqual(parseStackFrames(undefined), []);
  });

  it("gives each frame the chunk id PostHog's CLI injected into its file, so its source map can be found", () => {
    const chunkIds = {
      "Error\n    at https://overview.example/assets/index-Bx3k9.js:1:120\n    at https://overview.example/assets/index-Bx3k9.js:1:900":
        "0e9b3c7a-5d1f-52a8-b6c4-e2d0f8a17593",
      "Error\n    at chrome-extension://abcdefghijklmnop/chunks/app-9f8e.js:1:80": "7c1d2e3f-4a5b-5c6d-8e7f-a1b2c3d4e5f6",
    };
    const stack = [
      "TypeError: boom",
      "    at ReaderPage (https://overview.example/assets/index-Bx3k9.js:12:3456)",
      "    at commit (chrome-extension://abcdefghijklmnop/chunks/app-9f8e.js:1:200)",
      "    at https://overview.example/assets/vendor-77aa.js:3:10",
    ].join("\n");

    assert.deepEqual(
      parseStackFrames(stack, chunkIds).map(({ file, chunkId }) => ({ file, chunkId })),
      [
        { file: "assets/index-Bx3k9.js", chunkId: "0e9b3c7a-5d1f-52a8-b6c4-e2d0f8a17593" },
        { file: "chunks/app-9f8e.js", chunkId: "7c1d2e3f-4a5b-5c6d-8e7f-a1b2c3d4e5f6" },
        { file: "assets/vendor-77aa.js", chunkId: undefined },
      ],
    );
  });

  it("leaves chunk ids off when the build was never injected", () => {
    assert.deepEqual(parseStackFrames("    at f (https://o.example/a.js:1:1)", undefined), [
      { function: "f", file: "a.js", line: 1, column: 1 },
    ]);
  });
});
