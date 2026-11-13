import type { ProjectSummary } from "./projectSummaries.js";

export const PROJECT_NUDGE_AFTER_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// A quiet line on a project left alone for 60 days; Keep it puts it off for another 60
// ("OV-168 2 The Project Page" 168p).
export function projectNudged(summary: ProjectSummary, keptAt: string | null, now: Date): boolean {
  if (summary.project.archivedAt !== null) return false;
  const since = keptAt !== null && keptAt > summary.updatedAt ? keptAt : summary.updatedAt;
  return now.getTime() - new Date(since).getTime() >= PROJECT_NUDGE_AFTER_DAYS * DAY_MS;
}
