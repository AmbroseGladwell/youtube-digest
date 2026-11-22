import { useLayoutEffect, useRef, type RefObject } from "react";
import { useViewTransitionState } from "react-router";
import { shouldAnimateNavigation } from "./viewTransitions.js";

// Why only the thumbnail carries: docs/features/page-transitions.md, "The row becomes the head".
const OVERVIEW_IMAGE = "overview-image";

// On the root, the only place a ::view-transition-* rule in paneTransitions.scss can see it.
const MORPHING = "overviewMorph";

const onScreen = (element: Element): boolean => {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.bottom > 0 && box.top < globalThis.innerHeight;
};

// The leaving end decides, and the arriving end follows the mark it left on the root.
export const useOverviewImageMorph = <T extends HTMLElement>(overviewPath: string, carries: boolean): RefObject<T | null> => {
  const element = useRef<T>(null);
  const transitioning = useViewTransitionState(overviewPath);
  const settled = useRef(!transitioning);
  const named = useRef(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!transitioning) {
      settled.current = true;
      // Only the end that set the mark may clear it: every other row runs this branch as it mounts.
      if (named.current) {
        named.current = false;
        delete root.dataset[MORPHING];
      }
      return;
    }
    // The leaving end clears a mark left behind, as by a head whose image failed after the row named itself.
    const arriving = !settled.current;
    if (!arriving) {
      delete root.dataset[MORPHING];
    }

    const node = element.current;
    if (node === null || !carries || !shouldAnimateNavigation() || !onScreen(node)) {
      return;
    }
    if (arriving && root.dataset[MORPHING] === undefined) {
      return;
    }

    node.style.viewTransitionName = OVERVIEW_IMAGE;
    named.current = true;
    root.dataset[MORPHING] = "";
    return () => {
      node.style.viewTransitionName = "";
    };
  }, [transitioning, carries]);

  return element;
};
