import { describe, expect, it } from "vitest";
import type { AppBuild } from "../../../app/AppBuildContext.js";
import { buildLabel } from "./buildLabel.js";

const makeBuild = (overrides: Partial<AppBuild> = {}): AppBuild => ({
  version: "0.1.0",
  commit: "30bb95a",
  dirty: false,
  ...overrides,
});

describe("buildLabel", () => {
  it("reads the version with the commit it was built from in brackets", () => {
    expect(buildLabel(makeBuild())).toBe("Version 0.1.0 (30bb95a)");
  });

  it("says when the build carried uncommitted changes", () => {
    expect(buildLabel(makeBuild({ dirty: true }))).toBe("Version 0.1.0 (30bb95a, uncommitted changes)");
  });

  it("is the version alone for a build that was not told its commit", () => {
    expect(buildLabel(makeBuild({ commit: null }))).toBe("Version 0.1.0");
  });
});
