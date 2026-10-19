import test from "node:test";
import assert from "node:assert/strict";
import { VideoId } from "@overview/domain";
import { blindPairSet, blindPick, isInSet, nextBlindPair } from "./nextBlindPair.js";
import type { JudgingPair } from "./runJudging.js";
import type { JudgeRecord } from "./JudgeRecord.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

const overview = makeOverview();
const pairOf = (videoId: string, candidate: string): JudgingPair => ({
  fetched: makeFetchedTranscript(10, { id: VideoId.parse(videoId) }),
  baseline: { name: "anthropic:claude-opus-5-5", overview },
  candidate: { name: candidate, overview },
});
const pairs = [pairOf("a", "openai:gpt-6-luna"), pairOf("b", "openai:gpt-6-luna"), pairOf("a", "gemini:gemini-3.8-flash")];
const judgedOn = (videoId: string, candidate: string) => ({ videoId, candidate, outcome: "judged" }) as JudgeRecord;

test("a pair already picked is never shown again, and none is left once every pair is picked", () => {
  const picks = pairs.slice(0, 2).map((pair) => blindPick(pair, true, "A", "now"));

  assert.equal(nextBlindPair(pairs, picks, [])?.candidate.name, "gemini:gemini-3.8-flash");
  assert.equal(nextBlindPair(pairs, pairs.map((pair) => blindPick(pair, true, "A", "now")), []), null);
});

test("pairs the judge has decided are shown first, so picks can be compared with it", () => {
  for (const roll of [0, 0.5, 0.99]) {
    const next = nextBlindPair(pairs, [], [judgedOn("b", "openai:gpt-6-luna")], () => roll);
    assert.equal(next?.fetched.video.id, "b");
  }
});

test("a choice of A or B becomes the candidate's win or loss by the side it was shown on", () => {
  const pair = pairs[0]!;
  assert.equal(blindPick(pair, true, "A", "now").result, "win");
  assert.equal(blindPick(pair, false, "A", "now").result, "loss");
  assert.equal(blindPick(pair, false, "B", "now").result, "win");
  assert.equal(blindPick(pair, true, "tie", "now").result, "tie");
});

test("a blind set keeps to the named candidates, is capped, and is the same set every time", () => {
  const many = ["a", "b", "c", "d", "e", "f"].flatMap((video) => [pairOf(video, "openai:gpt-6.1-sol"), pairOf(video, "openai:gpt-6-luna")]);

  const set = blindPairSet(many, { candidates: ["openai:gpt-6.1-sol"], limit: 4 });

  assert.equal(set.length, 4);
  assert.ok(set.every((pair) => pair.candidate.name === "openai:gpt-6.1-sol"));
  assert.deepEqual(
    blindPairSet([...many].reverse(), { candidates: ["openai:gpt-6.1-sol"], limit: 4 }).map((pair) => pair.fetched.video.id),
    set.map((pair) => pair.fetched.video.id),
  );
  assert.equal(blindPairSet(many, {}).length, many.length);
});

test("only picks within the set count towards its progress", () => {
  const set = [pairOf("a", "openai:gpt-6.1-sol")];

  assert.equal(isInSet(set, blindPick(set[0]!, true, "A", "now")), true);
  assert.equal(isInSet(set, blindPick(pairOf("a", "openai:gpt-6-luna"), true, "A", "now")), false);
});
