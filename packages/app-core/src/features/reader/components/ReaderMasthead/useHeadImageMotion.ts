import { useLayoutEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";

const GROW_MS = 500;
const GROW_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const FADE_IN_MS = 120;

interface Before {
  image: DOMRect;
  titleTop: number;
}

export interface HeadImageMotionParts {
  header: RefObject<HTMLElement | null>;
  image: RefObject<HTMLButtonElement | null>;
  title: RefObject<HTMLElement | null>;
  who: () => Element[];
}

// Everything under the title moves by the same amount, so it is measured once on the title.
// Fixed parts, like the player bar, are left where they are.
const below = (header: HTMLElement, title: HTMLElement): HTMLElement[] => {
  const inHead: HTMLElement[] = [];
  for (let next = title.nextElementSibling; next !== null; next = next.nextElementSibling) {
    inHead.push(next as HTMLElement);
  }
  const onPage: HTMLElement[] = [];
  for (let next = header.nextElementSibling; next !== null; next = next.nextElementSibling) {
    if (getComputedStyle(next).position !== "fixed") onPage.push(next as HTMLElement);
  }
  return [title, ...inHead, ...onPage];
};

// Design 151l and 151m: the image grows from its own top-left corner as a transform measured
// from where it was, so the page doesn't reflow on the way; the text below slides with it
// and who it's from fades in at its new place. Reduced motion swaps at once and crossfades
// the head.
export function useHeadImageMotion(full: boolean, parts: HeadImageMotionParts): () => void {
  const before = useRef<Before | null>(null);

  useLayoutEffect(() => {
    const first = before.current;
    before.current = null;
    const header = parts.header.current;
    const image = parts.image.current;
    const title = parts.title.current;
    if (first === null || header === null || image === null || title === null) return;

    if (prefersReducedMotion()) {
      header.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN_MS, easing: "linear" });
      return;
    }

    const last = image.getBoundingClientRect();
    image.animate(
      [
        {
          transformOrigin: "top left",
          transform: `translate(${first.image.left - last.left}px, ${first.image.top - last.top}px) scale(${first.image.width / last.width})`,
        },
        { transformOrigin: "top left", transform: "none" },
      ],
      { duration: GROW_MS, easing: GROW_EASING },
    );

    const shift = first.titleTop - title.getBoundingClientRect().top;
    for (const part of below(header, title)) {
      part.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], {
        duration: GROW_MS,
        easing: GROW_EASING,
      });
    }

    const fadeFrom = (GROW_MS - FADE_IN_MS) / GROW_MS;
    for (const part of parts.who()) {
      part.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: fadeFrom },
          { opacity: 1, offset: 1 },
        ],
        { duration: GROW_MS, easing: "linear" },
      );
    }
  }, [full]);

  return () => {
    const image = parts.image.current;
    const title = parts.title.current;
    if (image === null || title === null) return;
    before.current = { image: image.getBoundingClientRect(), titleTop: title.getBoundingClientRect().top };
  };
}
