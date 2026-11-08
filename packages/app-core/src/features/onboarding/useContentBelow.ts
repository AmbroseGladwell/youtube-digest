import { useEffect, useState, type RefCallback } from "react";

// Whether a step runs on below its pinned foot, judged by a sentinel at the end of the step
// being out of view. The fallback for the foot's scroll-driven fade, and its reduced-motion path
// (docs/features/onboarding-foot.md).
export function useContentBelow(): [RefCallback<HTMLElement>, boolean] {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [below, setBelow] = useState(false);

  useEffect(() => {
    if (sentinel === null) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => entry && setBelow(!entry.isIntersecting), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel]);

  return [setSentinel, below];
}
