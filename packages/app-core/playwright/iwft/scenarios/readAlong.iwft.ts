import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const NOTE = makeOverview({
  inOneLine: "A talking-head explainer about three data points.",
  coreClaim: "The economy may finally be improving.",
  keyPoints: ["Growth beat expectations.", "Productivity is moving.", "Hiring intent has turned."],
  verdict: { novelty: "recycled", dubious: false, reasoning: "Standard synthesis.", similarTo: [] },
  watchAnyway: { answer: "no", reason: "A written note carries it.", range: null },
});

test("the reader opens on the note's first line, with the player naming that section", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.verifyActiveLineReads("In one line");
  await reader.verifyNowReading("Summary");
});

test("tapping a line moves the reading mark to it and renames what is being read", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.clickLineWithText("Productivity is moving.");

  await reader.verifyActiveLineReads("Productivity is moving.");
  await reader.verifyNowReading("Key points");
});

test("the transport steps the reading mark forward and back a line at a time", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.clickNextLine();
  await reader.verifyActiveLineReads("A talking-head explainer about three data points.");

  await reader.clickPreviousLine();
  await reader.verifyActiveLineReads("In one line");
});

test("the rail jumps the reading mark to the section it names", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.clickSection("Watch it anyway?");

  await reader.verifyActiveLineReads("Watch it anyway?");
  await reader.verifyNowReading("Watch it anyway?");
});

test("the speed control cycles the design's four rates and comes back round", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.verifyRateReads("1x");
  await reader.clickRate();
  await reader.verifyRateReads("1.25x");
  await reader.clickRate();
  await reader.clickRate();
  await reader.verifyRateReads("2x");
  await reader.clickRate();
  await reader.verifyRateReads("1x");
});

test("favouriting from the player bar is reflected immediately and written to the store", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.verifyIsFavourited(false);
  await reader.clickFavourite();
  await reader.verifyIsFavourited(true);

  await expect(async () => {
    const state = await backendSimulator.overviewStore.getOverviewState(NOTE.id);
    expect(state.favourite).toBe(true);
  }).toPass();
});

test("marking read from the masthead is written to the store and survives going back", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.clickMarkRead();
  await reader.verifyIsRead(true);

  const back = await reader.clickBackToLibrary();
  await back.nthCard(0).verifyIsRead(true);
});

test("Previous and Next walk the library in saved order, and the position says where you are", async ({
  launcher,
  backendSimulator,
}) => {
  const newest = makeOverview({ savedAt: "2026-09-16T00:00:00.000Z" });
  const middle = makeOverview({ savedAt: "2026-09-15T00:00:00.000Z" });
  const oldest = makeOverview({ savedAt: "2026-09-14T00:00:00.000Z" });
  backendSimulator.overviews.seed(newest);
  backendSimulator.overviews.seed(middle);
  backendSimulator.overviews.seed(oldest);

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.verifyPosition("1 of 3");

  await reader.clickNextOverview();
  await reader.verifyPosition("2 of 3");
});

test("the transcript and chapters tabs say on screen that their content is placeholder", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");
  await reader.verifyShowsTranscriptPlaceholder();

  await reader.clickTab("Chapters");
  await reader.verifyShowsChaptersPlaceholder();

  await reader.clickTab("Overview");
  await reader.verifyShowsOverviewPanel();
});

test("the meta line names the video's length only when the source recorded one", async ({
  launcher,
  backendSimulator,
}) => {
  const timed = makeOverview({ video: { ...NOTE.video, durationMs: 698_000 } });
  backendSimulator.overviews.seed(timed);

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyMetaReads("1 min read · 1 min listen · 11:38 video");
});

test("the tabs come to rest on the masthead's lower edge, and follow it when it grows", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.scrollDown(500);
  await reader.verifyTabsRestOnTheMasthead();

  await launcher.appShell.clickNewOverview();
  await reader.verifyTabsRestOnTheMasthead();
});

// A real YouTube thumbnail is far wider than a phone. Rendered at its intrinsic size it
// pushes the whole page sideways, so the stacked layout has to hold it to the column.
const WIDE_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect width='1280' height='720' fill='%23cccccc'/%3E%3C/svg%3E";

test("a full-width thumbnail on a phone stays in its column instead of widening the page", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, thumbnailUrl: WIDE_THUMBNAIL },
  });
  await page.setViewportSize({ width: 390, height: 780 });

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyPageDoesNotScrollSideways();
});
