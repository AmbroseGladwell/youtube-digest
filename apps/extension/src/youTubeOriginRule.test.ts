import { beforeAll, describe, expect, it } from "vitest";
import { youTubeOriginRule } from "./youTubeOriginRule.js";

// The rule is read by Chrome, not by us, so what is worth holding is its scope: it strips
// a request header, and must reach nothing but our own calls to YouTube.
beforeAll(() => {
  globalThis.chrome = {
    declarativeNetRequest: {
      RuleActionType: { MODIFY_HEADERS: "modifyHeaders" },
      HeaderOperation: { REMOVE: "remove" },
      ResourceType: { XMLHTTPREQUEST: "xmlhttprequest" },
    },
  } as unknown as typeof chrome;
});

describe("youTubeOriginRule", () => {
  it("removes the Origin header YouTube answers 403 to", () => {
    const rule = youTubeOriginRule("abcdefghijklmnopabcdefghijklmnop");

    expect(rule.action.type).toBe("modifyHeaders");
    expect(rule.action.requestHeaders).toEqual([{ header: "origin", operation: "remove" }]);
  });

  it("reaches only this extension's own requests, never another's", () => {
    const rule = youTubeOriginRule("abcdefghijklmnopabcdefghijklmnop");

    expect(rule.condition.initiatorDomains).toEqual(["abcdefghijklmnopabcdefghijklmnop"]);
  });

  it("reaches only YouTube, so the panel's Anthropic calls keep their own headers", () => {
    const rule = youTubeOriginRule("abcdefghijklmnopabcdefghijklmnop");

    expect(rule.condition.requestDomains).toEqual(["youtube.com"]);
    expect(rule.condition.requestDomains).not.toContain("api.anthropic.com");
  });
});
