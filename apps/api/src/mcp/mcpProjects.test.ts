import test from "node:test";
import assert from "node:assert/strict";
import { CURRENT_SCHEMA_VERSIONS, projectMemberId } from "@overview/domain";
import { makeProject } from "@overview/store-conformance";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { sampleLibrary, type SampleLibrary } from "../testing/sampleLibrary.testHelper.js";
import { storedOverview, UPDATED_AT } from "../testing/storedRecords.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { connectMcpClient, seedLibrary, type McpClient } from "./McpClient.testHelper.js";
import { OVERVIEWS_PER_MARK } from "./markOverviews.js";
import { PROJECT_PAGE_SIZE } from "./getProject.js";

interface Connected {
  testApp: TestApp;
  reader: TestAccount;
  library: SampleLibrary;
  client: McpClient;
}

async function connected(scope?: string): Promise<Connected> {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);
  const library = sampleLibrary();
  await seedLibrary(reader, library);
  return { testApp, reader, library, client: await connectMcpClient(testApp, reader, scope) };
}

async function readerProject(reader: TestAccount, overrides: Record<string, unknown> = {}) {
  const project = { ...makeProject(), schemaVersion: CURRENT_SCHEMA_VERSIONS.project, updatedAt: UPDATED_AT, ...overrides };
  const response = await reader.inject({ method: "POST", url: "/api/projects", body: project });
  assert.equal(response.statusCode, 201, response.body);
  return project;
}

async function readerAdds(reader: TestAccount, projectId: string, overviewIds: string[]) {
  for (const overviewId of overviewIds) {
    const response = await reader.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/members/${overviewId}`,
      body: { addedAt: UPDATED_AT, updatedAt: UPDATED_AT },
    });
    assert.equal(response.statusCode, 200, response.body);
  }
}

const ids = (library: SampleLibrary) => library.notes.map(({ overview }) => overview.id);

const liveMembers = async (reader: TestAccount) =>
  (await reader.changes()).changes.filter((change) => change.kind === "projectMember" && !change.deleted);

test("list_projects with no projects says so, and says how one gets made for the connection it is", async () => {
  const writing = await connected();
  const reading = await connected("overviews:read");

  const canWrite = await writing.client.callTool("list_projects");
  const readOnly = await reading.client.callTool("list_projects");

  assert.match(canWrite.text, /^The reader has no projects yet\. When the reader asks, create_project/);
  assert.match(readOnly.text, /^The reader has no projects yet\. The reader can make one in the app\./);
  await writing.testApp.close();
  await reading.testApp.close();
});

test("list_projects gives each active project's purpose, counts and verdict spread, and leaves archived ones out until asked", async () => {
  const { testApp, reader, library, client } = await connected();
  const active = await readerProject(reader);
  const archived = await readerProject(reader, { name: "Old launch", archivedAt: "2026-11-01T00:00:00.000Z" });
  await readerAdds(reader, active.id, ids(library).slice(0, 3));

  const activeOnly = await client.callTool("list_projects");
  const everything = await client.callTool("list_projects", { archived: true });

  assert.match(activeOnly.text, /^1 project\(s\), active only:/);
  assert.ok(activeOnly.text.includes(`**Kitchen renovation** · id ${active.id}`));
  assert.ok(activeOnly.text.includes("Purpose: Choosing a layout"));
  assert.match(activeOnly.text, /3 overview\(s\) · 3 unread · .* · last changed \d{4}-\d{2}-\d{2} · made by the reader/);
  assert.ok(activeOnly.text.includes("1 archived project(s) left out"));
  assert.ok(!activeOnly.text.includes(archived.id));
  assert.match(everything.text, /^2 project\(s\):/);
  assert.ok(everything.text.includes(`**Old launch** (archived) · id ${archived.id}`));
  await testApp.close();
});

test("get_project reads a project as a brief: purpose, counts and its overviews' How to apply steps", async () => {
  const { testApp, reader, library, client } = await connected();
  const project = await readerProject(reader);
  const withSteps = library.notes.find(({ overview }) => (overview.howToApply?.items.length ?? 0) > 0)!.overview;
  await readerAdds(reader, project.id, [withSteps.id]);

  const byName = await client.callTool("get_project", { project: "kitchen RENOVATION " });
  const byId = await client.callTool("get_project", { project: project.id });

  assert.equal(byName.isError, false);
  assert.equal(byName.text, byId.text);
  assert.match(byName.text, /^# Kitchen renovation\n\nPurpose: Choosing a layout/);
  assert.ok(byName.text.includes(`### ${withSteps.source.title} (id ${withSteps.id})\n- ${withSteps.howToApply!.items[0]}`));
  await testApp.close();
});

