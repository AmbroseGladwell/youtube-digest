import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("keyPointVideo1");
const SEGMENTS = [
  ...makeCaptionRun(["Sets matter more than weight,", "as long as each is hard."], { startMs: 0, cueMs: 3500 }),
  ...makeCaptionRun(["Cables keep the tension", "at the long end of the curl."], { startMs: 65_000, cueMs: 4000 }),
  ...makeCaptionRun(["Train arms twice a week", "and the volume adds up."], { startMs: 130_000, cueMs: 4000 }),
];
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const seedNote = (backendSimulator: BackendSimulator) => {
  const overview = makeOverview({
    keyPoints: [
      { text: "Adding sets grows the arms faster than adding weight.", range: { startMs: 0, endMs: 7_000 } },
      { text: "Cables keep tension where free weights lose it.", range: { startMs: 65_000, endMs: 73_000 } },
      { text: "The video builds its case for frequency throughout.", range: null },
    ],
  });
  const seeded = { ...overview, video: { ...overview.video, id: VIDEO_ID, url: `https://www.youtube.com/watch?v=${VIDEO_ID}` } };
  backendSimulator.overviews.seed(seeded);
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));
  return seeded;
};

test("each key point ends with where in the video it starts, and one built across the video has no time", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();

  await reader.verifyLineTimesRead(["0:00", "1:05"]);
});

test("a key point's time opens a menu whose Read in transcript opens the transcript there, counted as a key point followed", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  const reader = await library.nthCard(0).openReader();
  await reader.clickReadInTranscriptAt("1:05");

  await reader.verifyActiveTabIs("Transcript");
  await reader.verifyTargetTranscriptBlockReads(/Cables keep the tension/);
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "reader.readAlong.rangeFollowed"))
    .toEqual([
      { name: "reader.readAlong.rangeFollowed", props: { overviewId: overview.id, line: "keyPoint", by: "transcript" } },
    ]);
});

test("pressing a time opens its menu without moving the reading mark, and Escape closes it back onto the time", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.openLineTime("1:05");

  await reader.verifyActiveLineReads("Premise");
  await reader.verifyLineMenuRangeReads("1:05–1:13 in the video");
  await reader.pressEscape();
  await reader.verifyLineMenuIsOpen(false);
  await reader.verifyLineTimeIsFocused("1:05");
});

test("on a phone the menu is a sheet that names its line, and tapping outside closes it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.openLineTime("1:05");

  await reader.verifyLineMenuNames("Cables keep tension where free weights lose it.");
  await reader.clickOutsideLineMenu();
  await reader.verifyLineMenuIsOpen(false);
});
