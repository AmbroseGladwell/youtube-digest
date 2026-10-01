import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyticsPlatform } from "./analyticsPlatform.js";

describe("analyticsPlatform", () => {
  it("prefers what the browser says in its client hints", () => {
    assert.equal(analyticsPlatform({ userAgentData: { platform: "macOS" }, userAgent: "" }), "macos");
    assert.equal(analyticsPlatform({ userAgentData: { platform: "Chrome OS" } }), "chromeos");
    assert.equal(analyticsPlatform({ userAgentData: { platform: "Windows" } }), "windows");
  });

  it("reads the user agent when there are no hints", () => {
    assert.equal(analyticsPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36" }), "android");
    assert.equal(analyticsPlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }), "ios");
    assert.equal(analyticsPlatform({ userAgent: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)" }), "chromeos");
    assert.equal(analyticsPlatform({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)" }), "linux");
  });

  it("says other rather than guess", () => {
    assert.equal(analyticsPlatform({ userAgent: "curl/8.0" }), "other");
    assert.equal(analyticsPlatform(undefined), "other");
  });
});
