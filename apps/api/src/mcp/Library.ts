import type { Overview, OverviewState, Project, ProjectMember, Topic } from "@overview/domain";

export interface LibraryEntry {
  overview: Overview;
  state: OverviewState | null;
}

// Every membership record, including those whose overview was taken out: the latest change
// to one is what "last changed" counts (docs/features/projects.md).
export interface Library {
  entries: LibraryEntry[];
  topics: Topic[];
  projects: Project[];
  members: ProjectMember[];
  unreadable: number;
}
