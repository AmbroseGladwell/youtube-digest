import { z } from "zod";

export const MilestoneId = z.enum(["30m", "1h", "5h", "10h", "15h", "20h", "30h", "50h", "75h", "100h"]);
export type MilestoneId = z.infer<typeof MilestoneId>;

export interface Milestone {
  id: MilestoneId;
  minutes: number;
  label: string;
}

// Shortest first: the order a stack is shown in, and the order they are crossed.
// 100 hours is the last for now (docs/features/time-saved.md).
export const MILESTONES: readonly Milestone[] = [
  { id: "30m", minutes: 30, label: "30 minutes" },
  { id: "1h", minutes: 60, label: "1 hour" },
  { id: "5h", minutes: 5 * 60, label: "5 hours" },
  { id: "10h", minutes: 10 * 60, label: "10 hours" },
  { id: "15h", minutes: 15 * 60, label: "15 hours" },
  { id: "20h", minutes: 20 * 60, label: "20 hours" },
  { id: "30h", minutes: 30 * 60, label: "30 hours" },
  { id: "50h", minutes: 50 * 60, label: "50 hours" },
  { id: "75h", minutes: 75 * 60, label: "75 hours" },
  { id: "100h", minutes: 100 * 60, label: "100 hours" },
];

export const MilestoneMark = z.object({
  crossedAt: z.iso.datetime(),
  dismissedAt: z.iso.datetime().nullable(),
});
export type MilestoneMark = z.infer<typeof MilestoneMark>;

// Keyed by any string rather than by MilestoneId, so a milestone a newer client adds
// survives this one reading and writing the record back.
export const MilestoneMarks = z.record(z.string(), MilestoneMark);
export type MilestoneMarks = z.infer<typeof MilestoneMarks>;

// How a reader moved a milestone card to another line, for analytics.
export const MilestoneLineControl = z.enum(["swipe", "keys", "dot"]);
export type MilestoneLineControl = z.infer<typeof MilestoneLineControl>;
