import { useEffect, useState } from "react";
import type { HeadBackLink } from "../../app/BackLinkHandoffContext.js";

const passedUnder = (entry: IntersectionObserverEntry): boolean =>
  !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);

// True once the note's back link has scrolled under the sticky band, false again once it
// comes back out, judged at the band's lower edge (design 167c).
export function useBackInBar(band: HTMLElement | null, link: HeadBackLink | null, enabled: boolean): boolean {
  const [backInBar, setBackInBar] = useState(false);

  useEffect(() => {
    if (!enabled || band === null || link === null) {
      setBackInBar(false);
      return;
    }
    // A page that draws no link of its own has nothing to scroll under the band, so the
    // slot carries it for as long as the page is open (design 205d-2).
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
}
