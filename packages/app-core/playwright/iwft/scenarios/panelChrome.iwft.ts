import type { TranscriptSegment } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const VIDEO_ID = VideoId.parse("watchedVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=watchedVideo1";
const API_KEYS = ANTHROPIC_KEY;

const panel = { apiKeys: API_KEYS, activeVideoUrl: VIDEO_URL };

const SEGMENTS: TranscriptSegment[] = Array.from({ length: 30 }, (_, index) =>
  makeCaptionRun([`Paragraph ${index} opens here,`, "carries on for a while", "and then it stops."], {
    startMs: index * 60_000,
    cueMs: 3500,
  }),
).flat();

const LONG_NOTE_POINTS = Array.from(
  { length: 30 },
  (_, index) => `Key point ${index}, written long enough to take a line of its own in the panel.`,
);

const VERDICT = {
  novelty: "original" as const,
  standsOut: { text: "A new idea.", range: null },
  dubious: true,
  dubiousClaims: null,
  reasoning: "Nobody else has said this.",
  similarTo: [],
};

const ENERGY = makeTopic({ name: "energy" });

const seedNote = (backendSimulator: {
  overviews: {
    seed: (overview: ReturnType<typeof makeOverview>) => void;
    seedTopic: (topic: ReturnType<typeof makeTopic>) => void;
  };
  transcripts: { seed: (transcript: ReturnType<typeof makeStoredTranscript>) => void };
}) => {
  backendSimulator.overviews.seedTopic(ENERGY);
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    topicIds: [ENERGY.id],
    keyPoints: LONG_NOTE_POINTS.map((text) => ({ text, range: null })),
    verdict: VERDICT,
    thin: true,
    savedAt: "2026-09-16T00:00:00.000Z",
    source: {
      ...overview.source,
      id: VIDEO_ID,
      url: VIDEO_URL,
      channel: "Practical Engineering",
      publishedAt: "2026-09-01T00:00:00.000Z",
    },
  });
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));
};

test("the panel holds its tabs against the bar and lets the head scroll away", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifyTabsAreBelowTheHead();
  // Asserts the page moved, so the checks below can't pass on nothing having scrolled.
  await reader.scrollTheNote();
  await reader.verifyPanelChromeStacks(false);
  await reader.verifyHeadBackLinkIsUnderTheBar();
});

test("on the transcript the tools stay up there with them", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Transcript");

  await reader.verifyTabsAreBelowTheHead();
  await reader.scrollTheNote();
  await reader.verifyPanelChromeStacks(true);
});

test("Listen docks the player at the foot of the window rather than the end of the note", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.clickListen();

  await reader.verifyPlayerIsDocked(true);
  await reader.verifyPlayerHoldsTheWindowFoot();
});

// Seeded with all of these, so what the panel keeps is asserted, not passed on an empty fixture.
test("the panel keeps the judgement beside the topics, and the dates with it", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifyChannelReads("Practical Engineering");
  await reader.verifyMastheadMentions(/Original/);
  await reader.verifyMastheadMentions(/Thin/);
  await reader.verifyMastheadMentions(/Dubious claim/);

  await reader.verifyPublishedReads("· published 1 Sept 2026");
  await reader.verifyMastheadMentions(/saved 16 Sep/);
});

test("the verdict and the warnings sit on the channel's line", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifyJudgementSharesTheChannelLine();
});

test("the wide reader keeps all of it, having the width for it", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyPublishedReads("· published 1 Sept 2026");
  await reader.verifyMastheadMentions(/saved 16 Sep/);
  await reader.verifyMastheadMentions(/Original/);
  await reader.verifyMastheadMentions(/Thin/);
  await reader.verifyMastheadMentions(/Dubious claim/);
});

test("the actions menu opens inside the panel and over the tabs, not under them", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 400, height: 720 });
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.openActionsMenu();

  await reader.verifyActionsMenuIsShown(true);
  await reader.verifyActionsMenuFitsAndIsOnTop();
});
