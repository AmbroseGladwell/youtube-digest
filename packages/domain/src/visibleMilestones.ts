import { MILESTONES, type Milestone, type MilestoneMarks } from "./Milestone.js";

export const MILESTONE_SHOWN_FOR_MS = 24 * 60 * 60 * 1000;

export const newlyCrossedMilestones = (marks: MilestoneMarks, totalMinutes: number): Milestone[] => {
  return MILESTONES.filter((milestone) => milestone.minutes <= totalMinutes && marks[milestone.id] === undefined);
};

// docs/features/time-saved.md, "When a milestone shows".
export const visibleMilestones = (marks: MilestoneMarks, totalMinutes: number, now: Date): Milestone[] => {
  return MILESTONES.filter((milestone) => {
    const mark = marks[milestone.id];
    if (mark === undefined || mark.dismissedAt !== null || milestone.minutes > totalMinutes) {
      return false;
    }
    return now.getTime() - Date.parse(mark.crossedAt) < MILESTONE_SHOWN_FOR_MS;
  });
};
