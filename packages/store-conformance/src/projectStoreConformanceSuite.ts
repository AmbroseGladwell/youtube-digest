import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OverviewId, ProjectId, type ProjectStore } from "@overview/domain";
import { makeProject } from "./makeProject.js";

const anOverviewId = () => OverviewId.parse(randomUUID());

export function defineProjectStoreConformanceSuite(label: string, createStore: () => ProjectStore | Promise<ProjectStore>): void {
  const behaviour = (description: string) => `${label} ProjectStore: ${description}`;

  test(behaviour("holds no projects and no members until one is made"), async () => {
    const store = await createStore();
    assert.deepEqual(await store.listProjects(), []);
    assert.deepEqual(await store.listMembers(), []);
  });

  test(behaviour("createProject() keeps the project, and creating it again changes nothing"), async () => {
    const store = await createStore();
    const project = makeProject();
    await store.createProject(project);
    await store.createProject({ ...project, name: "Something else" });
    assert.deepEqual(await store.listProjects(), [project]);
    assert.deepEqual(await store.getProject(project.id), project);
  });

  test(behaviour("getProject() of a project that isn't there is null"), async () => {
    const store = await createStore();
    assert.equal(await store.getProject(ProjectId.parse(randomUUID())), null);
  });

  test(behaviour("updateProject() changes only the fields it names"), async () => {
    const store = await createStore();
    const project = makeProject();
    await store.createProject(project);
    await store.updateProject(project.id, { archivedAt: "2026-11-12T10:00:00.000Z" });
    await store.updateProject(project.id, { name: "Kitchen" });
    assert.deepEqual(await store.getProject(project.id), { ...project, name: "Kitchen", archivedAt: "2026-11-12T10:00:00.000Z" });
  });

  test(behaviour("updateProject() of a project that isn't there does nothing"), async () => {
    const store = await createStore();
    await store.updateProject(ProjectId.parse(randomUUID()), { name: "Nothing" });
    assert.deepEqual(await store.listProjects(), []);
  });

  test(behaviour("an overview added to a project is listed as its member, by the reader"), async () => {
    const store = await createStore();
    const project = makeProject();
    const overviewId = anOverviewId();
    await store.createProject(project);
    await store.addToProject(project.id, overviewId);
    const [member, ...rest] = await store.listMembers();
    assert.deepEqual(rest, []);
    assert.equal(member?.projectId, project.id);
    assert.equal(member?.overviewId, overviewId);
    assert.deepEqual(member?.addedBy, { by: "reader" });
  });

  test(behaviour("adding the same overview twice lists it once"), async () => {
    const store = await createStore();
    const project = makeProject();
    const overviewId = anOverviewId();
    await store.createProject(project);
    await store.addToProject(project.id, overviewId);
    await store.addToProject(project.id, overviewId);
    assert.equal((await store.listMembers()).length, 1);
  });

  test(behaviour("one overview can be in several projects"), async () => {
    const store = await createStore();
    const [first, second] = [makeProject(), makeProject({ name: "Launching my app" })];
    const overviewId = anOverviewId();
    await store.createProject(first);
    await store.createProject(second);
    await store.addToProject(first.id, overviewId);
    await store.addToProject(second.id, overviewId);
    assert.deepEqual((await store.listMembers()).map(({ projectId }) => projectId).sort(), [first.id, second.id].sort());
  });

  test(behaviour("a removed overview is no longer listed, and adding it again brings it back"), async () => {
    const store = await createStore();
    const project = makeProject();
    const overviewId = anOverviewId();
    await store.createProject(project);
    await store.addToProject(project.id, overviewId);
    await store.removeFromProject(project.id, overviewId);
    assert.deepEqual(await store.listMembers(), []);
    await store.addToProject(project.id, overviewId);
    assert.equal((await store.listMembers()).length, 1);
  });

  test(behaviour("removing an overview that was never in the project does nothing"), async () => {
    const store = await createStore();
    const project = makeProject();
    await store.createProject(project);
    await store.removeFromProject(project.id, anOverviewId());
    assert.deepEqual(await store.listMembers(), []);
  });

  test(behaviour("adding to a project that isn't there does nothing"), async () => {
    const store = await createStore();
    await store.addToProject(ProjectId.parse(randomUUID()), anOverviewId());
    assert.deepEqual(await store.listMembers(), []);
  });

  test(
    behaviour("deleteProject() removes the project and every membership record in it, and leaves other projects' membership records"),
    async () => {
      const store = await createStore();
      const [doomed, kept] = [makeProject(), makeProject({ name: "Launching my app" })];
      const overviewId = anOverviewId();
      await store.createProject(doomed);
      await store.createProject(kept);
      await store.addToProject(doomed.id, overviewId);
      await store.addToProject(kept.id, overviewId);
      await store.deleteProject(doomed.id);
      assert.deepEqual(await store.listProjects(), [kept]);
      assert.deepEqual(
        (await store.listMembers()).map(({ projectId }) => projectId),
        [kept.id],
      );
    },
  );
}
