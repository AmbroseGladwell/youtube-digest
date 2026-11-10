import test from "node:test";
import assert from "node:assert/strict";
import { quoteAddsJudgePrompt, quotedLinesOf } from "./judgeQuoteAdds.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { tallyQuotations } from "./quotationsMarkdown.js";

const quoted = (adds: string | null) => ({ text: "the words they said", range: { startMs: 0, endMs: 1000 }, adds });

const overview = () => {
  const base = makeOverview();
  return {
    ...base,
    keyPoints: [
      { ...base.keyPoints[0]!, evidence: quoted("They hedge it.") },
      { ...base.keyPoints[1]!, evidence: quoted(null) },
      ...base.keyPoints.slice(2),
    ],
  };
};

test("only quotations with an added line go to the judge, numbered with their point and words", () => {
  const lines = quotedLinesOf(overview());
  assert.equal(lines.length, 1);
  assert.match(
    quoteAddsJudgePrompt(lines).userMessage,
    /^1\. Key point: .+\nQuotation: “the words they said”\nWhat it adds: They hedge it\.$/,
  );
});

test("the tally counts quotations, the ones named but dropped, and the words they add to the spoken note", () => {
  const fetched = makeFetchedTranscript();
  const named = (index: number) => ({ quoteStartSegmentIndex: index, quoteEndSegmentIndex: index });
  const run = makeRunRecord({
    videoId: fetched.video.id ?? fetched.video.url,
    overview: overview(),
    attempts: [{ keyPoints: [named(1), named(2), named(3)] }],
  });
  const [tally] = tallyQuotations([run], [], new Map([[run.videoId, fetched]]));
  assert.equal(tally?.quoted, 2);
  assert.equal(tally?.named, 3);
  assert.equal(tally?.dropped, 1);
  assert.equal(tally?.withAdds, 1);
  assert.ok((tally?.addedWords ?? 0) > 0 && tally!.addedWords < tally!.spokenWords);
});
