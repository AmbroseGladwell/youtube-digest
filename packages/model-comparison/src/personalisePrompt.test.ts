import test from "node:test";
import assert from "node:assert/strict";
import { personalisePrompt, personalisedOverview, sharedPartOf } from "./personalisePrompt.js";
import { readerProfileOf } from "./ReaderProfile.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

const profile = readerProfileOf([
  { title: "Minimalist money rules", topic: "finance", claim: "Spend less than you earn.", tags: ["budgeting", "saving"] },
  { title: "Massive arms", topic: "fitness", claim: "Add sets, not weight.", tags: ["arms"] },
]);
const fetched = makeFetchedTranscript();
const shared = makeOverview();

const validOutput = {
  howToApply: { items: ["Plan next week's meals on Sunday."] },
  matchedTopicNames: ["Finance"],
  suggestedTopic: null,
  tags: ["budgeting", "groceries", "meal-planning"],
  similarToIndices: [0, 0],
};

test("the personal pass from the note never sees the transcript, and the other one does", () => {
  const fromNote = personalisePrompt(fetched, profile, shared, false);
  const withTranscript = personalisePrompt(fetched, profile, shared, true);

  assert.doesNotMatch(fromNote.userMessage, /We spent \$1,200 a month before/);
  assert.match(withTranscript.userMessage, /\[4\] We spent \$1,200 a month before/);
  assert.match(fromNote.userMessage, /Planning meals cut the grocery bill/);
});

test("the shared note it is given carries nothing personal", () => {
  const prompt = personalisePrompt(fetched, profile, shared, false);

  assert.doesNotMatch(prompt.userMessage, /Plan a week of meals before shopping/);
  assert.match(prompt.systemPrompt, /About the reader, for fit: A UK parent/);
  assert.match(prompt.systemPrompt, /0\. Minimalist money rules: Spend less than you earn\./);
});

test("the schema accepts only the reader's own topics and past claims", () => {
  const { schema } = personalisePrompt(fetched, profile, shared, false);

  assert.equal(schema.safeParse(validOutput).success, true);
  assert.equal(schema.safeParse({ ...validOutput, matchedTopicNames: ["Cooking"] }).success, false);
  assert.equal(schema.safeParse({ ...validOutput, similarToIndices: [2] }).success, false);
});

test("the personal parts are laid over the shared note, resolved the way production resolves them", () => {
  const overview = personalisedOverview(shared, profile, validOutput);

  assert.deepEqual(overview.howToApply, { items: ["Plan next week's meals on Sunday."] });
  assert.deepEqual(overview.topicIds, [profile.existingTopics[0]!.id]);
  assert.deepEqual(overview.tags, ["budgeting", "groceries", "meal-planning"]);
  assert.deepEqual(overview.verdict?.similarTo, [{ overviewId: profile.pastClaims[0]!.overviewId, title: "Minimalist money rules" }]);
  assert.equal(overview.coreClaim, shared.coreClaim);
  assert.deepEqual(overview.chapters, shared.chapters);
});

test("stripping the personal parts keeps everything the video alone decides", () => {
  const stripped = sharedPartOf(shared);

  assert.equal(stripped.howToApply, null);
  assert.deepEqual(stripped.tags, []);
  assert.equal(stripped.verdict?.novelty, shared.verdict?.novelty);
  assert.deepEqual(stripped.keyPoints, shared.keyPoints);
});
