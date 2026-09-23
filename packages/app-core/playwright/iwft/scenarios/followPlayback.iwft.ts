import type { TranscriptSegment } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("captionedVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=captionedVideo1";
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

const SEGMENTS: TranscriptSegment[] = [
  ...makeCaptionRun(["The opening claim,", "made in the first few seconds", "of the video."], {
    startMs: 0,
    cueMs: 3500,
  }),
  ...makeCaptionRun(["The middle of it,", "where the argument is", "actually made."], {
    startMs: 65_000,
    cueMs: 4000,
  }),
  ...makeCaptionRun(["And this is where it ends.", "Thanks for watching."], {
    startMs: 3_661_000,
    cueMs: 3000,
  }),
];

const playingAt = (positionMs: number, videoId: string = VIDEO_ID) => ({
  videoId,
  positionMs,
  playing: true,
});

const seedTranscript = (backendSimulator: BackendSimulator, segments = SEGMENTS) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, id: VIDEO_ID, url: VIDEO_URL },
  });
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments }));
};

test("the transcript marks the block the video is inside, and says it is following", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: playingAt(5000),
  });

  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");

  await reader.verifyIsFollowingTheVideo(true);
  await reader.verifyCurrentTranscriptBlockReads(/The opening claim/);
});

test("playing on moves the mark to the block being spoken", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: playingAt(5000),
  });
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");

  await launcher.movePlaybackTo(playingAt(70_000));

  await reader.verifyCurrentTranscriptBlockReads(/where the argument is/);
});

test("a player reporting a different video is not read as this one's position", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: playingAt(70_000, "someOtherVideo"),
  });
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");

  await reader.verifyIsFollowingTheVideo(false);
  await reader.verifyNoTranscriptBlockIsCurrent();
});

test("the web app, which cannot see a player, offers none of the following", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyIsFollowingTheVideo(false);
  await reader.verifyOffersToFollowPlayback(false);
  await reader.verifyNoTranscriptBlockIsCurrent();
});

// transcript-storage.md parked what a block does when you click it until there was one
// answer for all of it. Seeking is that answer, and only the time takes the click.
test("the time against a block sends the video to it", async ({ launcher, backendSimulator }) => {
  seedTranscript(backendSimulator);
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: playingAt(5000),
  });
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");

  await reader.clickTranscriptTime("1:05");

  await expect.poll(() => launcher.readPlaybackSeeks()).toEqual([65_000]);
});

test("the web app, with no player to send anywhere, prints the times as plain text", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptBlockTimesRead(["0:00", "1:05", "1:01:01"]);
  await reader.verifyTranscriptTimesSeek(false);
});

// Clicking a time does one thing. Whether the transcript is following is a separate
// question, answered by the control that exists for it.
test("sending the video somewhere does not quietly re-engage the following", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: playingAt(5000),
  });
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");
  await reader.searchTheTranscript("argument");
  await reader.verifyIsFollowingTheVideo(false);

  await reader.clickTranscriptTime("1:05");

  await reader.verifyIsFollowingTheVideo(false);
  await reader.verifyOffersToFollowPlayback(true);
});

test("searching stands the following down and offers it back, rather than fighting it for the scroll", async ({
  launcher,
  backendSimulator,
}) => {
  seedTranscript(backendSimulator);
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: playingAt(5000),
  });
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");
  await reader.verifyIsFollowingTheVideo(true);

  await reader.searchTheTranscript("argument");
  await reader.verifyIsFollowingTheVideo(false);
  await reader.verifyOffersToFollowPlayback(true);

  await reader.clickFollowPlayback();
  await reader.verifyIsFollowingTheVideo(true);
  await reader.verifyMatchCountIsHidden();
  await reader.verifyCurrentTranscriptBlockReads(/The opening claim/);
});

test("scrolling away from the marked block hands the scroll back, until Follow playback is pressed", async ({
  launcher,
  backendSimulator,
}) => {
  const longRuns = Array.from({ length: 30 }, (_, index) =>
    makeCaptionRun(
      [`Paragraph ${index} opens here,`, "carries on for a while", "and then it stops."],
      { startMs: index * 60_000, cueMs: 3500 },
    ),
  ).flat();
  seedTranscript(backendSimulator, longRuns);

  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: playingAt(1000),
  });
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");
  await reader.verifyIsFollowingTheVideo(true);

  await reader.scrollDown(3000);

  await reader.verifyIsFollowingTheVideo(false);
  await reader.verifyOffersToFollowPlayback(true);

  await reader.clickFollowPlayback();
  await reader.verifyIsFollowingTheVideo(true);
  await reader.verifyOffersToFollowPlayback(false);
});
