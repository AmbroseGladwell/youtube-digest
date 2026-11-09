import test from "node:test";
import assert from "node:assert/strict";
import { bigPictureMarkdown } from "./bigPictureMarkdown.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import type { BigPictureJudgeRecord } from "./judgeBigPicture.js";
import { bigPictureJudgePrompt } from "./judgeBigPicture.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";

const longVideo = (id: string) => {
  const fetched = makeFetchedTranscript(30, { id: id as never, title: `Video ${id}` });
  fetched.transcript[0] = { ...fetched.transcript[0]!, text: Array(2000).fill("word").join(" ") };
  return fetched;
};

const judgment = (videoId: string, deletion: "loses-something" | "loses-nothing"): BigPictureJudgeRecord => ({
  videoId,
  writer: "anthropic:claude-opus-5-5",
  judge: "openai:gpt-6.1-sol",
  judgedAt: "2026-11-09T00:00:00.000Z",
  outcome: "judged",
  error: null,
  labels: {
    reason: "Because.",
    deletion,
    namesTheQuestion: true,
    namesAnotherThread: deletion === "loses-something",
    describesTheSource: false,
  },
  calls: [],
  latencyMs: 0,
  costDollars: 0,
});

test("reports the deletion test's pass rate over the big pictures written, and counts a short video as earning none", () => {
  const byVideo = new Map([
    ["a", longVideo("a")],
    ["b", longVideo("b")],
    ["short", makeFetchedTranscript(30, { id: "short" as never })],
  ]);
  const withGround = { ...makeOverview(), bigPicture: "Some ground worth having." };
  const runs = [
    makeRunRecord({ videoId: "a", overview: withGround }),
    makeRunRecord({ videoId: "b", overview: withGround }),
    makeRunRecord({ videoId: "short", overview: makeOverview() }),
  ];

  const markdown = bigPictureMarkdown(runs, [judgment("a", "loses-something"), judgment("b", "loses-nothing")], byVideo, "ov-225");

  assert.match(markdown, /Notes: 3, of which 1 too short to earn a big picture/);
  assert.match(markdown, /Earned one and wrote one: 2\/2 \(100%\)/);
  assert.match(markdown, /Passes the deletion test: 1\/2 \(50%\)/);
  assert.match(markdown, /Names another thread: 1\/2 \(50%\)/);
});

test("the judge sees the three fields and nothing that says which model wrote them", () => {
  const { userMessage } = bigPictureJudgePrompt({ inOneLine: "The label.", bigPicture: "The ground.", coreClaim: "The answer." });

  assert.equal(userMessage, "In one line: The label.\n\nBig picture: The ground.\n\nCore claim: The answer.");
});
