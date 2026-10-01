import { MILESTONES, formatTimeSaved, spokenTimeSaved, type Milestone, type MilestoneMarks } from "@overview/domain";

export type MilestoneTile =
  | { milestone: Milestone; state: "reached"; reachedAt: string | null }
  | { milestone: Milestone; state: "next"; toGo: number; from: number }
  | { milestone: Milestone; state: "ahead"; toGo: number };

// Design 34aj (docs/features/time-saved.md, "Settings › Milestones").
export function milestoneTiles(marks: MilestoneMarks, minutes: number): MilestoneTile[] {
  const next = MILESTONES.find((milestone) => milestone.minutes > minutes);
  return MILESTONES.map((milestone, index) => {
    if (milestone.minutes <= minutes) {
      return { milestone, state: "reached", reachedAt: marks[milestone.id]?.crossedAt ?? null };
    }
    const toGo = milestone.minutes - minutes;
    return milestone === next
      ? { milestone, state: "next", toGo, from: MILESTONES[index - 1]?.minutes ?? 0 }
      : { milestone, state: "ahead", toGo };
  });
}

export const reachedCount = (minutes: number): number =>
  MILESTONES.filter((milestone) => milestone.minutes <= minutes).length;

// "13 min to go" under an hour, "5h 13m to go" after.
export const timeToGo = (minutes: number): string =>
  `${minutes < 60 ? `${minutes} min` : formatTimeSaved(minutes)} to go`;

export const spokenTimeToGo = (minutes: number): string => `${spokenTimeSaved(minutes)} to go`;

// en-US for the month alone: en-GB spells September "Sept", and the design says "14 Sep".
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

// "2 Aug", with the year once it is not this one.
export function formatReachedOn(iso: string, now: Date): string {
  const date = new Date(iso);
  const dayMonth = `${date.getDate()} ${MONTH.format(date)}`;
  return date.getFullYear() === now.getFullYear() ? dayMonth : `${dayMonth} ${date.getFullYear()}`;
}
