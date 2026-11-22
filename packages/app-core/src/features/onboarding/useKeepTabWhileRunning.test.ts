import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WaitPhase } from "./util/waitTimeline.js";
import { useKeepTabWhileRunning } from "./useKeepTabWhileRunning.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Probe = ({ phase, title }: { phase: WaitPhase; title: string }) => {
  useKeepTabWhileRunning(phase, title);
  return null;
};

const unloadIsHeld = (): boolean => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("useKeepTabWhileRunning", () => {
  let root: Root;

  beforeEach(() => {
    document.title = "The Overview";
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  const render = (phase: WaitPhase) => act(() => root.render(createElement(Probe, { phase, title: "Marathon training for beginners" })));

  it("asks before the tab closes only while the run is going", () => {
    render("running");
    expect(unloadIsHeld()).toBe(true);
    render("ready");
    expect(unloadIsHeld()).toBe(false);
  });

  it("doesn't hold a failed run open", () => {
    render("failed");
    expect(unloadIsHeld()).toBe(false);
  });

  it("names the tab ready once it is, and puts the title back after", () => {
    render("running");
    expect(document.title).toBe("The Overview");
    render("ready");
    expect(document.title).toBe("Ready: Marathon training for beginners");
    act(() => root.unmount());
    expect(document.title).toBe("The Overview");
    root = createRoot(document.createElement("div"));
  });
});
