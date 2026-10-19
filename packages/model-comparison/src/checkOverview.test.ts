import test from "node:test";
import assert from "node:assert/strict";
import { checkOverview, unsupportedNumbers } from "./checkOverview.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeGeneratedOutput } from "./GeneratedOutputFactory.testHelper.js";

const failing = (output = makeGeneratedOutput(), fetched = makeFetchedTranscript()) =>
  checkOverview(output, fetched)
    .filter((check) => !check.passed)
    .map((check) => check.check);

test("an overview that keeps every rule passes every check", () => {
  assert.deepEqual(failing(), []);
});

test("a key point range past the last segment, or running backwards, fails", () => {
  const output = makeGeneratedOutput();
  output.keyPoints[0]!.range = { startSegmentIndex: 28, endSegmentIndex: 30 };
  output.keyPoints[2]!.range = { startSegmentIndex: 12, endSegmentIndex: 10 };

  const [check] = checkOverview(output, makeFetchedTranscript()).filter((result) => !result.passed);
  assert.equal(check?.check, "keyPointRangesInside");
  assert.match(check?.detail ?? "", /key point 1 ends at segment 30 of 30/);
  assert.match(check?.detail ?? "", /key point 3 runs backwards/);
});

test("a stands-out or watch-anyway range outside the transcript fails its own check", () => {
  const output = makeGeneratedOutput({
    verdict: {
      ...makeGeneratedOutput().verdict!,
      novelty: "fresh_angle",
      standsOut: { text: "A worked budget.", range: { startSegmentIndex: 5, endSegmentIndex: 99 } },
    },
    watchAnyway: { answer: "partial", reason: "The demo is visual.", range: { startSegmentIndex: 40, endSegmentIndex: 41 } },
  });

  assert.deepEqual(failing(output), ["standsOutRangeInside", "watchAnywayRangeInside"]);
});

test("a key point over its 40 word target fails, though the schema allows 50", () => {
  const output = makeGeneratedOutput();
  output.keyPoints[1]!.text = Array(45).fill("word").join(" ");

  assert.deepEqual(failing(output), ["keyPointsWithinTarget"]);
});

test("a dubious claim or reason over its target fails", () => {
  const output = makeGeneratedOutput({
    verdict: {
      ...makeGeneratedOutput().verdict!,
      dubiousClaims: [
        { claim: Array(26).fill("word").join(" "), basis: "contradictsSettled", reason: "Wrong.", segmentIndex: 2 },
      ],
    },
  });

  assert.deepEqual(failing(output), ["dubiousClaimsWithinTarget"]);
});

test("reasoning that opens with the novelty word fails, the prototype's parser bug", () => {
  const output = makeGeneratedOutput({
    verdict: { ...makeGeneratedOutput().verdict!, reasoning: "Common knowledge, well explained." },
  });

  assert.deepEqual(failing(output), ["reasoningDoesNotOpenWithNovelty"]);
});

test("a one-liner that opens with 'This video' or names the channel fails", () => {
  assert.deepEqual(failing(makeGeneratedOutput({ inOneLine: "This video tests a budget." })), ["inOneLineOpening"]);
  assert.deepEqual(failing(makeGeneratedOutput({ inOneLine: "Thrift Lab tests a budget." })), ["inOneLineOpening"]);
});

test("an em dash anywhere in the prose fails", () => {
  const output = makeGeneratedOutput();
  output.chapters[1]!.summary = "How the plan worked — mostly.";

  assert.deepEqual(failing(output), ["noEmDash"]);
});

test("a number the transcript, title and description never mention fails", () => {
  const output = makeGeneratedOutput({ coreClaim: "Planning meals cut the bill by 35% in 3 months." });

  const check = checkOverview(output, makeFetchedTranscript()).find((result) => result.check === "numbersInTranscript");
  assert.equal(check?.passed, false);
  assert.match(check?.detail ?? "", /^35 is not in/);
});

test("numbers match across thousands separators, and a part of a longer number is no match", () => {
  assert.deepEqual(unsupportedNumbers(["It cost 1200, then $1,200."], ["They paid $1,200."]), []);
  assert.deepEqual(unsupportedNumbers(["About 20 people."], ["It took 120 days, or 2.5 months."]), ["20"]);
  assert.deepEqual(unsupportedNumbers(["It took 2.5 months."], ["It took 2.5 months."]), []);
});

test("numbers auto-captions spell out, or give with a scale word, still count as said", () => {
  assert.deepEqual(unsupportedNumbers(["Five tips, 51,000 pounds, $1.5M."], ["five tips, 51 thousand pounds, 1.5 million"]), []);
  assert.deepEqual(unsupportedNumbers(["It took 40 days."], ["it took forty days"]), []);
  assert.deepEqual(unsupportedNumbers(["About 650 men."], ["about 600 men"]), ["650"]);
});

test("one chapter holding most of a long video fails; a short video may be one chapter", () => {
  const lopsided = makeGeneratedOutput({
    chapters: [
      { title: "Intro", summary: "Hello.", startSegmentIndex: 0 },
      { title: "Everything else", summary: "The rest.", startSegmentIndex: 2 },
    ],
  });
  assert.deepEqual(failing(lopsided), ["chaptersSpreadAcrossVideo"]);

  const short = makeGeneratedOutput({
    keyPoints: makeGeneratedOutput().keyPoints.map((point) => ({ ...point, range: null })),
    chapters: [{ title: "One idea", summary: "The whole clip.", startSegmentIndex: 0 }],
  });
  assert.deepEqual(failing(short, makeFetchedTranscript(6)), []);
});
