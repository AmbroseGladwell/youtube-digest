import { MILESTONES, type Milestone, type MilestoneMarks } from "./Milestone.js";

export const MILESTONE_SHOWN_FOR_MS = 24 * 60 * 60 * 1000;

// Reached by the total but not yet recorded as crossed: what to stamp now.
export function newlyCrossedMilestones(marks: MilestoneMarks, totalMinutes: number): Milestone[] {
  return MILESTONES.filter((milestone) => milestone.minutes <= totalMinutes && marks[milestone.id] === undefined);
}

// Shown for 24 hours from the crossing, unless dismissed, and only while the total still
// reaches it; shortest first (docs/features/time-saved.md, "When a milestone shows").
export function visibleMilestones(marks: MilestoneMarks, totalMinutes: number, now: Date): Milestone[] {
  return MILESTONES.filter((milestone) => {
    const mark = marks[milestone.id];
    if (mark === undefined || mark.dismissedAt !== null || milestone.minutes > totalMinutes) {
      return false;
    }
    return now.getTime() - Date.parse(mark.crossedAt) < MILESTONE_SHOWN_FOR_MS;
  });
}
