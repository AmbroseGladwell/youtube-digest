import { describe, expect, it } from "vitest";
import { accentToolbarIconPaths } from "./accentToolbarIcon.js";

describe("accentToolbarIconPaths", () => {
  it("is the manifest's own icons for Orange", () => {
    expect(accentToolbarIconPaths("orange")).toEqual({ "16": "icons/icon16.png", "32": "icons/icon32.png" });
  });

  it("is the accent's own folder for the rest", () => {
    expect(accentToolbarIconPaths("teal")).toEqual({
      "16": "icons/accents/teal/icon16.png",
      "32": "icons/accents/teal/icon32.png",
    });
  });
});
