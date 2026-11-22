import type { Overview, OverviewState, Project, ProjectMember, Topic } from "@overview/domain";

export interface LibraryEntry {
  overview: Overview;
  state: OverviewState | null;
}

// Removed members count to "last changed": docs/features/projects.md, "The reader's screens".
export interface Library {
  entries: LibraryEntry[];
  topics: Topic[];
  projects: Project[];
  members: ProjectMember[];
  unreadable: number;
}
