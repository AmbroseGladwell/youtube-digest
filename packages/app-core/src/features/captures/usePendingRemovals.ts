import { useCallback, useEffect, useRef, useState } from "react";
import type { OverviewId } from "@overview/domain";
import { UNDO_TOAST_MS } from "../../components/shared/Toast/useToast.js";

export interface PendingRemovals {
  pending: ReadonlySet<string>;
  removeLater: (id: OverviewId) => () => void;
}

// Design 358i: Remove has Undo, so a kept link goes only once the Undo has passed, or the page closes first.
export const usePendingRemovals = (remove: (id: OverviewId) => void): PendingRemovals => {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<OverviewId, ReturnType<typeof setTimeout>>());
  const latestRemove = useRef(remove);
  latestRemove.current = remove;

  const settle = useCallback((id: OverviewId) => {
    timers.current.delete(id);
    setPending((current) => new Set([...current].filter((held) => held !== id)));
  }, []);

  const removeLater = useCallback(
    (id: OverviewId) => {
      setPending((current) => new Set(current).add(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          latestRemove.current(id);
        }, UNDO_TOAST_MS),
      );
      return () => {
        clearTimeout(timers.current.get(id));
        settle(id);
      };
    },
    [settle],
  );

  useEffect(() => {
    const held = timers.current;
    return () => {
      for (const [id, timer] of held) {
        clearTimeout(timer);
        latestRemove.current(id);
      }
    };
  }, []);

  return { pending, removeLater };
};
