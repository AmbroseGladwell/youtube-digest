import type { StoredTranscript, TranscriptSegment } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import {
  makeCaptionRun,
  makeTranscriptSegment,
} from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("captionedVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=captionedVideo1";
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

// Nine captions, in three runs of the length YouTube actually emits — which the reader
// merges into the three blocks below (docs/features/transcript-storage.md).
const SEGMENTS: TranscriptSegment[] = [
  ...makeCaptionRun(
    [
      "The claim starts here,",
      "and the whole of it takes four captions",
      "before it finally reaches",
      "its first full stop.",
    ],
    { startMs: 0, cueMs: 3500 },
  ),
  ...makeCaptionRun(
    [
      "This is the part worth watching,",
      "and this is the reason you might",
      "want to see it for yourself.",
    ],
    { startMs: 65_000, cueMs: 4000 },
  ),
  ...makeCaptionRun(["And this is where it ends.", "Thanks for watching."], {
    startMs: 3_661_000,
    cueMs: 3000,
  }),
];

const BLOCKS = [
  "The claim starts here, and the whole of it takes four captions before it finally reaches its first full stop.",
  "This is the part worth watching, and this is the reason you might want to see it for yourself.",
  "And this is where it ends. Thanks for watching.",
];
const BLOCK_TIMES = ["0:00", "1:05", "1:01:01"];

const noteOn = (videoId: VideoId | null, url: string = VIDEO_URL) => {
  const overview = makeOverview();
  return makeOverview({ video: { ...overview.video, id: videoId, url } });
};

test("the transcript tab merges the captions into blocks, each against the time its first words were said", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(noteOn(VIDEO_ID));
  backendSimulator.transcripts.seed(
    makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }),
  );

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptBlockCountIs(3);
  await reader.verifyTranscriptBlocksRead(BLOCKS);
  await reader.verifyTranscriptBlockTimesRead(BLOCK_TIMES);
});

test("each turn of an interview is its own block, marked as a new speaker", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(noteOn(VIDEO_ID));
  backendSimulator.transcripts.seed(
    makeStoredTranscript({
      videoId: VIDEO_ID,
      segments: [
        makeTranscriptSegment({
          text: ">> Thank you so much for being here.",
          startMs: 11_000,
          endMs: 14_000,
        }),
        makeTranscriptSegment({ text: ">> Thank you.", startMs: 14_000, endMs: 15_000 }),
        makeTranscriptSegment({
          text: ">> I came into your class last term.",
          startMs: 15_000,
          endMs: 18_000,
        }),
      ],
    }),
  );

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptBlocksRead([
    "Thank you so much for being here.",
    "Thank you.",
    "I came into your class last term.",
  ]);
  await reader.verifyTranscriptSpeakerMarkCountIs(3);
});

test("a transcript with one speaker throughout carries no speaker marks", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(noteOn(VIDEO_ID));
  backendSimulator.transcripts.seed(
    makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }),
  );

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptSpeakerMarkCountIs(0);
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
  backendSimulator.transcripts.seed(
    makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }),
  );

  const library = await launcher.launchExpectingLibrary();
  const machineHeard = await library.nthCard(0).openReader();
  await machineHeard.clickTab("Transcript");
  await machineHeard.verifyShowsMachineTranscribedNote();

  const back = await machineHeard.clickBackToLibrary();
  const captioned = await back.nthCard(1).openReader();
  await captioned.clickTab("Transcript");
  await captioned.verifyTranscriptBlocksRead(BLOCKS);
  await captioned.verifyShowsNoMachineTranscribedNote();
});

test("a transcript still being read shows the tab's skeleton rather than its empty note", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(noteOn(VIDEO_ID));
  backendSimulator.transcripts.seed(
    makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }),
  );

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

test("generating a note keeps the captions it fetched, and the tab reads them back as blocks", async ({
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

  await reader.verifyTranscriptBlocksRead([
    "Hello and welcome to the simulated video. Here is the one claim this video makes. And here is how you could apply it.",
  ]);
  await reader.verifyTranscriptBlockTimesRead(["0:00"]);

  // Three captions stored, one block shown: the merging is display-only, and the store
  // keeps what the model was given (docs/features/transcript-storage.md).
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
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(1);

  backendSimulator.simulateEndpointDefault(EndpointKey.ANTHROPIC_MESSAGES);
  await form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(1);
});

test("a second note on a video already in the library reads the stored captions rather than buying them again", async ({
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
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_METADATA)).toBe(0);
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
});
