import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ProjectId, type SuggestedQuestion, type SuggestedQuestionScope } from "@overview/domain";
import { allocateQuestionSlots, isUsedUp } from "./allocateQuestionSlots.js";

const NOW = new Date("2026-11-23T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString();
const LIBRARY: SuggestedQuestionScope = { kind: "library" };
const project = (): SuggestedQuestionScope => ({ kind: "project", projectId: ProjectId.parse(randomUUID()) });

const question = (scope: SuggestedQuestionScope, overrides: Partial<SuggestedQuestion> = {}): SuggestedQuestion => ({
  id: randomUUID(),
  scope,
  overviewIds: [randomUUID(), randomUUID()] as never,
  text: "Does one survive the other?",
  madeAt: ago(100),
  shownAt: null,
  askedAt: null,
  dismissedAt: null,
  feedback: null,
  ...overrides,
});

test("a question is used up once asked, dismissed, marked obvious, or shown more than three days ago", () => {
  assert.equal(isUsedUp(question(LIBRARY), NOW), false);
  assert.equal(isUsedUp(question(LIBRARY, { askedAt: ago(1) }), NOW), true);
  assert.equal(isUsedUp(question(LIBRARY, { dismissedAt: ago(1) }), NOW), true);
  assert.equal(isUsedUp(question(LIBRARY, { feedback: { verdict: "obvious", at: ago(1) } }), NOW), true);
  assert.equal(isUsedUp(question(LIBRARY, { feedback: { verdict: "glad", at: ago(1) } }), NOW), false);
  assert.equal(isUsedUp(question(LIBRARY, { shownAt: ago(71) }), NOW), false);
  assert.equal(isUsedUp(question(LIBRARY, { shownAt: ago(73) }), NOW), true);
});

test("an empty library takes three, and each project two, most recently opened first, up to six in all", () => {
  const [first, second, third] = [project(), project(), project()];
  assert.deepEqual(
    allocateQuestionSlots([], [first, second, third], NOW).map((slots) => [slots.scope, slots.slots]),
    [
      [LIBRARY, 3],
      [first, 2],
      [second, 1],
    ],
  );
});

test("a library holding six unused questions takes none, and the projects share the six", () => {
  const unused = Array.from({ length: 6 }, () => question(LIBRARY));
  const [first, second, third, fourth] = [project(), project(), project(), project()];
  assert.deepEqual(
    allocateQuestionSlots(unused, [first, second, third, fourth], NOW).map((slots) => [slots.scope, slots.slots]),
    [
      [first, 2],
      [second, 2],
      [third, 2],
    ],
  );
});

test("used-up questions free their slots, and a project holding four unused takes none", () => {
  const full = project();
  const library = [
    ...Array.from({ length: 4 }, () => question(LIBRARY)),
    question(LIBRARY, { askedAt: ago(1) }),
    question(LIBRARY, { shownAt: ago(100) }),
  ];
  const projectQuestions = Array.from({ length: 4 }, () => question(full));
  assert.deepEqual(
    allocateQuestionSlots([...library, ...projectQuestions], [full], NOW).map((slots) => [slots.scope, slots.slots]),
    [[LIBRARY, 2]],
  );
});

test("nothing free allocates nothing", () => {
  const library = Array.from({ length: 6 }, () => question(LIBRARY));
  assert.deepEqual(allocateQuestionSlots(library, [], NOW), []);
});
