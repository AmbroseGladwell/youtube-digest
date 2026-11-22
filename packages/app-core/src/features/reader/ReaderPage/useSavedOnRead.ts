import { useEffect, useRef } from "react";
import type { OverviewId } from "@overview/domain";
import { useSavedMoment } from "../../timeSaved/components/SavedChip/useSavedMoment.js";

// When the chip comes and goes: docs/features/time-saved.md, "Every day".
export const useSavedOnRead = (overviewId: OverviewId, read: boolean | undefined) => {
  const moment = useSavedMoment(null);
  const last = useRef<{ overviewId: OverviewId; read: boolean } | null>(null);

  useEffect(() => {
    if (read === undefined) {
      return;
    }
    const previous = last.current;
    last.current = { overviewId, read };
    if (previous === null || previous.overviewId !== overviewId) {
      moment.reset();
    } else if (!previous.read && read) {
      moment.show();
    } else if (previous.read && !read) {
      moment.hide();
    }
  }, [overviewId, read]);

  return moment.phase;
};
