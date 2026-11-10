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
  output.keyPoints[0] = { ...output.keyPoints[0]!, startSegmentIndex: 28, endSegmentIndex: 30 };
  output.keyPoints[2] = { ...output.keyPoints[2]!, startSegmentIndex: 12, endSegmentIndex: 10 };

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
      standsOut: {
        text: "A worked budget.",
        startSegmentIndex: 5,
        endSegmentIndex: 99,
        quoteStartSegmentIndex: -1,
        quoteEndSegmentIndex: -1,
      },
    },
    watchAnyway: { answer: "partial", reason: "The demo is visual.", startSegmentIndex: 40, endSegmentIndex: 41 },
  });

  assert.deepEqual(failing(output), ["standsOutRangeInside", "watchAnywayRangeInside"]);
});

test("a key point over its 40 word target fails, though the schema allows 50", () => {
  const output = makeGeneratedOutput();
  output.keyPoints[1]!.text = Array(45).fill("word").join(" ");

  assert.deepEqual(failing(output), ["keyPointsWithinTarget"]);
});

test("in one line over its 25 word target fails, though the schema allows 35", () => {
  const output = makeGeneratedOutput({ inOneLine: Array(30).fill("word").join(" ") });

  assert.deepEqual(failing(output), ["inOneLineWithinTarget"]);
});

test("a big picture over its length's target fails, and a short video's is never counted, since code drops it", () => {
  const long = makeFetchedTranscript();
  long.transcript = long.transcript.map((segment, index) =>
    index === 0 ? { ...segment, text: `${segment.text} ${Array(4000).fill("word").join(" ")}` } : segment,
  );
  const sixty = makeGeneratedOutput({ bigPicture: Array(60).fill("word").join(" ") });
  const seventy = makeGeneratedOutput({ bigPicture: Array(70).fill("word").join(" ") });

  assert.deepEqual(failing(sixty, long), []);
  assert.deepEqual(failing(seventy, long), ["bigPictureWithinTarget"]);
  assert.deepEqual(failing(seventy), []);
});

test("a dubious claim or reason over its target fails", () => {
  const output = makeGeneratedOutput({
    verdict: {
      ...makeGeneratedOutput().verdict!,
      dubiousClaims: [{ claim: Array(26).fill("word").join(" "), basis: "contradictsSettled", reason: "Wrong.", segmentIndex: 2 }],
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
    keyPoints: makeGeneratedOutput().keyPoints.map((point) => ({ ...point, startSegmentIndex: -1, endSegmentIndex: -1 })),
    chapters: [{ title: "One idea", summary: "The whole clip.", startSegmentIndex: 0 }],
  });
  assert.deepEqual(failing(short, makeFetchedTranscript(6)), []);
});

const withQuote = (index: number, quote: { quoteStartSegmentIndex: number; quoteEndSegmentIndex: number }) => {
  const output = makeGeneratedOutput();
  output.keyPoints[index] = { ...output.keyPoints[index]!, ...quote };
  return output;
};

test("a quotation inside its own point's stretch passes, and one outside it or on a point with no stretch fails", () => {
  const point = makeGeneratedOutput().keyPoints[0]!;
  assert.deepEqual(
    failing(withQuote(0, { quoteStartSegmentIndex: point.startSegmentIndex, quoteEndSegmentIndex: point.startSegmentIndex })),
    [],
  );
  assert.deepEqual(
    failing(withQuote(0, { quoteStartSegmentIndex: point.endSegmentIndex + 1, quoteEndSegmentIndex: point.endSegmentIndex + 1 })),
    ["quotationsInsideTheirLine"],
  );
  const noStretch = withQuote(0, { quoteStartSegmentIndex: 1, quoteEndSegmentIndex: 1 });
  noStretch.keyPoints[0] = { ...noStretch.keyPoints[0]!, startSegmentIndex: -1, endSegmentIndex: -1 };
  assert.deepEqual(failing(noStretch), ["quotationsInsideTheirLine"]);
});

test("quoting more points than the budget allows fails", () => {
  const output = makeGeneratedOutput();
  const quoted = { ...output.keyPoints[0]!, startSegmentIndex: 3, endSegmentIndex: 5, quoteStartSegmentIndex: 4, quoteEndSegmentIndex: 4 };
  output.keyPoints = [quoted, quoted, quoted, quoted];
  assert.deepEqual(failing(output), ["quotationsWithinBudget"]);
});

test("a run from before quotations existed has none, and fails nothing for it", () => {
  const output = makeGeneratedOutput();
  output.keyPoints = output.keyPoints.map(
    ({ text, startSegmentIndex, endSegmentIndex }) => ({ text, startSegmentIndex, endSegmentIndex }) as never,
  );
  assert.deepEqual(failing(output), []);
});
