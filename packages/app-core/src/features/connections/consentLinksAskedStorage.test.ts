import { beforeEach, describe, expect, it } from "vitest";
import { rememberConsentLinkAsked, wasConsentLinkAskedHere } from "./consentLinksAskedStorage.js";

const HOUR_MS = 60 * 60 * 1000;

describe("consentLinksAskedStorage", () => {
  beforeEach(() => localStorage.clear());

  it("knows a request this browser asked a link for, and no other", () => {
    rememberConsentLinkAsked("a", 0);
    expect(wasConsentLinkAskedHere("a")).toBe(true);
    expect(wasConsentLinkAskedHere("b")).toBe(false);
  });

  it("forgets requests long past their half hour when it next remembers one", () => {
    rememberConsentLinkAsked("old", 0);
    rememberConsentLinkAsked("new", HOUR_MS + 1);
    expect(wasConsentLinkAskedHere("old")).toBe(false);
    expect(wasConsentLinkAskedHere("new")).toBe(true);
  });

  it("reads anything unreadable as nothing asked", () => {
    localStorage.setItem("overview.consentLinksAsked.v1", "{not json");
    expect(wasConsentLinkAskedHere("a")).toBe(false);
  });
});

describe("consentLinksAskedStorage, when the browser refuses storage", () => {
  const refusing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  } as unknown as Storage;

  it("remembers nothing and says nothing was asked, without throwing", () => {
    expect(() => rememberConsentLinkAsked("a", 0, refusing)).not.toThrow();
    expect(wasConsentLinkAskedHere("a", refusing)).toBe(false);
  });
});
