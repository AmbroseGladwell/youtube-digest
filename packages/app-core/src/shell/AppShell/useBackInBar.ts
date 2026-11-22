import { useEffect, useState } from "react";
import type { HeadBackLink } from "../../app/BackLinkHandoffContext.js";

const passedUnder = (entry: IntersectionObserverEntry): boolean =>
  !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);

export const useBackInBar = (band: HTMLElement | null, link: HeadBackLink | null, enabled: boolean): boolean => {
  const [backInBar, setBackInBar] = useState(false);

  useEffect(() => {
    if (!enabled || band === null || link === null) {
      setBackInBar(false);
      return;
    }
    // A page that draws no link of its own lends the slot its link for as long as it is open.
    const element = link.element;
    if (element === null) {
      setBackInBar(true);
      return;
    }
    let observer: IntersectionObserver | null = null;
    const watch = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(([entry]) => entry && setBackInBar(passedUnder(entry)), {
        rootMargin: `-${band.offsetHeight}px 0px 0px 0px`,
        threshold: 0,
      });
      observer.observe(element);
    };
    watch();
    const bandResized = new ResizeObserver(watch);
    bandResized.observe(band);
    return () => {
      observer?.disconnect();
      bandResized.disconnect();
    };
  }, [enabled, band, link]);

  return backInBar;
};
