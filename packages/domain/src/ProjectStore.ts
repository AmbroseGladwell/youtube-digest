import type { OverviewId, ProjectId } from "./Brands.js";
import type { Project, ProjectPatch } from "./Project.js";
import type { ProjectMember } from "./ProjectMember.js";

// The reader's side of projects. What an assistant does arrives through sync, already
// marked with who did it (docs/features/projects.md).
export interface ProjectStore {
  listProjects(): Promise<Project[]>;
  getProject(id: ProjectId): Promise<Project | null>;
  // Does nothing when a project with this id is already here, so a move that stops can run again.
  createProject(project: Project): Promise<void>;
  updateProject(id: ProjectId, patch: ProjectPatch): Promise<void>;
  deleteProject(id: ProjectId): Promise<void>;
  // Only the membership records of overviews that are in their project now.
  listMembers(): Promise<ProjectMember[]>;
  // The membership records of overviews taken out of their project, which are never offered
  // back to it (docs/features/projects.md, "Offering what's already saved").
  listTakenOut(): Promise<ProjectMember[]>;
  addToProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
  // Puts an overview in a project as filing, and does nothing when this overview has ever been in
  // it, so the reader's removal stands (docs/features/projects.md, "Filing as an overview is made").
  fileIntoProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
  removeFromProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
  // "Not for this project" on a suggestion: an overview never in the project is recorded as put
  // in and taken out, so every device knows it is not to be offered there again. Does nothing
  // when this overview has ever been in it.
  turnDownForProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
}
