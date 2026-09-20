import type { TranscriptSegment } from "@overview/types";
import { VideoId } from "@overview/types";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("watchedVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=watchedVideo1";
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

const panel = { apiKeys: API_KEYS, activeVideoUrl: VIDEO_URL };

// Long enough that everything below the chrome has somewhere to scroll to.
const SEGMENTS: TranscriptSegment[] = Array.from({ length: 30 }, (_, index) =>
  makeCaptionRun(
    [`Paragraph ${index} opens here,`, "carries on for a while", "and then it stops."],
    { startMs: index * 60_000, cueMs: 3500 },
  ),
).flat();

// The Overview tab has to overflow the panel before anything can be observed about what
// holds still while it scrolls.
const LONG_NOTE_POINTS = Array.from(
  { length: 30 },
  (_, index) => `Key point ${index}, written long enough to take a line of its own in the panel.`,
);

const VERDICT = {
  novelty: "novel" as const,
  dubious: false,
  reasoning: "Nobody else has said this.",
  similarTo: [],
};

const seedNote = (backendSimulator: {
  overviews: { seed: (overview: ReturnType<typeof makeOverview>) => void };
  transcripts: { seed: (transcript: ReturnType<typeof makeStoredTranscript>) => void };
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    keyPoints: LONG_NOTE_POINTS,
    verdict: VERDICT,
    savedAt: "2026-09-16T00:00:00.000Z",
    video: {
      ...overview.video,
      id: VIDEO_ID,
      url: VIDEO_URL,
      channel: "Practical Engineering",
      publishedAt: "2026-09-01T00:00:00.000Z",
    },
  });
  backendSimulator.transcripts.seed(
    makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }),
  );
};

// Only the panel's head sticks. The wide reader's carries a thumbnail, a trail and a
// stepper, and holding that would cost the note most of the window — readAlong.iwft.ts
// is what holds the tabs to the bar alone there, and would fail if this leaked.
test("the panel keeps the note's head and its tabs against the bar while the note scrolls", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifyPanelChromeStacks(false);
  // Asserts the page actually moved, so the check below cannot pass by nothing having
  // scrolled at all.
  await reader.scrollTheNote();
  await reader.verifyPanelChromeStacks(false);
});

test("on the transcript the tools stay up there with them", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");

  await reader.verifyPanelChromeStacks(true);
  await reader.scrollTheNote();
  await reader.verifyPanelChromeStacks(true);
});

// The case for Plus is made at the foot of the window, not at the end of the note where
// it would need scrolling to (docs/features/plus-upsell.md).
test("the Plus prompt holds the foot of the window rather than the end of the note", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.clickListen();

  await reader.verifyPlusPromptIsShown(true);
  await reader.verifyPlusPromptHoldsTheWindowFoot();
});

test("the panel's head is the video and whose it is, not four facts about when", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifyChannelReads("Practical Engineering");
  await reader.verifyShowsNoPublished();
  await reader.verifyMastheadOmits(/saved/i);
  await reader.verifyMastheadOmits(/Novel/);
});

test("the wide reader keeps all of it, having the width for it", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyPublishedReads("· published 1 Sept 2026");
  await reader.verifyMastheadMentions(/saved 16 Sep/);
  await reader.verifyMastheadMentions(/Novel/);
});

// At the panel's real width, a menu hung from the wrong edge leaves the window and one
// trapped under the sticky head is painted over by the tabs.
test("the actions menu opens inside the panel and over the tabs, not under them", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 720 });
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.openActionsMenu();

  await reader.verifyActionsMenuIsShown(true);
  await reader.verifyActionsMenuFitsAndIsOnTop();
});
