import { beforeEach, describe, expect, it } from "vitest";
import { applyAppearance } from "./applyAppearance.js";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-accent");
  document.head.innerHTML = '<link rel="icon" href="/favicon.svg" data-accent-href="/favicons/{accent}.svg">';
});

const favicon = () => document.querySelector("link")?.getAttribute("href");

describe("applyAppearance", () => {
  it("sets the overrides and swaps the favicon", () => {
    applyAppearance({ theme: "dark", accentColour: "teal" });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-accent")).toBe("teal");
    expect(favicon()).toBe("/favicons/teal.svg");
  });

  it("clears them again on System and Orange, favicon included", () => {
    applyAppearance({ theme: "dark", accentColour: "teal" });

    applyAppearance({ theme: "system", accentColour: "orange" });

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
    expect(favicon()).toBe("/favicons/orange.svg");
  });
});
