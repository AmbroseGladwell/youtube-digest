import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { tallyQuotations } from "./quotationsMarkdown.js";

const quoted = () => ({ text: "the words they said", range: { startMs: 0, endMs: 1000 } });

const overview = () => {
  const base = makeOverview();
  return {
    ...base,
    keyPoints: [{ ...base.keyPoints[0]!, evidence: quoted() }, { ...base.keyPoints[1]!, evidence: quoted() }, ...base.keyPoints.slice(2)],
  };
};

test("the tally counts quotations, the ones named but dropped, and the words they add to the spoken note", () => {
  const fetched = makeFetchedTranscript();
  const named = (index: number) => ({ quoteStartSegmentIndex: index, quoteEndSegmentIndex: index });
  const run = makeRunRecord({
    videoId: fetched.video.id ?? fetched.video.url,
    overview: overview(),
    attempts: [{ keyPoints: [named(1), named(2), named(3)] }],
  });
  const [tally] = tallyQuotations([run], new Map([[run.videoId, fetched]]));
  assert.equal(tally?.quoted, 2);
  assert.equal(tally?.named, 3);
  assert.equal(tally?.dropped, 1);
  assert.ok((tally?.addedWords ?? 0) > 0 && tally!.addedWords < tally!.spokenWords);
});
