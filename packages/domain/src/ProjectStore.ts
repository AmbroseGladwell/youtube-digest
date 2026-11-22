import type { OverviewId, ProjectId } from "./Brands.js";
import type { Project, ProjectPatch } from "./Project.js";
import type { ProjectMember } from "./ProjectMember.js";

// An assistant's changes arrive through sync, marked with who made them (docs/features/projects.md).
export interface ProjectStore {
  listProjects(): Promise<Project[]>;
  getProject(id: ProjectId): Promise<Project | null>;
  // Does nothing when a project with this id is already here, so a move that stops can run again.
  createProject(project: Project): Promise<void>;
  updateProject(id: ProjectId, patch: ProjectPatch): Promise<void>;
  deleteProject(id: ProjectId): Promise<void>;
  // Only the membership records of overviews that are in their project now.
  listMembers(): Promise<ProjectMember[]>;
  // Never offered back: docs/features/projects.md, "Offering what's already saved".
  listTakenOut(): Promise<ProjectMember[]>;
  addToProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
  // No-op if it has ever been in it: docs/features/projects.md, "Filing as an overview is made".
  fileIntoProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
  removeFromProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
  // Recorded as put in and taken out, so no device offers it there again; no-op if it was ever in it.
  turnDownForProject(projectId: ProjectId, overviewId: OverviewId): Promise<void>;
}
