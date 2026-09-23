import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";

const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const ANOTHER_WATCHED_URL = "https://www.youtube.com/watch?v=anotherVideoId";
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };
// The panel of a browser that can reach YouTube, which is what an extension always is.
const PANEL = { apiKeys: API_KEYS, surface: "extension", activeVideoUrl: WATCHED_URL, youTubeFetch: true } as const;

test("the side panel opens on the video in front of it, and that link is the one it generates from", async ({
  launcher,
}) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "extension", activeVideoUrl: WATCHED_URL });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUrlInputHolds(WATCHED_URL);
  await dialog.form.verifySaysUrlCameFromWatchedVideo();

  await dialog.form.clickGenerate();
  await dialog.verifySourceTitle("The Simulated Video");
});

test("the web app, which cannot see the tab you are on, offers none of it", async ({ launcher }) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "web" });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUrlInputHolds("");
  await dialog.form.verifySaysNothingAboutAWatchedVideo();
});

test("a side panel open on something that isn't a video says so by offering nothing, not by offering a dead button", async ({
  launcher,
}) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "extension", activeVideoUrl: null });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUrlInputHolds("");
  await dialog.form.verifySaysNothingAboutAWatchedVideo();
});

test("moving to another video offers the new one rather than swapping the link you were about to spend on", async ({
  launcher,
}) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "extension", activeVideoUrl: WATCHED_URL });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.verifyUrlInputHolds(WATCHED_URL);

  await launcher.watchAnotherVideo(ANOTHER_WATCHED_URL);
  await dialog.form.verifyUrlInputHolds(WATCHED_URL);
  await dialog.form.verifyOffersWatchedVideo();

  await dialog.form.clickUseWatchedVideo();
  await dialog.form.verifyUrlInputHolds(ANOTHER_WATCHED_URL);
});

test("the captions for the video in front of the panel are fetched before anyone asks for a note", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch(PANEL);

  // The store, not the call count: the fetch firing is not the same moment as the
  // captions being held.
  await expect
    .poll(() => backendSimulator.transcriptStore.getTranscript(VideoId.parse(IWFT_VIDEO_ID)))
    .not.toBeNull();
  expect(backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
});

test("generating from a video whose captions are already held doesn't buy them a second time", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch(PANEL);
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);

  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.verifyWatchedVideoNote(/captions are already here/);
  await dialog.form.clickGenerate();
  await dialog.clickReadOverview();

  expect(backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);
});

test("moving to another video goes and gets that one's captions too", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch(PANEL);
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(1);

  await launcher.watchAnotherVideo(ANOTHER_WATCHED_URL);
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(2);
});

test("the panel fetches the captions with no key at all, because the free path costs nothing", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch({ surface: "extension", activeVideoUrl: WATCHED_URL, youTubeFetch: true });

  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
});

test("with only a paid rung, nothing is bought for a video nobody asked about", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "extension", activeVideoUrl: WATCHED_URL });
  await launcher.appShell.openNewOverview();

  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_METADATA)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(0);
});

test("the web app, which sees no video, buys nothing in the background either", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "web" });
  await launcher.appShell.openNewOverview();

  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_METADATA)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(0);
});

test("a video the panel already looked up costs one metadata call, not one for it and another for the note", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch(PANEL);
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(1);

  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.clickGenerate();
  await dialog.clickReadOverview();

  // One player call served the look-up and the note, and the captions were fetched once.
  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);
});
