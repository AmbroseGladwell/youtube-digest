import type { TranscriptSegment } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("captionedVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=captionedVideo1";

// Three runs far enough apart that each is its own block, with the search term in two of
// them (docs/features/transcript-storage.md's silenceMs is what separates them).
const SEGMENTS: TranscriptSegment[] = [
  ...makeCaptionRun(
    [
      "Productivity is the claim here,",
      "and productivity is the trap",
      "that this whole video sets",
      "for anyone listening.",
    ],
    { startMs: 0, cueMs: 3500 },
  ),
  ...makeCaptionRun(
    ["The second thing about productivity", "is that it gets measured badly", "almost everywhere."],
    { startMs: 65_000, cueMs: 4000 },
  ),
  ...makeCaptionRun(["And this is where it ends.", "Thanks for watching."], {
    startMs: 3_661_000,
    cueMs: 3000,
  }),
];

const seedTranscript = (backendSimulator: {
  overviews: { seed: (overview: ReturnType<typeof makeOverview>) => void };
  transcripts: { seed: (transcript: ReturnType<typeof makeStoredTranscript>) => void };
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: {
      ...overview.video,
      id: VIDEO_ID,
      url: VIDEO_URL,
      title: "The Quiet Return of Nuclear Baseload",
      channel: "Practical Engineering",
    },
  });
  backendSimulator.transcripts.seed(
    makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }),
  );
};

test("searching the transcript marks every hit and counts them", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyMatchCountIsHidden();
  await reader.searchTheTranscript("productivity");

  await reader.verifyMatchCountReads("1/3");
  await reader.verifyHighlightedMatchCountIs(3);
  await reader.verifyCurrentMatchReads("Productivity");
});

test("the steppers walk the hits and wrap round rather than stopping at the last one", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");
  await reader.searchTheTranscript("productivity");

  await reader.clickNextMatch();
  await reader.verifyMatchCountReads("2/3");
  await reader.clickNextMatch();
  await reader.verifyMatchCountReads("3/3");
  await reader.clickNextMatch();
  await reader.verifyMatchCountReads("1/3");

  await reader.clickPreviousMatch();
  await reader.verifyMatchCountReads("3/3");
});

test("a search that finds nothing says so rather than leaving a count of zero", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.searchTheTranscript("nuclear");

  await reader.verifyMatchCountReads("No matches");
  await reader.verifyHighlightedMatchCountIs(0);
});

test("copying puts the whole transcript, and the video it came from, on the clipboard", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  seedTranscript(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.clickCopyTranscript();
  await reader.verifyCopyButtonReads("Copied");

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("The Quiet Return of Nuclear Baseload");
  expect(copied).toContain("Practical Engineering");
  expect(copied).toContain(VIDEO_URL);
  expect(copied).toContain("0:00\tProductivity is the claim here,");
  expect(copied).toContain("1:05\tThe second thing about productivity");
});

test("exporting writes the same text to a file named after the video", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  seedTranscript(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  const download = page.waitForEvent("download");
  await reader.clickExportTranscript();

  expect((await download).suggestedFilename()).toBe(
    "the-quiet-return-of-nuclear-baseload-transcript.txt",
  );
});

test("a note with no stored transcript offers no tools to copy, export or search it with", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({ ...overview, video: { ...overview.video, id: VIDEO_ID } });
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyShowsNoStoredTranscript();
  await reader.verifyTranscriptToolsAreShown(false);
});
