import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const VIDEO_ID = "watchedVideo1";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

const RANGE = { startMs: 200_000, endMs: 310_000 };

const seedNote = (
  backendSimulator: { overviews: { seed: (overview: ReturnType<typeof makeOverview>) => void } },
  watchAnyway: ReturnType<typeof makeOverview>["watchAnyway"],
) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    watchAnyway,
    video: { ...overview.video, id: VideoId.parse(VIDEO_ID), url: VIDEO_URL },
  });
};

const partial = { answer: "partial" as const, reason: "One stretch earns it.", range: RANGE };

const panelWatching = {
  apiKeys: API_KEYS,
  activeVideoUrl: VIDEO_URL,
  playback: { videoId: VIDEO_ID, positionMs: 0, playing: true },
};

test("the stretch worth watching is printed as a range, under the paragraph that says so", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, partial);
  const capture = await launcher.launchPanel(panelWatching);
  const reader = await capture.openStoredOverview();

  await reader.verifyWatchAnywayRangeReads("3:20–5:10");
});

test("skipping moves the video to the start of that stretch, not to the end of it", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, partial);
  const capture = await launcher.launchPanel(panelWatching);
  const reader = await capture.openStoredOverview();

  await reader.clickSkipToWatchAnyway();

  await expect.poll(() => launcher.readPlaybackSeeks()).toEqual([RANGE.startMs]);
});

// The range is how someone gets there on their own, so it is printed whether or not
// anything here can move a video.
test("the web app prints the range and offers no skip, having no player to move", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, partial);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyWatchAnywayRangeReads("3:20–5:10");
  await reader.verifyOffersToSkipTheVideo(false);
});

test("a panel whose tab has moved to another video offers no skip either", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, partial);
  const capture = await launcher.launchPanel({
    ...panelWatching,
    playback: { videoId: "someOtherVideo", positionMs: 0, playing: true },
  });
  const reader = await capture.openStoredOverview();

  await reader.verifyWatchAnywayRangeReads("3:20–5:10");
  await reader.verifyOffersToSkipTheVideo(false);
});

test("a note with no stretch to point at shows none of it", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, { answer: "no", reason: "Nothing here earns it.", range: null });
  const capture = await launcher.launchPanel(panelWatching);
  const reader = await capture.openStoredOverview();

  await reader.verifyHasNoWatchAnywayJump();
});
