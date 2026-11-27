import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TopicId } from "./Brands.js";
import { resolveTopicIds, withTopicAlias } from "./TopicAliases.js";

const topic = (): TopicId => TopicId.parse(randomUUID());

test("a merged topic resolves to the one it went into, once, and a deleted one is dropped", () => {
  const [kept, merged, deleted, other] = [topic(), topic(), topic(), topic()];

  assert.deepEqual(resolveTopicIds([merged, kept, deleted, other], { [merged]: kept, [deleted]: null }), [kept, other]);
});

test("an id with no alias is left as it is", () => {
  const id = topic();

  assert.deepEqual(resolveTopicIds([id], {}), [id]);
});

test("merging the kept topic later repoints what was merged into it, so resolving stays one step", () => {
  const [first, second, third] = [topic(), topic(), topic()];

  const aliases = withTopicAlias(withTopicAlias({}, first, second), second, third);

  assert.deepEqual(aliases, { [first]: third, [second]: third });
});

test("deleting a topic that others were merged into drops those too", () => {
  const [first, second] = [topic(), topic()];

  assert.deepEqual(withTopicAlias({ [first]: second }, second, null), { [first]: null, [second]: null });
});
