import { useEffect, useRef } from "react";
import {
  newlyCrossedMilestones,
  visibleMilestones,
  type Milestone,
  type MilestoneId,
  type MilestoneMarks,
} from "@overview/domain";
import { useNow } from "../../util/useNow.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSync } from "../sync/SyncContext.js";

const NO_MARKS: MilestoneMarks = {};

export interface Milestones {
  visible: Milestone[];
  shown: (id: MilestoneId) => void;
  dismiss: (id: MilestoneId) => void;
  undo: (id: MilestoneId) => void;
}

// Records a crossing the moment the total reaches a milestone, and a dismissal when ×
// is pressed, both on the account's settings so they hold on every device. A signed-in
// device waits for its first sync to finish before recording anything, so a library still
// arriving from the server is not mistaken for milestones crossed just now
// (docs/features/time-saved.md, "When a milestone shows").
export function useMilestones(minutes: number, libraryLoaded: boolean): Milestones {
  const settings = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const sync = useSync();
  const analytics = useAnalytics();
  useNow(60_000);
  const requested = useRef(new Set<MilestoneId>());
  const marks = settings.data?.milestones ?? NO_MARKS;
  const caughtUp = !sync.connected || sync.status.lastSyncedAt !== null;
  const settled = libraryLoaded && settings.data !== undefined && caughtUp;

  useEffect(() => {
    if (!settled) {
      return;
    }
    const crossed = newlyCrossedMilestones(marks, minutes).filter(
      (milestone) => !requested.current.has(milestone.id),
    );
    if (crossed.length === 0) {
      return;
    }
    const crossedAt = new Date().toISOString();
    crossed.forEach((milestone) => requested.current.add(milestone.id));
    updateSettings.mutate({
      milestones: Object.fromEntries(crossed.map((milestone) => [milestone.id, { crossedAt, dismissedAt: null }])),
    });
  }, [settled, minutes, marks]);

  const mark = (id: MilestoneId, dismissedAt: string | null) => {
    const current = marks[id];
    if (current !== undefined) {
      updateSettings.mutate({ milestones: { [id]: { ...current, dismissedAt } } });
    }
  };

  return {
    visible: settled ? visibleMilestones(marks, minutes, new Date()) : [],
    shown: (id) => analytics.timeSaved.milestoneShown({ milestone: id }),
    dismiss: (id) => {
      mark(id, new Date().toISOString());
      analytics.timeSaved.milestoneDismissed({ milestone: id });
    },
    undo: (id) => mark(id, null),
  };
}
