import {
  BY_READER,
  CURRENT_PROJECT_MEMBER_SCHEMA_VERSION,
  CURRENT_PROJECT_SCHEMA_VERSION,
  PROJECT_MEMBER_MIGRATIONS,
  PROJECT_MIGRATIONS,
  Project,
  ProjectMember,
  isInProject,
  memberChangeTime,
  mergeProjectMember,
  migrateStoredRecord,
  projectMemberId,
  readStoredRecord,
  stampStoredRecord,
  type OverviewId,
  type ProjectId,
  type ProjectPatch,
  type ProjectStore,
} from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import { MEMBERS_BY_PROJECT_INDEX, PROJECTS_STORE, PROJECT_MEMBERS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

type MemberChange = (at: string) => Record<string, unknown>;

export class IndexedDbProjectStore implements ProjectStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  async listProjects(): Promise<Project[]> {
    const raws = await this.#readAll(PROJECTS_STORE);
    return raws
      .map((raw) => readStoredRecord(raw, Project, PROJECT_MIGRATIONS))
      .flatMap((read) => (read.status === "read" ? [read.record] : []));
  }

  async getProject(id: ProjectId): Promise<Project | null> {
    const store = this.#db.transaction(PROJECTS_STORE, "readonly").objectStore(PROJECTS_STORE);
    const raw = await promisifyRequest<unknown>(store.get(id));
    if (raw === undefined) return null;
    const read = readStoredRecord(raw, Project, PROJECT_MIGRATIONS);
    return read.status === "read" ? read.record : null;
  }

  async createProject(project: Project): Promise<void> {
    const now = new Date();
    const transaction = this.#db.transaction([PROJECTS_STORE, ...JOURNALLED_STORES], "readwrite");
    const projects = transaction.objectStore(PROJECTS_STORE);
    if ((await promisifyRequest<unknown>(projects.get(project.id))) !== undefined) {
      await promisifyTransaction(transaction);
      return;
    }
    const record = stampStoredRecord(project, CURRENT_PROJECT_SCHEMA_VERSION, now);
    projects.put(record);
    const journaled = await appendPendingWrite(transaction, {
      kind: "project",
      id: project.id,
      updatedAt: now.toISOString(),
      change: { op: "replace", record },
    });
    await this.#finish(transaction, journaled);
  }

  // Merged into the stored record rather than a parsed one, so a newer client's fields
  // survive (docs/features/record-migrations.md).
  async updateProject(id: ProjectId, patch: ProjectPatch): Promise<void> {
    const now = new Date();
    const transaction = this.#db.transaction([PROJECTS_STORE, ...JOURNALLED_STORES], "readwrite");
    const projects = transaction.objectStore(PROJECTS_STORE);
    const migrated = migrateStoredRecord(await promisifyRequest<unknown>(projects.get(id)), PROJECT_MIGRATIONS);
    if (migrated.status !== "migrated" || Object.keys(patch).length === 0) {
      await promisifyTransaction(transaction);
      return;
    }
    projects.put(stampStoredRecord({ ...migrated.record, ...patch, id }, CURRENT_PROJECT_SCHEMA_VERSION, now));
    const journaled = await appendPendingWrite(transaction, {
      kind: "project",
      id,
      updatedAt: now.toISOString(),
      change: { op: "project", patch: { ...patch } },
    });
    await this.#finish(transaction, journaled);
  }

  // Its membership records go with it here and now; on the server the delete takes them with it, so
  // they are not journaled one by one (docs/features/projects.md).
  async deleteProject(id: ProjectId): Promise<void> {
    const transaction = this.#db.transaction([PROJECTS_STORE, PROJECT_MEMBERS_STORE, ...JOURNALLED_STORES], "readwrite");
    const projects = transaction.objectStore(PROJECTS_STORE);
    const existing = await promisifyRequest<unknown>(projects.get(id));
    projects.delete(id);
    const members = transaction.objectStore(PROJECT_MEMBERS_STORE);
    for (const key of await promisifyRequest<IDBValidKey[]>(members.index(MEMBERS_BY_PROJECT_INDEX).getAllKeys(id))) {
      members.delete(key);
    }
    const journaled =
      existing !== undefined &&
      (await appendPendingWrite(transaction, { kind: "project", id, updatedAt: new Date().toISOString(), change: { op: "delete" } }));
    await this.#finish(transaction, journaled);
  }

  async listMembers(): Promise<ProjectMember[]> {
    const raws = await this.#readAll(PROJECT_MEMBERS_STORE);
    return raws
      .map((raw) => readStoredRecord(raw, ProjectMember, PROJECT_MEMBER_MIGRATIONS))
      .flatMap((read) => (read.status === "read" && isInProject(read.record) ? [read.record] : []));
  }

  async addToProject(projectId: ProjectId, overviewId: OverviewId): Promise<void> {
    await this.#changeMember(projectId, overviewId, (at) => ({ addedAt: at, addedBy: BY_READER }), true);
  }

  async removeFromProject(projectId: ProjectId, overviewId: OverviewId): Promise<void> {
    await this.#changeMember(projectId, overviewId, (at) => ({ removedAt: at }), false);
  }

  async #changeMember(projectId: ProjectId, overviewId: OverviewId, change: MemberChange, createsMembership: boolean): Promise<void> {
    const now = new Date();
    const id = projectMemberId(projectId, overviewId);
    const transaction = this.#db.transaction([PROJECTS_STORE, PROJECT_MEMBERS_STORE, ...JOURNALLED_STORES], "readwrite");
    const members = transaction.objectStore(PROJECT_MEMBERS_STORE);
    const [project, raw] = await Promise.all([
      promisifyRequest<unknown>(transaction.objectStore(PROJECTS_STORE).get(projectId)),
      promisifyRequest<unknown>(members.get(id)),
    ]);
    const migrated = raw === undefined ? null : migrateStoredRecord(raw, PROJECT_MEMBER_MIGRATIONS);
    const existing = migrated?.status === "migrated" ? migrated.record : undefined;
    if (project === undefined || (existing === undefined && !createsMembership) || (raw !== undefined && existing === undefined)) {
      await promisifyTransaction(transaction);
      return;
    }
    const applied = change(memberChangeTime(existing, now));
    const base = existing ?? { id, projectId, overviewId, removedAt: null };
    members.put(stampStoredRecord(mergeProjectMember(base, applied), CURRENT_PROJECT_MEMBER_SCHEMA_VERSION, now));
    const journaled = await appendPendingWrite(transaction, {
      kind: "projectMember",
      id,
      updatedAt: now.toISOString(),
      change: { op: "member", change: applied },
    });
    await this.#finish(transaction, journaled);
  }

  async #readAll(storeName: string): Promise<unknown[]> {
    const store = this.#db.transaction(storeName, "readonly").objectStore(storeName);
    return promisifyRequest<unknown[]>(store.getAll());
  }

  async #finish(transaction: IDBTransaction, journaled: boolean): Promise<void> {
    await promisifyTransaction(transaction);
    if (journaled) this.#onJournaled?.();
  }
}
