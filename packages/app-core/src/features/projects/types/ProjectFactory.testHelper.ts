import { BY_READER, ProjectId, projectMemberId, type OverviewId, type Project, type ProjectMember } from "@overview/domain";

export const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: ProjectId.parse("7a1d3c1e-5d0a-4b8e-9d55-0d1f6a0f2b11"),
  name: "Kitchen renovation",
  purpose: "Redo the kitchen by March for £18k without moving the sink.",
  createdAt: "2026-11-04T09:00:00.000Z",
  createdBy: BY_READER,
  purposeBy: BY_READER,
  archivedAt: null,
  ...overrides,
});

export const makeProjectMember = (project: Project, overviewId: OverviewId, overrides: Partial<ProjectMember> = {}): ProjectMember => ({
  id: projectMemberId(project.id, overviewId),
  projectId: project.id,
  overviewId,
  addedAt: "2026-11-10T09:00:00.000Z",
  addedBy: BY_READER,
  removedAt: null,
  ...overrides,
});
