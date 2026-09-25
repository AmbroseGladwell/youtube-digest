import type { Chapter, TranscriptSegment } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("chapteredVideo1");
const VIDEO_URL = "https://www.youtube.com/watch?v=chapteredVideo1";
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

const CHAPTERS: Chapter[] = [
  { title: "The opening claim", summary: "What the video sets out to show.", startMs: 0, endMs: 65_000 },
  { title: "The argument", summary: "Where the case is actually made.", startMs: 65_000, endMs: 3_661_000 },
  { title: "The end", summary: "A sign-off and thanks.", startMs: 3_661_000, endMs: 3_667_000 },
];

const RANGES = ["0:00–1:05", "1:05–1:01:01", "1:01:01–1:01:07"];

const playingAt = (positionMs: number, videoId: string = VIDEO_ID) => ({
  videoId,
  positionMs,
  playing: true,
});

const panelWatching = { apiKeys: API_KEYS, activeVideoUrl: VIDEO_URL, playback: playingAt(5000) };

const seedNote = (
  backendSimulator: BackendSimulator,
  { chapters = CHAPTERS, transcript = true }: { chapters?: Chapter[] | null; transcript?: boolean } = {},
) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    chapters,
    video: { ...overview.video, id: VIDEO_ID, url: VIDEO_URL },
  });
  if (transcript) {
    backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));
  }
};

test("the chapters tab lists each stretch of the video with its range, title and summary", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Chapters");

  await reader.verifyChapterCountReads("3 chapters");
  await reader.verifyChapterRangesRead(RANGES);
  await reader.verifyChapterTitlesRead(CHAPTERS.map((chapter) => chapter.title));
  await reader.verifyChapterSummariesRead(CHAPTERS.map((chapter) => chapter.summary));
});

// The wide reader has no player to move, so a chapter links out to YouTube at its start,
// the way the rail's jump link already does.
test("on the wide reader a chapter's range links out to YouTube at its start", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Chapters");

  await reader.verifyChapterRangesLinkOut(true);
  await reader.verifyChapterRangeLinksTo("1:05–1:01:01", `${VIDEO_URL}&t=65`);
  await reader.verifyChapterRangesSeek(false);
});

test("in the panel a chapter's range sends the video to its start", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panelWatching);
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Chapters");

  await reader.verifyChapterRangesSeek(true);
  await reader.verifyChapterRangesLinkOut(false);
  await reader.clickChapterRange("1:05–1:01:01");

  await expect.poll(() => launcher.readPlaybackSeeks()).toEqual([65_000]);
});

test("the chapter the video is inside is marked, and the mark moves with it", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panelWatching);
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Chapters");

  await reader.verifyCurrentChapterReads("The opening claim");

  await launcher.movePlaybackTo(playingAt(70_000));
  await reader.verifyCurrentChapterReads("The argument");
});

test("a panel whose tab has moved to another video prints the ranges as plain text", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel({
    ...panelWatching,
    playback: playingAt(70_000, "someOtherVideo"),
  });
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Chapters");

  await reader.verifyChapterRangesRead(RANGES);
  await reader.verifyChapterRangesSeek(false);
  await reader.verifyChapterRangesLinkOut(false);
  await reader.verifyNoChapterIsCurrent();
});

test("Transcript opens the transcript at the chapter's start, marked and in view", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Chapters");

  await reader.clickChapterTranscript("The argument");

  await reader.verifyActiveTabIs("Transcript");
  await reader.verifyTargetTranscriptBlockReads(/where the argument is/);
});

test("choosing the Transcript tab yourself opens it at the top, with nothing marked", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Chapters");
  await reader.clickChapterTranscript("The argument");
  await reader.verifyTargetTranscriptBlockReads(/where the argument is/);

  await reader.clickTab("Chapters");
  await reader.clickTab("Transcript");

  await reader.verifyTranscriptBlockCountIs(3);
  await reader.verifyNoTranscriptBlockIsTargeted();
});

// Opening the transcript somewhere is scrolling away from the video, the same as
// searching is, so the following stands down and offers itself back.
test("opening the transcript from a chapter stands the following down", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator);
  const capture = await launcher.launchPanel(panelWatching);
  const reader = await capture.openStoredOverview();
  await reader.clickTab("Chapters");

  await reader.clickChapterTranscript("The end");

  await reader.verifyTargetTranscriptBlockReads(/where it ends/);
  await reader.verifyIsFollowingTheVideo(false);
  await reader.verifyOffersToFollowPlayback(true);
});

test("a note with no transcript stored offers no way into one", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, { transcript: false });
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Chapters");

  await reader.verifyChapterTitlesRead(CHAPTERS.map((chapter) => chapter.title));
  await reader.verifyChaptersOfferTranscript(false);
});

test("a note made before chapters existed says so, rather than showing an empty list", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, { chapters: null });
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Chapters");

  await reader.verifyChaptersNoteReads(/weren't made for this note/);
});

test("a note whose transcript had nothing to split says that instead", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, { chapters: [] });
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Chapters");

  await reader.verifyChaptersNoteReads(/nothing to split/);
});

// The fixture answers with segment indices; the ranges below are the transcript's own
// times, and the last chapter runs to the video's length rather than its last caption.
test("a freshly generated overview has chapters timed from its transcript", async ({ launcher }) => {
  const home = await launcher.launch({ apiKeys: API_KEYS });
  await home.verifyShowsFirstRunHero();
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  await dialog.clickReadOverview();
  const reader = await launcher.readerPage.verifyIsShown();

  await reader.clickTab("Chapters");

  await reader.verifyChapterCountReads("2 chapters");
  await reader.verifyChapterTitlesRead(["The greeting", "The claim and how to apply it"]);
  await reader.verifyChapterRangesRead(["0:00–0:03", "0:03–3:00"]);
});
