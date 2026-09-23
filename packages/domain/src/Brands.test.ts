import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OverviewId, TopicId } from "./Brands.js";

test("both id types reject a non-uuid string", () => {
  assert.equal(OverviewId.safeParse("not-a-uuid").success, false);
  assert.equal(TopicId.safeParse("not-a-uuid").success, false);
});

test("an OverviewId and a TopicId are not interchangeable, even though both are uuids", () => {
  const sameUuid = randomUUID();
  const overviewId = OverviewId.parse(sameUuid);
  const topicId = TopicId.parse(sameUuid);

  const takesOverviewId = (id: OverviewId) => id;

  takesOverviewId(overviewId);
  // @ts-expect-error - a TopicId must not satisfy an OverviewId, even carrying the same value
  takesOverviewId(topicId);

  // @ts-expect-error - a bare string, uuid-shaped or not, must not satisfy OverviewId directly
  const bareString: OverviewId = sameUuid;
  void bareString;
});
