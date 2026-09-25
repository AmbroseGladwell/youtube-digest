import type { TranscriptSegment } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("longVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=longVideo1";
const OTHER_VIDEO_ID = VideoId.parse("longVideo2");
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

const longTranscript = (): TranscriptSegment[] =>
  Array.from({ length: 30 }, (_, index) =>
    makeCaptionRun(
      [`Paragraph ${index} opens here,`, "carries on for a while", "and then it stops."],
      { startMs: index * 60_000, cueMs: 3500 },
    ),
  ).flat();

const playingAt = (positionMs: number) => ({ videoId: VIDEO_ID, positionMs, playing: true });

const panelWatching = { apiKeys: API_KEYS, activeVideoUrl: VIDEO_URL, playback: playingAt(1000) };

const seedNote = (backendSimulator: BackendSimulator, videoId: VideoId = VIDEO_ID) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, id: videoId, url: `https://www.youtube.com/watch?v=${videoId}` },
  });
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId, segments: longTranscript() }));
};

test("coming back to a transcript opens it where you were, not at the top", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");
  await reader.scrollDown(3000);
  const wasReading = await reader.readTranscriptBlockAtCentre();
  expect(wasReading).not.toBeNull();

  await reader.clickTab("Chapters");
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptBlockAtCentreReads(wasReading!);
});

// The reference implementation's one improvement on ours, adopted: a position you were
// reading ahead at is restored with the following off, so the player does not yank the
// transcript away from it (docs/features/following-playback.md).
test("in the panel the restored position wins over the player, and the following is offered back", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panelWatching);
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");
  await reader.verifyIsFollowingTheVideo(true);
  await reader.scrollDown(3000);
  await reader.verifyIsFollowingTheVideo(false);
  const wasReading = await reader.readTranscriptBlockAtCentre();

  await reader.clickTab("Chapters");
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptBlockAtCentreReads(wasReading!);
  await reader.verifyIsFollowingTheVideo(false);
  await reader.verifyOffersToFollowPlayback(true);
});

test("asking to follow the video again forgets the position, so the next visit follows from the start", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panelWatching);
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");
  await reader.scrollDown(3000);
  await reader.clickFollowPlayback();
  await reader.verifyIsFollowingTheVideo(true);

  await reader.clickTab("Chapters");
  await reader.clickTab("Transcript");

  await reader.verifyIsFollowingTheVideo(true);
  await reader.verifyCurrentTranscriptBlockReads(/Paragraph 0 opens here/);
});

test("scrolling back to the top leaves nothing to come back to", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");
  await reader.scrollDown(3000);
  await reader.scrollDown(-3000);

  await reader.clickTab("Chapters");
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptIsAtTheTop();
});

test("the position is the video's own: another video's transcript opens at the top", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  seedNote(backendSimulator, OTHER_VIDEO_ID);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");
  await reader.scrollDown(3000);

  await reader.clickNextOverview();

  await reader.verifyActiveTabIs("Transcript");
  await reader.verifyTranscriptIsAtTheTop();
});

// A chapter names where to open, and that beats where you had got to.
test("opening the transcript from a chapter goes to the chapter, not to where you left off", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, id: VIDEO_ID, url: VIDEO_URL },
    chapters: [
      { title: "The start", summary: "Opens.", startMs: 0, endMs: 1_500_000 },
      { title: "Paragraph twenty-five", summary: "Late on.", startMs: 1_500_000, endMs: 1_800_000 },
    ],
  });
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: longTranscript() }));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");
  await reader.scrollDown(3000);

  await reader.clickTab("Chapters");
  await reader.clickChapterTranscript("Paragraph twenty-five");

  await reader.verifyTargetTranscriptBlockReads(/Paragraph 25 opens here/);
});
