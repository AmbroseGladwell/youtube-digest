import { useSyncExternalStore } from "react";
import { Routes } from "../app/Routes.js";

export type NavigationDirection = "forward" | "back" | "none";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// The one gate that answers "should we animate this navigation?"
// (docs/conventions/frontend-architecture-guide.md 2.2). The guide asks for a viewport
// check alongside these two; this app doesn't carry one, because the gate exists to keep
// full-screen push transitions off phones and design 9c's travel is 10px — see
// docs/features/overview-redesign.md, "The small movements".
//
// The reduced-motion check has to be here rather than left to theme/global.scss's blanket
// rule: ::view-transition-* pseudo-elements live outside the document tree that rule
// reaches, so a `*` selector never touches them.
export function shouldAnimateNavigation(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    !globalThis.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = globalThis.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useShouldAnimateNavigation(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, shouldAnimateNavigation, () => false);
}

const isSettingsSection = (path: string) => path.startsWith(`${Routes.settings()}/`);

// Design 9c: the way in and the way back are different journeys, and the return is the
// shorter one because the library is a place you already know. The library is where you
// return to, and so is a page you came down from, like Settings from one of its sections.
// Moving between two sections is neither (docs/features/settings.md).
export function navigationDirection(from: string, to: string): NavigationDirection {
  if (from === to || (isSettingsSection(from) && isSettingsSection(to))) {
    return "none";
  }
  return to === Routes.home() || from.startsWith(`${to}/`) ? "back" : "forward";
}
