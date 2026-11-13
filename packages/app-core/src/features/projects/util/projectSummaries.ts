import type { OverviewId, Project, ProjectMember, ProjectOverview } from "@overview/domain";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";

export interface ProjectSummaryItem extends ProjectOverview {
  addedAt: string;
}

export interface ProjectSummary {
  project: Project;
  items: ProjectSummaryItem[];
  unread: number;
  // The latest of when it was made and when anything was put in it: what a membership record
  // taken out leaves behind isn't kept on the device (docs/features/projects.md, "The project page").
  updatedAt: string;
}

const later = (left: string, right: string): string => (left > right ? left : right);

// Every project with the overviews in it that this library holds, last changed first.
export function projectSummaries(projects: Project[], members: ProjectMember[], overviews: OverviewWithState[]): ProjectSummary[] {
  const byId = new Map<string, OverviewWithState>(overviews.map((entry) => [entry.overview.id, entry]));
  return projects
    .map((project) => {
      const inIt = members.filter((member) => member.projectId === project.id && byId.has(member.overviewId));
      const items = inIt.map((member) => {
        const { overview, state } = byId.get(member.overviewId)!;
        return { overview, read: state.read, addedBy: member.addedBy, addedAt: member.addedAt };
      });
      return {
        project,
        items,
        unread: items.filter((item) => !item.read).length,
        updatedAt: inIt.reduce((latest, member) => later(latest, member.addedAt), project.createdAt),
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.project.name.localeCompare(right.project.name));
}

export const activeSummaries = (summaries: ProjectSummary[]): ProjectSummary[] =>
  summaries.filter((summary) => summary.project.archivedAt === null);

export const archivedSummaries = (summaries: ProjectSummary[]): ProjectSummary[] =>
  summaries
    .filter((summary) => summary.project.archivedAt !== null)
    .sort((left, right) => right.project.archivedAt!.localeCompare(left.project.archivedAt!));

// The projects an overview is in, as its line under the byline names them: archived ones left off.
export const projectsHolding = (summaries: ProjectSummary[], overviewId: OverviewId): ProjectSummary[] =>
  activeSummaries(summaries).filter((summary) => summary.items.some((item) => item.overview.id === overviewId));
