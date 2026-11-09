import { useLayoutEffect, useRef, type RefObject } from "react";
import { useViewTransitionState } from "react-router";
import { shouldAnimateNavigation } from "./viewTransitions.js";

// Design OV-170 170h: the thumbnail is the one thing that looks the same on both pages, so
// it is the app's only shared element and its only name. The title, byline and verdict fade
// with the pane (docs/features/page-transitions.md).
const OVERVIEW_IMAGE = "overview-image";

// paneTransitions.scss reads this to hold the pane still while the image travels. It has to
// be on the root, where a ::view-transition-* rule can see it.
const MORPHING = "overviewMorph";

// Both ends have to be on screen, or the image flies to or from somewhere the reader cannot
// see. Going in that is free, because the row was just clicked; coming back out of a long
// note the head has scrolled away, and that is the common case.
function onScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.bottom > 0 && box.top < globalThis.innerHeight;
}

// The end that was already mounted when the transition began is the page being left: React
// Router renders that tree with the transition live and only then captures the old snapshot
// (react-router@8.4.0, lib/components.js, the RouterProvider's setState). So the leaving end
// decides whether the image carries at all, and the arriving end follows that decision,
// which it finds on the root. Without the handshake, coming back from a scrolled note would
// name the row with nothing to pair it with, and the pane would hold still for a journey
// that is really 9c's.
//
// "Appeared during this transition" has to be asked afresh each time, not remembered from
// the first render: the head arrives during the journey in, and is the one being left on the
// journey back. Having once rendered with no transition running is what separates them.
export function useOverviewImageMorph<T extends HTMLElement>(overviewPath: string, carries: boolean): RefObject<T | null> {
  const element = useRef<T>(null);
  const transitioning = useViewTransitionState(overviewPath);
  const settled = useRef(!transitioning);
  const named = useRef(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!transitioning) {
      settled.current = true;
      // Only the end that set the mark may clear it. Every other row on the library runs
      // this branch as it mounts, and a blanket delete here would wipe the mark the one
      // opened row had just written.
      if (named.current) {
        named.current = false;
        delete root.dataset[MORPHING];
      }
      return;
    }
    // The leaving end opens the journey, so the mark starts clean even if the end before it
    // went away without clearing — a head whose image failed after the row had named itself.
    const arriving = !settled.current;
    if (!arriving) delete root.dataset[MORPHING];

    const node = element.current;
    if (node === null || !carries || !shouldAnimateNavigation() || !onScreen(node)) return;
    if (arriving && root.dataset[MORPHING] === undefined) return;

    node.style.viewTransitionName = OVERVIEW_IMAGE;
    named.current = true;
    root.dataset[MORPHING] = "";
    return () => {
      node.style.viewTransitionName = "";
    };
  }, [transitioning, carries]);

  return element;
}