test("get_project of a project that isn't there, or a name two projects share, is a failed call that says what to do", async () => {
  const { testApp, reader, client } = await connected();
  const [first, second] = [await readerProject(reader, { name: "Launch" }), await readerProject(reader, { name: "launch" })];

  const unknown = await client.callTool("get_project", { project: "Garden" });
  const ambiguous = await client.callTool("get_project", { project: "Launch" });

  assert.equal(unknown.isError, true);
  assert.match(unknown.text, /list_projects names every project/);
  assert.equal(ambiguous.isError, true);
  assert.ok(ambiguous.text.includes(first.id) && ambiguous.text.includes(second.id));
  assert.match(ambiguous.text, /Pass the id instead/);
  await testApp.close();
});

test("get_project pages a large project, counting all of it on every page", async () => {
  const testApp = await createTestApp();
  const reader = await makeAccount(testApp);
  const client = await connectMcpClient(testApp, reader);
  const project = await readerProject(reader);
  const overviewIds: string[] = [];
  for (let index = 0; index < PROJECT_PAGE_SIZE + 2; index += 1) {
    const overview = storedOverview();
    await reader.inject({ method: "POST", url: "/api/overviews", body: overview });
    overviewIds.push(overview.id);
  }
  await readerAdds(reader, project.id, overviewIds);

  const first = await client.callTool("get_project", { project: project.id });
  const second = await client.callTool("get_project", { project: project.id, cursor: String(PROJECT_PAGE_SIZE) });

  assert.ok(first.text.includes(`${PROJECT_PAGE_SIZE + 2} overview(s)`));
  assert.ok(first.text.includes(`More remain: call again with cursor "${PROJECT_PAGE_SIZE}".`));
  assert.ok(second.text.includes(`These are overviews ${PROJECT_PAGE_SIZE + 1}–${PROJECT_PAGE_SIZE + 2} of ${PROJECT_PAGE_SIZE + 2}.`));
  const listed = (text: string) => [...text.matchAll(/ · id (\S+)\)/g)].map((match) => match[1]);
  assert.equal(new Set([...listed(first.text), ...listed(second.text)]).size, PROJECT_PAGE_SIZE + 2);
  await testApp.close();
});

test("search_overviews and get_overviews take a project, and an unknown one points at list_projects", async () => {
  const { testApp, reader, library, client } = await connected();
  const project = await readerProject(reader);
  const [inside, removed] = ids(library);
  await readerAdds(reader, project.id, [inside!, removed!]);
  await reader.inject({
    method: "PUT",
    url: `/api/projects/${project.id}/members/${removed}`,
    body: { removedAt: "2026-11-12T12:00:00.000Z", updatedAt: UPDATED_AT },
  });

  const searched = await client.callTool("search_overviews", { project: "Kitchen renovation" });
  const read = await client.callTool("get_overviews", { project: project.id });
  const unknown = await client.callTool("search_overviews", { project: "Garden" });

  assert.match(searched.text, /^1 saved overview\(s\) match\./);
  assert.ok(searched.text.includes(`id ${inside}`));
  assert.ok(read.text.includes(`Overview id: ${inside}`));
  assert.ok(!read.text.includes(`Overview id: ${removed}`));
  assert.equal(unknown.isError, true);
  assert.match(unknown.text, /list_projects/);
  await testApp.close();
});

test("create_project makes a project and its first overviews, marked as this assistant's, which the reader's devices sync", async () => {
  const { testApp, reader, library, client } = await connected();
  const [first, second] = ids(library);
  const elsewhere = storedOverview().id;

  const result = await client.callTool("create_project", {
    name: "Launching my app",
    purpose: "Getting the first hundred users for a reading app.",
    ids: [first, second, elsewhere],
  });

  assert.equal(result.isError, false);
  assert.match(result.text, /^Made the project "Launching my app" \(id \S+\)\.\nAdded 2 overview\(s\):/);
  assert.ok(result.text.includes(`Not in this library, so not added: ${elsewhere}.`));
  const changes = (await reader.changes()).changes;
  const project = changes.find((change) => change.kind === "project")!;
  assert.deepEqual(project.body!.createdBy, {
    by: "assistant",
    connectionId: (project.body!.createdBy as { connectionId: string }).connectionId,
    name: "Claude",
  });
  assert.equal(project.body!.purpose, "Getting the first hundred users for a reading app.");
  const members = changes.filter((change) => change.kind === "projectMember");
  assert.deepEqual(
    members.map((change) => change.id).sort(),
    [projectMemberId(project.id, first!), projectMemberId(project.id, second!)].sort(),
  );
  for (const member of members) assert.equal((member.body!.addedBy as { name: string }).name, "Claude");
  await testApp.close();
});

test("create_project with no purpose leaves it empty rather than inventing one, and a name already taken is refused", async () => {
  const { testApp, reader, client } = await connected();
  const existing = await readerProject(reader);

  const plain = await client.callTool("create_project", { name: "Garden" });
  const taken = await client.callTool("create_project", { name: "kitchen renovation" });

  assert.match(plain.text, /with no purpose: the reader can add one in the app\./);
  const garden = (await reader.changes()).changes.find((change) => change.kind === "project" && change.body!.name === "Garden")!;
  assert.equal(garden.body!.purpose, null);
  assert.equal(taken.isError, true);
  assert.ok(taken.text.includes(existing.id));
  assert.match(taken.text, /change_project_members/);
  await testApp.close();
});

