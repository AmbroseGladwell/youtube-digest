import { useSyncExternalStore } from "react";
import { Routes } from "../app/Routes.js";

export type NavigationDirection = "forward" | "back" | "none";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Reduced motion is checked here because global.scss's `*` rule never reaches ::view-transition-*.
export const shouldAnimateNavigation = (): boolean => {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    !globalThis.matchMedia(REDUCED_MOTION_QUERY).matches
  );
};

const subscribeToReducedMotion = (onChange: () => void): (() => void) => {
  const query = globalThis.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export const useShouldAnimateNavigation = (): boolean => {
  return useSyncExternalStore(subscribeToReducedMotion, shouldAnimateNavigation, () => false);
};

const isSettingsSection = (path: string) => path.startsWith(`${Routes.settings()}/`);

// The top-level pages in the order the navigation lists them, so a slide between two goes their way.
const TOP_LEVEL_PAGES = [Routes.home(), Routes.projects(), Routes.ask()];

export const navigationDirection = (from: string, to: string): NavigationDirection => {
  if (from === to || (isSettingsSection(from) && isSettingsSection(to))) {
    return "none";
  }
  const fromPage = TOP_LEVEL_PAGES.indexOf(from);
  const toPage = TOP_LEVEL_PAGES.indexOf(to);
  if (fromPage !== -1 && toPage !== -1) {
    return toPage < fromPage ? "back" : "forward";
  }
  return to === Routes.home() || from.startsWith(`${to}/`) ? "back" : "forward";
};
