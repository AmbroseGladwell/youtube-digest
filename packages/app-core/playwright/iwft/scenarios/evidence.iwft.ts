import { VideoId } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("evidenceVid1");
const SEGMENTS = makeCaptionRun(["sets matter more than weight", "as long as each is hard"], { startMs: 0, cueMs: 3500 });

const seedQuotedNote = (backendSimulator: BackendSimulator, { generated }: { generated: boolean }) => {
  const overview = makeOverview({
    keyPoints: [
      {
        text: "Adding sets grows the arms faster than adding weight.",
        range: { startMs: 0, endMs: 7_000 },
        evidence: { text: "sets matter more than weight", range: { startMs: 0, endMs: 3_500 }, adds: "He hedges it in the next breath." },
      },
      { text: "Cables keep tension where free weights lose it.", range: null },
      { text: "The video builds its case for frequency throughout.", range: null },
    ],
  });
  backendSimulator.overviews.seed({
    ...overview,
    source: { ...overview.source, id: VIDEO_ID, url: `https://www.youtube.com/watch?v=${VIDEO_ID}` },
  });
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS, generated }));
};

test("a key point's quotation sits under it as a quotation, unnumbered, with what it adds", async ({ launcher, backendSimulator }) => {
  seedQuotedNote(backendSimulator, { generated: false });
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();

  await reader.verifyQuotationsRead([{ text: "sets matter more than weight", aside: "He hedges it in the next breath." }]);
  await reader.verifyBulletedLinesRead([
    "Adding sets grows the arms faster than adding weight.",
    "Cables keep tension where free weights lose it.",
    "The video builds its case for frequency throughout.",
  ]);
  await reader.verifyNoteShowsLine("sets matter more than weight", true);
});

test("a quotation from captions a machine heard says so above it", async ({ launcher, backendSimulator }) => {
  seedQuotedNote(backendSimulator, { generated: true });
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();

  await reader.verifyQuotationsRead([{ text: "sets matter more than weight", aside: "He hedges it in the next breath." }]);
  await reader.verifyNoteShowsLine("sets matter more than weight", true);
  await reader.verifyNoteLabelsRead(["From the auto-generated captions"]);
});
