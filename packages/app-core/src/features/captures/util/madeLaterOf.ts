const HOUR_MS = 3_600_000;

export interface MadeLater {
  waitedHours: number;
  after: "reset" | "sameMonth";
}

const monthOf = (at: Date) => at.toISOString().slice(0, 7);

// Counts reset with the UTC month (docs/architecture/tiers.md), so the same month means more came another way.
export const madeLaterOf = (savedAt: string, now: Date): MadeLater => {
  const saved = new Date(savedAt);
  return {
    waitedHours: Math.max(0, Math.floor((now.getTime() - saved.getTime()) / HOUR_MS)),
    after: monthOf(saved) === monthOf(now) ? "sameMonth" : "reset",
  };
};
