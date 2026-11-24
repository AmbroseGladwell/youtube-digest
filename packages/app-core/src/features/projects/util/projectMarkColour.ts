import type { ProjectId } from "@overview/domain";

const MARKS = 6;

// Projects store no colour, so each takes one of six by its id and keeps it everywhere.
export const projectMarkColour = (projectId: ProjectId | string): string => {
  let sum = 0;
  for (const character of projectId) {
    sum = (sum + character.charCodeAt(0)) % MARKS;
  }
  return `var(--project-mark-${sum + 1})`;
};
