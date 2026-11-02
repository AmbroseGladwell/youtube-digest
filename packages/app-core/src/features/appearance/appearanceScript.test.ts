import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ACCENT_COLOURS } from "@overview/domain";
import { beforeEach, describe, expect, it } from "vitest";

const publicFile = (shell: "extension" | "web", path: string) =>
  join(process.cwd(), "..", "..", "apps", shell, "public", path);

const script = readFileSync(publicFile("extension", "appearance.js"), "utf8");

const run = (saved: string | null) => {
  localStorage.clear();
  if (saved !== null) localStorage.setItem("overview.appearance.v1", saved);
  new Function(script)();
};

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-accent");
  document.head.innerHTML = '<link rel="icon" href="/icons/icon.svg" data-accent-href="/icons/accents/{accent}/icon.svg">';
});

describe("the script that runs before first paint", () => {
  it("is the same file in both shells", () => {
    expect(readFileSync(publicFile("web", "appearance.js"), "utf8")).toBe(script);
  });

  it("knows every accent", () => {
    for (const accentColour of ACCENT_COLOURS) expect(script).toContain(`"${accentColour}"`);
  });

  it("sets the saved theme, accent and favicon", () => {
    run(JSON.stringify({ theme: "dark", accentColour: "violet" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-accent")).toBe("violet");
    expect(document.querySelector("link")?.getAttribute("href")).toBe("/icons/accents/violet/icon.svg");
  });

  it("leaves Orange and System to the stylesheet's defaults", () => {
    run(JSON.stringify({ theme: "system", accentColour: "orange" }));

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
    expect(document.querySelector("link")?.getAttribute("href")).toBe("/icons/icon.svg");
  });

  it("ignores what it doesn't recognise", () => {
    run(JSON.stringify({ theme: "sepia", accentColour: "plum" }));

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.hasAttribute("data-accent")).toBe(false);
  });

  it("survives nothing saved, and something unreadable", () => {
    expect(() => run(null)).not.toThrow();
    expect(() => run("{")).not.toThrow();
  });
});

describe("the icons each accent needs", () => {
  it.each(ACCENT_COLOURS)("are shipped for %s", (accentColour) => {
    expect(existsSync(publicFile("web", `favicons/${accentColour}.svg`))).toBe(true);
    expect(existsSync(publicFile("extension", `icons/accents/${accentColour}/icon.svg`))).toBe(true);
  });

  it.each(ACCENT_COLOURS.slice(1))("includes the toolbar's two sizes for %s", (accentColour) => {
    expect(existsSync(publicFile("extension", `icons/accents/${accentColour}/icon16.png`))).toBe(true);
    expect(existsSync(publicFile("extension", `icons/accents/${accentColour}/icon32.png`))).toBe(true);
  });
});
