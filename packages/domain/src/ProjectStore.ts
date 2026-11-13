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
  addToProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
  removeFromProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
}
