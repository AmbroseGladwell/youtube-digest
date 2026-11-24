import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID, THE_LONG_EXPLANATION } from "../../network/fixtures/innerTubeFixtures.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const ANTHROPIC_ONLY = ANTHROPIC_KEY;

test("a shell that can reach YouTube writes a note without asking our server", async ({ launcher, backendSimulator }) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: ANTHROPIC_ONLY,
    youTubeFetch: true,
  });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(0);
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
});

test("one player call answers for the metadata and the captions together, not one each", async ({ launcher, backendSimulator }) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: ANTHROPIC_ONLY,
    youTubeFetch: true,
  });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(1);
});

test("a free rung that fails falls through to our server, rather than failing the run", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.INNERTUBE_PLAYER);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: ANTHROPIC_ONLY, youTubeFetch: true });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  // Both caption clients were tried before the rung gave up.
  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(2);
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(1);
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
});

test("captions already held are read back, whichever rung could have fetched them", async ({ launcher, backendSimulator }) => {
  backendSimulator.transcripts.seed(
    makeStoredTranscript({
      videoId: VideoId.parse(IWFT_VIDEO_ID),
      segments: makeCaptionRun(["Captions already held.", "Bought once, read twice.", THE_LONG_EXPLANATION], {
        startMs: 0,
        cueMs: 2000,
      }),
    }),
  );
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: ANTHROPIC_ONLY,
    youTubeFetch: true,
  });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(0);
});

test("a video goes straight to the reader's own rungs: there is no shared cache to ask", async ({ launcher, backendSimulator }) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: ANTHROPIC_ONLY });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.SHARED_TRANSCRIPT)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(1);
});

const serviceTranscript = () =>
  makeStoredTranscript({
    videoId: VideoId.parse(IWFT_VIDEO_ID),
    segments: makeCaptionRun(["Fetched by our own server.", "Nobody else had it yet.", THE_LONG_EXPLANATION], { startMs: 0, cueMs: 2000 }),
  });

test("a web reader with no extension gets an uncached video's transcript from our server", async ({ launcher, backendSimulator }) => {
  backendSimulator.transcripts.seedService(serviceTranscript());
  const form = await launcher.launchExpectingFirstRun({ apiKeys: ANTHROPIC_ONLY });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(1);
  expect(await backendSimulator.transcriptStore.getTranscript(VideoId.parse(IWFT_VIDEO_ID))).toMatchObject({
    segments: serviceTranscript().segments,
  });
});

test("a reader with a free rung never reaches our server's metered one", async ({ launcher, backendSimulator }) => {
  backendSimulator.transcripts.seedService(serviceTranscript());
  const form = await launcher.launchExpectingFirstRun({ apiKeys: ANTHROPIC_ONLY, youTubeFetch: true });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(0);
});

test("once our server's budget for the day is spent, the reader is told what else can fetch it", async ({ launcher, backendSimulator }) => {
  backendSimulator.transcripts.seedService(serviceTranscript());
  backendSimulator.simulateEndpointError(EndpointKey.SERVICE_TRANSCRIPT);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: ANTHROPIC_ONLY });

  await form.submitUrl(VIDEO_URL);
  await form.verifyGenerationError("Simulated: our server has fetched all the transcripts it can for today.");

  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
});

test("past our server's daily cap, a reader making one by hand is told when it resets, and can keep it for then or the extension", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.transcripts.seedService(serviceTranscript());
  backendSimulator.transcripts.serviceCapReached(60 * 60);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: ANTHROPIC_ONLY });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyKeepNoticeReads(
    /^This one can’t be fetched right now\.Fetching from YouTube is paused on us until \d\d:\d\d\. Keep it, and it’s made after \d\d:\d\d, or as soon as you open the extension on a computer, whichever comes first\.Keep itNot now$/,
  );

  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
});
