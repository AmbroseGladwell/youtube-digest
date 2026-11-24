import test from "node:test";
import assert from "node:assert/strict";
import type { ChatSource, Overview, OverviewId, Project, ProjectId, Topic, TopicId } from "@overview/domain";
import { makeOverview, makeProject } from "@overview/store-conformance";
import { otherSourcesInPrompt } from "./otherSourcesInPrompt.js";

const titled = (title: string): Overview => {
  const overview = makeOverview();
  return { ...overview, source: { ...overview.source, title } };
};
const plants = titled("Eat more plants");
const sleep = titled("Sleep first");
const source = (label: string, overview: Overview, fields: Partial<ChatSource> = {}): ChatSource => ({
  label,
  overviewId: overview.id as OverviewId,
  title: overview.source.title,
  how: "found",
  ...fields,
});
const overviews = new Map([plants, sleep].map((overview) => [overview.id as string, overview]));

test("the first block carries the rules, a later one only says it adds more, and items carry their label", () => {
  const { blocks, labels } = otherSourcesInPrompt(
    [
      { sources: [source("S1", plants)], setAside: [] },
      { sources: [], setAside: [] },
      { sources: [source("S2", sleep)], setAside: [] },
    ],
    overviews,
    new Map(),
  );
  assert.match(blocks[0]!, /^# Other overviews from the reader's library\n\nThe reader saved these too\./);
  assert.match(blocks[0]!, /\[S1\.kp1\] /);
  assert.equal(blocks[1], null);
  assert.match(blocks[2]!, /^# More overviews from the reader's library\n\nAdded for this question, labelled and cited as before\./);
  assert.doesNotMatch(blocks[2]!, /When two of them disagree/);
  assert.deepEqual([...labels.keys()], ["S1", "S2"]);
});

test("an overview deleted since is left out and can't be cited, and the next block that shows one still carries the rules", () => {
  const gone = titled("Deleted since");
  const { blocks, labels } = otherSourcesInPrompt(
    [
      { sources: [source("S1", gone)], setAside: [] },
      { sources: [source("S2", plants)], setAside: [] },
    ],
    overviews,
    new Map(),
  );
  assert.equal(blocks[0], null);
  assert.match(blocks[1]!, /^# Other overviews from the reader's library/);
  assert.deepEqual([...labels.keys()], ["S2"]);
});

test("a set-aside overview is named by its title in its own line and is no longer citable", () => {
  const { blocks, labels } = otherSourcesInPrompt(
    [
      { sources: [source("S1", plants), source("S2", sleep)], setAside: [] },
      { sources: [], setAside: ["S1", "S2"] },
    ],
    overviews,
    new Map(),
  );
  assert.equal(
    blocks[1],
    "The reader set aside S1 (Eat more plants) and S2 (Sleep first) from this conversation. Don't use or cite them from here on.",
  );
  assert.equal(labels.size, 0);
});

test("pins are named, and a pinned project leads with its name and purpose and lists the rest in brief", () => {
  const project: Project = { ...makeProject({ name: "Healthy eating" }), purpose: "Eat better at home" };
  const projectId = project.id as ProjectId;
  const { blocks } = otherSourcesInPrompt(
    [
      {
        sources: [
          source("S1", sleep, { how: "pinned" }),
          source("S2", plants, { how: "pinned", projectId }),
          source("S3", sleep, { how: "pinned", projectId, brief: true }),
        ],
        setAside: [],
      },
    ],
    overviews,
    new Map([[project.id as string, project]]),
  );
  const block = blocks[0]!;
  assert.match(block, /The reader pinned S1 to this conversation with "@"\./);
  assert.match(
    block,
    /The reader pinned their project "Healthy eating" to this conversation, which they keep for this: "Eat better at home"\. Its overviews are S2 and S3\. The one closest to the question \(S2\) is given in full/,
  );
  assert.match(block, /# The rest of "Healthy eating", in brief\n\n## \[S3\] Sleep first/);
  assert.equal(block.match(/^## S\d+$/gm)?.length, 2);
});

test("a pinned topic leads with its name and lists the rest in brief, as a project does", () => {
  const topicId = "33333333-3333-4333-8333-333333333333" as TopicId;
  const topic: Topic = { id: topicId, name: "Cooking", description: null, createdAt: "2026-09-01" };
  const { blocks } = otherSourcesInPrompt(
    [
      {
        sources: [source("S1", plants, { how: "pinned", topicId }), source("S2", sleep, { how: "pinned", topicId, brief: true })],
        setAside: [],
      },
    ],
    overviews,
    new Map(),
    new Map([[topicId as string, topic]]),
  );
  const block = blocks[0]!;
  assert.match(block, /The reader pinned their topic "Cooking" to this conversation\. Its overviews are S1 and S2\. The one closest/);
  assert.match(block, /# The rest of the topic "Cooking", in brief\n\n## \[S2\] Sleep first/);
  assert.doesNotMatch(block, /with "@"/);
});