test("change_project_members adds and takes out, says what was already so, and writes nothing for it", async () => {
  const { testApp, reader, library, client } = await connected();
  const project = await readerProject(reader);
  const [kept, leaving, joining, never] = ids(library);
  await readerAdds(reader, project.id, [kept!, leaving!]);
  const before = (await reader.changes()).next;

  const result = await client.callTool("change_project_members", {
    project: "Kitchen renovation",
    add: [joining, kept],
    remove: [leaving, never],
  });

  assert.equal(result.isError, false);
  assert.match(result.text, /^Added 1 overview\(s\) to "Kitchen renovation":/);
  assert.match(result.text, /Took 1 overview\(s\) out of "Kitchen renovation":/);
  assert.match(result.text, /Already in it, left as they were:/);
  assert.match(result.text, /Not in it, so nothing to take out:/);
  const written = (await reader.changes(before)).changes;
  assert.deepEqual(
    written.map((change) => change.id).sort(),
    [projectMemberId(project.id, joining!), projectMemberId(project.id, leaving!)].sort(),
  );
  const gone = written.find((change) => change.id === projectMemberId(project.id, leaving!))!;
  assert.equal(typeof gone.body!.removedAt, "string");
  assert.deepEqual((await liveMembers(reader)).filter((change) => change.body!.removedAt === null).length, 2);
  await testApp.close();
});

test("an overview the assistant takes out can be put back by the reader, and the later act wins", async () => {
  const { testApp, reader, library, client } = await connected();
  const project = await readerProject(reader);
  const [overviewId] = ids(library);
  await readerAdds(reader, project.id, [overviewId!]);
  await client.callTool("change_project_members", { project: project.id, remove: [overviewId] });

  await reader.inject({
    method: "PUT",
    url: `/api/projects/${project.id}/members/${overviewId}`,
    body: { addedAt: new Date(Date.now() + 60_000).toISOString(), updatedAt: UPDATED_AT },
  });

  const searched = await client.callTool("search_overviews", { project: project.id });
  assert.match(searched.text, /^1 saved overview\(s\) match\./);
  await testApp.close();
});

test("change_project_members needs something to change, at most the cap, and ids from this library", async () => {
  const { testApp, reader, client } = await connected();
  await readerProject(reader);
  const tooMany = Array.from({ length: OVERVIEWS_PER_MARK + 1 }, () => storedOverview().id);

  const nothing = await client.callTool("change_project_members", { project: "Kitchen renovation" });
  const over = await client.callTool("change_project_members", { project: "Kitchen renovation", add: tooMany });
  const strangers = await client.callTool("change_project_members", { project: "Kitchen renovation", add: [storedOverview().id] });

  for (const result of [nothing, over, strangers]) assert.equal(result.isError, true);
  assert.match(strangers.text, /search_overviews gives each overview's id/);
  assert.deepEqual(await liveMembers(reader), []);
  await testApp.close();
});

test("a connection approved to read only can list and read projects, but is offered neither write tool", async () => {
  const { testApp, reader, library, client } = await connected("overviews:read");
  const project = await readerProject(reader);

  const { tools } = (await client.request("tools/list")) as { tools: Array<{ name: string }> };
  const refused = await client.callTool("change_project_members", { project: project.id, add: [ids(library)[0]] });
  const read = await client.callTool("get_project", { project: project.id });

  const offered = tools.map((tool) => tool.name);
  assert.ok(offered.includes("list_projects") && offered.includes("get_project"));
  assert.ok(!offered.includes("create_project") && !offered.includes("change_project_members"));
  assert.equal(refused.isError, true);
  assert.match(refused.text, /Settings › Connections/);
  assert.equal(read.isError, false);
  assert.deepEqual(await liveMembers(reader), []);
  await testApp.close();
});

test("the server's instructions point at projects, and project_brief asks for the brief, the notes and the purpose", async () => {
  const { testApp, client } = await connected();

  const { instructions } = (await client.request("initialize", { protocolVersion: "2025-06-18", capabilities: {} })) as {
    instructions: string;
  };
  const { prompts } = (await client.request("prompts/list")) as { prompts: Array<{ name: string }> };
  const brief = (await client.request("prompts/get", { name: "project_brief", arguments: { project: "Kitchen renovation" } })) as {
    messages: Array<{ content: { text: string } }>;
  };

  assert.match(instructions, /list_projects/);
  assert.match(instructions, /create_project/);
  assert.ok(prompts.some((prompt) => prompt.name === "project_brief"));
  const text = brief.messages[0]!.content.text;
  assert.match(text, /get_project/);
  assert.match(text, /get_overviews \(project: "Kitchen renovation"\)/);
  assert.match(text, /If it has no purpose, ask me what it is for first/);
  await testApp.close();
});
