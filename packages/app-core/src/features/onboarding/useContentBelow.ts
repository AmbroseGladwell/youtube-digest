import { useEffect, useState, type RefCallback } from "react";

// The fade's fallback and reduced-motion path: docs/features/onboarding-foot.md, "What was built".
export const useContentBelow = (): [RefCallback<HTMLElement>, boolean] => {
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
};
