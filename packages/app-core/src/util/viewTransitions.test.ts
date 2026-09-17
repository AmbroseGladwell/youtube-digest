import { afterEach, describe, expect, it, vi } from "vitest";
import { Routes } from "../app/Routes.js";
import { navigationDirection, shouldAnimateNavigation } from "./viewTransitions.js";

const OVERVIEW = Routes.overview("abc");

function stubEnvironment({
  supported,
  reducedMotion,
}: {
  supported: boolean;
  reducedMotion: boolean;
}) {
  if (supported) {
    vi.stubGlobal("document", { ...globalThis.document, startViewTransition: () => undefined });
  } else {
    vi.stubGlobal("document", { ...globalThis.document });
  }
  vi.stubGlobal("matchMedia", () => ({ matches: reducedMotion }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// This module is the single thing that can silently disable every navigation animation in
// the app, which is why it is unit tested rather than left to the browser tiers
// (docs/conventions/frontend-testing-guide.md's choice rule, point 2).
describe("shouldAnimateNavigation", () => {
  it("animates only when the browser has the API and motion is not reduced", () => {
    stubEnvironment({ supported: true, reducedMotion: false });

    expect(shouldAnimateNavigation()).toBe(true);
  });

  it("refuses when the reader has asked for reduced motion", () => {
    stubEnvironment({ supported: true, reducedMotion: true });

    expect(shouldAnimateNavigation()).toBe(false);
  });

  it("refuses on a browser without the API rather than throwing", () => {
    stubEnvironment({ supported: false, reducedMotion: false });

    expect(shouldAnimateNavigation()).toBe(false);
  });
});

describe("navigationDirection", () => {
  it("treats the library as the only place you come back to", () => {
    expect(navigationDirection(OVERVIEW, Routes.home())).toBe("back");
    expect(navigationDirection(Routes.settings(), Routes.home())).toBe("back");
  });

  it("treats everywhere else as somewhere you go", () => {
    expect(navigationDirection(Routes.home(), OVERVIEW)).toBe("forward");
    expect(navigationDirection(Routes.home(), Routes.settings())).toBe("forward");
    expect(navigationDirection(OVERVIEW, Routes.overview("def"))).toBe("forward");
  });

  it("has no direction for a navigation that doesn't move", () => {
    expect(navigationDirection(Routes.home(), Routes.home())).toBe("none");
  });
});
