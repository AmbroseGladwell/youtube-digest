import type { OverviewWithState } from "../overviews/types/OverviewWithState.js";
import { useProjectMembersQuery } from "./queries/projectMembersQuery.js";
import { useProjectsQuery } from "./queries/projectsQuery.js";
import { projectSummaries, type ProjectSummary } from "./util/projectSummaries.js";

export interface ProjectSummariesResult {
  summaries: ProjectSummary[];
  loaded: boolean;
}

export function useProjectSummaries(overviews: OverviewWithState[]): ProjectSummariesResult {
  const projects = useProjectsQuery();
  const members = useProjectMembersQuery();
  if (projects.data === undefined || members.data === undefined) return { summaries: [], loaded: false };
  return { summaries: projectSummaries(projects.data, members.data, overviews), loaded: true };
}
