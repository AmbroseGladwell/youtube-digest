import { useEffect, useRef, useState } from "react";

// Why the first render is never new: docs/features/overview-redesign.md, "How a new row arrives".
export const useEnteringOverviewIds = (overviewIds: string[]): ReadonlySet<string> => {
  const seen = useRef<Set<string> | null>(null);
  const [entering, setEntering] = useState<ReadonlySet<string>>(() => new Set());
  const key = overviewIds.join("|");

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(overviewIds);
      return;
    }
    const arrived = overviewIds.filter((overviewId) => !seen.current!.has(overviewId));
    for (const overviewId of overviewIds) {
      seen.current.add(overviewId);
    }
    if (arrived.length > 0) {
      setEntering(new Set(arrived));
    }
  }, [key]);

  return entering;
};
