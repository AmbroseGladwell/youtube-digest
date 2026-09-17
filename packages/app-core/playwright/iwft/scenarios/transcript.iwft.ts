import type { StoredTranscript } from "@overview/types";
import { VideoId } from "@overview/types";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("captionedVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=captionedVideo1";
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

const SEGMENTS = [
  { text: "The claim starts here.", startMs: 0, endMs: 4000 },
  { text: "This is the part worth watching.", startMs: 65_000, endMs: 71_000 },
  { text: "And this is where it ends.", startMs: 3_661_000, endMs: 3_665_000 },
];

const noteOn = (videoId: VideoId | null, url: string = VIDEO_URL) => {
  const overview = makeOverview();
  return makeOverview({ video: { ...overview.video, id: videoId, url } });
};

test("the transcript tab lists the stored captions against the time each one starts", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(noteOn(VIDEO_ID));
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptLinesRead(SEGMENTS.map((segment) => segment.text));
  await reader.verifyTranscriptTimesRead(["0:00", "1:05", "1:01:01"]);
});

test("a caption line opens the video at the moment it was said", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(noteOn(VIDEO_ID));
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptLineLinksToVideoAt("This is the part worth watching.", `${VIDEO_URL}&t=65`);
});

test("a note saved before transcripts were stored says so rather than showing an empty tab", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(noteOn(null));

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyShowsNoStoredTranscript();
});

test("a note whose video has no stored transcript says the same thing", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(noteOn(VIDEO_ID));

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyShowsNoStoredTranscript();
});

test("machine-heard captions are labelled as such, and a video's own captions are not", async ({
  launcher,
  backendSimulator,
}) => {
  const machineHeardId = VideoId.parse("machineHeardVideo");
  backendSimulator.overviews.seed({
    ...noteOn(machineHeardId, "https://www.youtube.com/watch?v=machineHeardVideo"),
    savedAt: "2026-09-16T00:00:00.000Z",
  });
  backendSimulator.overviews.seed({ ...noteOn(VIDEO_ID), savedAt: "2026-09-15T00:00:00.000Z" });
  backendSimulator.transcripts.seed(
    makeStoredTranscript({ videoId: machineHeardId, segments: SEGMENTS, generated: true }),
  );
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));

  const library = await launcher.launchExpectingLibrary();
  const machineHeard = await library.nthCard(0).openReader();
  await machineHeard.clickTab("Transcript");
  await machineHeard.verifyShowsMachineTranscribedNote();

  const back = await machineHeard.clickBackToLibrary();
  const captioned = await back.nthCard(1).openReader();
  await captioned.clickTab("Transcript");
  await captioned.verifyTranscriptLinesRead(SEGMENTS.map((segment) => segment.text));
  await captioned.verifyShowsNoMachineTranscribedNote();
});

test("a transcript still being read shows the tab's skeleton rather than its empty note", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(noteOn(VIDEO_ID));
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  // Held open rather than slowed down: a read that never settles is the local store's
  // equivalent of the harness's STALL behaviour (frontend-testing-guide.md 4.3).
  await page.evaluate(() => {
    window.__iwftStores__.transcriptStore.getTranscript = () =>
      new Promise<StoredTranscript | null>(() => {});
  });
  await reader.clickTab("Transcript");

  await reader.verifyShowsTranscriptSkeleton();
});

test("generating a note keeps the transcript it fetched, and the tab reads it back", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  await dialog.verifyStepState("02", "done");
  await dialog.clickReadOverview();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptLinesRead([
    "Hello and welcome to the simulated video.",
    "Here is the one claim this video makes.",
    "And here is how you could apply it.",
  ]);
  await reader.verifyTranscriptTimesRead(["0:00", "0:03", "0:07"]);

  const stored = await backendSimulator.transcriptStore.getTranscript(VideoId.parse(IWFT_VIDEO_ID));
  expect(stored?.segments).toHaveLength(3);
  expect(stored?.generated).toBe(false);
});

test("a generation that fails still leaves the transcript stored, so a retry doesn't pay for it twice", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  await form.verifyGenerationErrorIsVisible();

  const stored = await backendSimulator.transcriptStore.getTranscript(VideoId.parse(IWFT_VIDEO_ID));
  expect(stored?.segments).toHaveLength(3);
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(0);
});
