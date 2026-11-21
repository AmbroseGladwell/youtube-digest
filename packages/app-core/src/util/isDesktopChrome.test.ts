import { describe, expect, it } from "vitest";
import { isDesktopChrome } from "./isDesktopChrome.js";

const chrome = [{ brand: "Chromium" }, { brand: "Google Chrome" }, { brand: "Not_A Brand" }];

describe("isDesktopChrome", () => {
  it("is true for Google Chrome on a desktop", () => {
    expect(isDesktopChrome({ userAgentData: { brands: chrome, mobile: false } })).toBe(true);
  });

  it("is false for Chrome on a phone", () => {
    expect(isDesktopChrome({ userAgentData: { brands: chrome, mobile: true } })).toBe(false);
  });

  it("is false for other Chromium browsers", () => {
    expect(isDesktopChrome({ userAgentData: { brands: [{ brand: "Chromium" }, { brand: "Microsoft Edge" }], mobile: false } })).toBe(false);
  });

  it("is false where the browser gives no client hints, as Safari and Firefox don't", () => {
    expect(isDesktopChrome({})).toBe(false);
    expect(isDesktopChrome(undefined)).toBe(false);
    expect(isDesktopChrome({ userAgentData: { brands: chrome } })).toBe(false);
  });
});
