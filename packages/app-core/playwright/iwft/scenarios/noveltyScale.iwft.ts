import { NOVELTY_BASIS, VideoId } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("freshAngleVid1");
const SEGMENTS = [
  ...makeCaptionRun(["The usual advice,", "said the usual way."], { startMs: 0, cueMs: 3500 }),
  ...makeCaptionRun(["Here is the spreadsheet,", "year by year."], { startMs: 65_000, cueMs: 4000 }),
];

test("a fresh angle names what stands out, and says what it was judged against without a hover", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(
    makeOverview({
      verdict: {
        novelty: "fresh_angle",
        standsOut: { text: "A worked year-by-year drawdown spreadsheet.", range: null },
        dubious: false,
        dubiousClaims: [],
        reasoning: "The withdrawal advice itself is standard.",
        similarTo: [],
      },
    }),
  );
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();

  await reader.verifyMastheadMentions(/Fresh angle/);
  await reader.verifyNoteShowsLine("What stands out: A worked year-by-year drawdown spreadsheet.", true);
  await reader.verifyNoteShowsLine(NOVELTY_BASIS, true);
});

test("what stands out ends with its start time, which opens a menu that reads the transcript there", async ({ launcher, backendSimulator }) => {
  const overview = makeOverview({
    verdict: {
      novelty: "fresh_angle",
      standsOut: { text: "A worked drawdown spreadsheet.", range: { startMs: 65_000, endMs: 73_000 } },
      dubious: false,
      dubiousClaims: [],
      reasoning: "The withdrawal advice itself is standard.",
      similarTo: [],
    },
  });
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, id: VIDEO_ID, url: `https://www.youtube.com/watch?v=${VIDEO_ID}` },
  });
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.verifyLineTimesRead(["1:05"]);
  await reader.openLineTime("1:05");
  await reader.verifyLineMenuRangeReads("1:05–1:13 in the video");
  await reader.clickReadInTranscript();

  await reader.verifyActiveTabIs("Transcript");
  await reader.verifyTargetTranscriptBlockReads(/Here is the spreadsheet/);
});

test("common knowledge names nothing as standing out", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(
    makeOverview({
      verdict: {
        novelty: "common_knowledge",
        standsOut: null,
        dubious: false,
        dubiousClaims: [],
        reasoning: "A clear walkthrough of compound interest.",
        similarTo: [],
      },
    }),
  );
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();

  await reader.verifyMastheadMentions(/Common knowledge/);
  await reader.verifyNoteShowsLine("What stands out", false);
  await reader.verifyLineTimesRead([]);
  await reader.verifyNoteShowsLine(NOVELTY_BASIS, true);
});
