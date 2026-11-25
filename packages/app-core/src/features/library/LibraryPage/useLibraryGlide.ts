import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { shouldAnimateNavigation } from "../../../util/viewTransitions.js";

const GLIDE_ATTRIBUTE = "libraryGlide";
const POPOVER_GLIDE_NAME = "library-popover";
const TOOLBAR_GLIDE_NAME = "library-toolbar";
const SETTLE_LIMIT_MS = 500;

const glidables = (region: HTMLElement) => region.querySelectorAll<HTMLElement>("[data-glide-name]");

const nameAll = (region: HTMLElement) => {
  for (const element of glidables(region)) {
    element.style.viewTransitionName = element.dataset.glideName ?? "";
  }
};

const unnameAll = (region: HTMLElement) => {
  for (const element of glidables(region)) {
    element.style.viewTransitionName = "";
  }
};

const openPopover = () => document.querySelector<HTMLElement>("body > [role='dialog'], body > [role='menu']");

const heldAbove = (region: HTMLElement): [HTMLElement, string][] => {
  const pairs: [HTMLElement | null, string][] = [
    [region.querySelector<HTMLElement>("[data-glide-above]"), TOOLBAR_GLIDE_NAME],
    [openPopover(), POPOVER_GLIDE_NAME],
  ];
  return pairs.filter((pair): pair is [HTMLElement, string] => pair[0] !== null);
};

const modalOpen = () => document.querySelector("dialog[open]:modal") !== null;

export const libraryRowGlideName = (id: string) => `library-row-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

// What glides, and when: docs/features/tag-reuse.md, "The glide (84s, "OV-84 4 Chip Motion")".
export const useLibraryGlide = (region: RefObject<HTMLElement | null>, viewKey: string) => {
  const settle = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const element = region.current;
    if (settle.current === null || element === null) {
      return;
    }
    nameAll(element);
    const done = settle.current;
    settle.current = null;
    done();
  }, [region, viewKey]);

  return useCallback(
    (update: () => void) => {
      const element = region.current;
      if (element === null || !shouldAnimateNavigation() || modalOpen()) {
        update();
        return;
      }
      if (element.getBoundingClientRect().top < 0) {
        update();
        globalThis.scrollTo({ top: 0 });
        return;
      }
      document.documentElement.dataset[GLIDE_ATTRIBUTE] = "";
      nameAll(element);
      const above = heldAbove(element);
      for (const [held, name] of above) {
        held.style.viewTransitionName = name;
      }
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            settle.current = resolve;
            update();
            setTimeout(() => {
              if (settle.current === resolve) {
                settle.current = null;
                resolve();
              }
            }, SETTLE_LIMIT_MS);
          }),
      );
      // `types` is undefined on browsers predating view-transition types, despite the DOM lib.
      transition.types?.add("library-glide");
      void transition.finished.finally(() => {
        unnameAll(element);
        for (const [held] of above) {
          held.style.viewTransitionName = "";
        }
        delete document.documentElement.dataset[GLIDE_ATTRIBUTE];
      });
    },
    [region],
  );
};
