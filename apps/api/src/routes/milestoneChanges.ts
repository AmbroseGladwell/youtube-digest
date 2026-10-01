import type { MilestoneMark } from "@overview/domain";

export type MilestoneChange = "crossed" | "dismissed" | "restored";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// What a settings patch did to each milestone it names, judged against the stored marks:
// a first mark is a crossing, a dismissedAt set is a dismissal, and one cleared is an undo
// (docs/features/time-saved.md, "What is counted").
export function milestoneChanges(
  stored: unknown,
  patch: Record<string, MilestoneMark>,
): Record<string, MilestoneChange> {
  const before = isObject(stored) ? stored : {};
  return Object.fromEntries(
    Object.entries(patch).flatMap(([id, mark]): [string, MilestoneChange][] => {
      const previous = before[id];
      if (!isObject(previous)) {
        return [[id, mark.dismissedAt === null ? "crossed" : "dismissed"]];
      }
      if (previous.dismissedAt === null && mark.dismissedAt !== null) {
        return [[id, "dismissed"]];
      }
      if (previous.dismissedAt !== null && mark.dismissedAt === null) {
        return [[id, "restored"]];
      }
      return [];
    }),
  );
}
