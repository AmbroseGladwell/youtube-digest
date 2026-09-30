import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const BOTH_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };
const ANTHROPIC_ONLY = { anthropicApiKey: "sk-ant-test", supadataApiKey: null };

const supadataCalls = (simulator: {
  getCallCount: (endpoint: EndpointKey) => number;
}): number =>
  simulator.getCallCount(EndpointKey.SUPADATA_METADATA) +
  simulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT);

test("a shell that can reach YouTube writes a note with no transcript key at all", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: ANTHROPIC_ONLY,
    youTubeFetch: true,
  });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);
  expect(supadataCalls(backendSimulator)).toBe(0);
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
});

// The whole point of the ordering: a key holder stops paying for what was free.
test("holding a Supadata key does not mean spending it when the free rung answered", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: BOTH_KEYS, youTubeFetch: true });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(1);
  expect(supadataCalls(backendSimulator)).toBe(0);
});

test("one player call answers for the metadata and the captions together, not one each", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: ANTHROPIC_ONLY,
    youTubeFetch: true,
  });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(1);
});

test("a free rung that fails falls through to the key, rather than failing the run", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.INNERTUBE_PLAYER);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: BOTH_KEYS, youTubeFetch: true });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  // Both caption clients were tried before the rung gave up, which is the cascade doing
  // its job rather than one client's failure ending the run.
  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(2);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(1);
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
});

test("a shell that cannot reach YouTube still buys the transcript, exactly as it did before", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: BOTH_KEYS });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(1);
});

test("captions already held are read back, whichever rung could have fetched them", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.transcripts.seed(
    makeStoredTranscript({
      videoId: VideoId.parse(IWFT_VIDEO_ID),
      segments: makeCaptionRun(["Captions already held.", "Bought once, read twice."], {
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

const sharedTranscript = () =>
  makeStoredTranscript({
    videoId: VideoId.parse(IWFT_VIDEO_ID),
    segments: makeCaptionRun(["Stored by another account.", "Read here for nothing."], { startMs: 0, cueMs: 2000 }),
  });

test("a video another account already stored is read from the shared cache, and nothing is bought", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.transcripts.seedShared(sharedTranscript());
  const form = await launcher.launchExpectingFirstRun({ apiKeys: BOTH_KEYS });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.SHARED_TRANSCRIPT)).toBe(1);
  expect(supadataCalls(backendSimulator)).toBe(0);
  expect(await backendSimulator.transcriptStore.getTranscript(VideoId.parse(IWFT_VIDEO_ID))).toMatchObject({
    segments: sharedTranscript().segments,
  });
});

test("the side panel reads a cached video from the shared cache rather than contacting YouTube", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.transcripts.seedShared(sharedTranscript());
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: ANTHROPIC_ONLY,
    youTubeFetch: true,
    surface: "extension",
    defaultApiUrl: "https://overview.test",
  });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.SHARED_TRANSCRIPT)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.INNERTUBE_PLAYER)).toBe(0);
});

test("a video the shared cache has never seen falls through to the next rung", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: BOTH_KEYS });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.SHARED_TRANSCRIPT)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(1);
});

test("a shared cache that cannot be reached counts as a miss, not as a failed run", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.SHARED_TRANSCRIPT);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: BOTH_KEYS });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(1);
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
});
