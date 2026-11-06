import { useEffect, useState, type RefCallback } from "react";

const SCROLLED_ATTRIBUTE = "data-page-scrolled";

// Whether the page has scrolled at all, judged by a sentinel at the top of it leaving the
// viewport. Published on the document root rather than returned, because what reads it is a
// global rule (docs/features/fade-under-the-bar.md).
export function usePageScrolled(): RefCallback<HTMLElement> {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (sentinel === null) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => entry && document.documentElement.toggleAttribute(SCROLLED_ATTRIBUTE, !entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      document.documentElement.removeAttribute(SCROLLED_ATTRIBUTE);
    };
  }, [sentinel]);

  return setSentinel;
}
