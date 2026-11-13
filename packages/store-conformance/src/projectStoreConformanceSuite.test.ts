import {
  BY_READER,
  isInProject,
  memberChangeTime,
  mergeProjectMember,
  projectMemberId,
  type OverviewId,
  type Project,
  type ProjectId,
  type ProjectMember,
  type ProjectPatch,
  type ProjectStore,
} from "@overview/domain";
import { defineProjectStoreConformanceSuite } from "./projectStoreConformanceSuite.js";

class InMemoryProjectStore implements ProjectStore {
  #projects = new Map<string, Project>();
  #members = new Map<string, ProjectMember>();

  async listProjects() {
    return [...this.#projects.values()];
  }

  async getProject(id: ProjectId) {
    return this.#projects.get(id) ?? null;
  }

  async createProject(project: Project) {
    if (!this.#projects.has(project.id)) this.#projects.set(project.id, project);
  }

  async updateProject(id: ProjectId, patch: ProjectPatch) {
    const project = this.#projects.get(id);
    const given = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    if (project !== undefined) this.#projects.set(id, { ...project, ...given });
  }

  async deleteProject(id: ProjectId) {
    this.#projects.delete(id);
    for (const [key, member] of this.#members) if (member.projectId === id) this.#members.delete(key);
  }

  async listMembers() {
    return [...this.#members.values()].filter(isInProject);
  }

  async addToProject(projectId: ProjectId, overviewId: OverviewId) {
    this.#change(projectId, overviewId, (at) => ({ addedAt: at, addedBy: BY_READER }));
  }

  async removeFromProject(projectId: ProjectId, overviewId: OverviewId) {
    if (this.#members.has(projectMemberId(projectId, overviewId))) {
      this.#change(projectId, overviewId, (at) => ({ removedAt: at }));
    }
  }

  #change(projectId: ProjectId, overviewId: OverviewId, change: (at: string) => Record<string, unknown>) {
    if (!this.#projects.has(projectId)) return;
    const id = projectMemberId(projectId, overviewId);
    const existing = this.#members.get(id);
    const base = existing ?? { id, projectId, overviewId, removedAt: null };
    this.#members.set(id, mergeProjectMember(base, change(memberChangeTime(existing, new Date()))) as ProjectMember);
  }
}

defineProjectStoreConformanceSuite("InMemoryProjectStore (reference)", () => new InMemoryProjectStore());
