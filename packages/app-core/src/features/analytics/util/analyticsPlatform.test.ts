import { describe, expect, it } from "vitest";
import { analyticsPlatform } from "./analyticsPlatform.js";

describe("analyticsPlatform", () => {
  it("prefers what the browser says in its client hints", () => {
    expect(analyticsPlatform({ userAgentData: { platform: "macOS" }, userAgent: "" })).toBe("macos");
    expect(analyticsPlatform({ userAgentData: { platform: "Chrome OS" } })).toBe("chromeos");
    expect(analyticsPlatform({ userAgentData: { platform: "Windows" } })).toBe("windows");
  });

  it("reads the user agent when there are no hints", () => {
    expect(analyticsPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36" })).toBe("android");
    expect(analyticsPlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe("ios");
    expect(analyticsPlatform({ userAgent: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)" })).toBe("chromeos");
    expect(analyticsPlatform({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)" })).toBe("linux");
  });

  it("says other rather than guess", () => {
    expect(analyticsPlatform({ userAgent: "curl/8.0" })).toBe("other");
    expect(analyticsPlatform(undefined)).toBe("other");
  });
});
