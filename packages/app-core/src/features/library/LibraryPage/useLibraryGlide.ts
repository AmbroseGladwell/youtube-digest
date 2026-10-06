import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { shouldAnimateNavigation } from "../../../util/viewTransitions.js";

const GLIDE_ATTRIBUTE = "libraryGlide";
const SETTLE_LIMIT_MS = 500;

const glidables = (region: HTMLElement) => region.querySelectorAll<HTMLElement>("[data-glide-name]");

const nameAll = (region: HTMLElement) => {
  for (const element of glidables(region)) element.style.viewTransitionName = element.dataset.glideName ?? "";
};

const unnameAll = (region: HTMLElement) => {
  for (const element of glidables(region)) element.style.viewTransitionName = "";
};

// A view-transition name for one library row: unique on the page, and a valid identifier
// whatever an unreadable record's id holds.
export const libraryRowGlideName = (id: string) => `library-row-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

// "OV-84 4 Chip Motion" 84s: a filter or sort change as one movement. Rows that stay glide to
// their new places, rows that go fade where they were, new ones fade in, and the chip row
// opens or closes with them (libraryTransitions.scss). The names exist only for the length
// of the transition, so a route transition still sees one pane. Scrolled down into the list,
// the change lands at once and the page goes back to the top instead.
export function useLibraryGlide(region: RefObject<HTMLElement | null>, viewKey: string) {
  const settle = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const element = region.current;
    if (settle.current === null || element === null) return;
    nameAll(element);
    const done = settle.current;
    settle.current = null;
    done();
  }, [region, viewKey]);

  return useCallback(
    (update: () => void) => {
      const element = region.current;
      if (element === null || !shouldAnimateNavigation()) {
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
        delete document.documentElement.dataset[GLIDE_ATTRIBUTE];
      });
    },
    [region],
  );
}
