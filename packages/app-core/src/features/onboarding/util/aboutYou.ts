// About you's chips, and the line they build (design 46f). The line is what generation reads
// as the reader context, so it is kept to a few plain words: it is sent with every overview
// (docs/features/personalisation.md).
export const ABOUT_YOU_ROLES = [
  { label: "Student", line: "A student" },
  { label: "Healthcare", line: "Works in healthcare" },
  { label: "Teaching", line: "A teacher" },
  { label: "Office work", line: "Works in an office" },
  { label: "Running a business", line: "Runs a small business" },
  { label: "A trade or craft", line: "Works in a trade" },
  { label: "Creative work", line: "Does creative work" },
  { label: "Retired", line: "Retired" },
  { label: "Looking after family", line: "Looks after family" },
] as const;

export const ABOUT_YOU_GOALS = [
  "Cooking",
  "Money",
  "Health and fitness",
  "Work skills",
  "Tech",
  "A language",
  "Parenting",
  "Home and DIY",
] as const;

export type AboutYouRole = (typeof ABOUT_YOU_ROLES)[number]["label"];
export type AboutYouGoal = (typeof ABOUT_YOU_GOALS)[number];

export const MAX_ABOUT_YOU_GOALS = 2;
export const MAX_ABOUT_YOU_LENGTH = 140;

export function aboutYouLine(role: AboutYouRole | null, goals: readonly AboutYouGoal[]): string {
  const parts = [
    role === null ? "" : (ABOUT_YOU_ROLES.find((candidate) => candidate.label === role)?.line ?? ""),
    goals.length === 0 ? "" : `learning about ${goals.map((goal) => goal.toLowerCase()).join(" and ")}`,
  ].filter((part) => part !== "");
  const line = parts.join(", ");
  return line === "" ? "" : `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

// A second goal past the cap takes the place of the oldest, so a tap always does something.
export function toggledGoals(goals: readonly AboutYouGoal[], goal: AboutYouGoal): AboutYouGoal[] {
  if (goals.includes(goal)) return goals.filter((held) => held !== goal);
  return [...goals, goal].slice(-MAX_ABOUT_YOU_GOALS);
}
