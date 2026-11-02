import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

// Every factory note takes a minute to read, so a video of n minutes saves n - 1.
const lasting = (minutes: number) =>
  makeOverview({ video: { ...makeOverview().video, durationMs: minutes * 60_000 } });

test("Mark read at the end of the note marks it read, agrees with the menu, and undoes", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.verifyNoteEndReadButtonReads("Mark read");

  await reader.clickNoteEndMarkRead();

  await reader.verifyNoteEndReadButtonReads("Read");
  await reader.verifyIsRead(true);
  await expect
    .poll(async () => (await backendSimulator.overviews.getState(overview.id)).read)
    .toBe(true);

  await reader.clickNoteEndMarkRead();

  await reader.verifyNoteEndReadButtonReads("Mark read");
  await reader.verifyIsRead(false);
});

test("the favourite at the end of the note and the one in the head are one state", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.clickNoteEndFavourite();

  await reader.verifyNoteEndFavouriteIs(true);
  await reader.verifyIsFavourited(true);
  await expect
    .poll(async () => (await backendSimulator.overviews.getState(overview.id)).favourite)
    .toBe(true);

  await reader.clickFavourite();

  await reader.verifyNoteEndFavouriteIs(false);
});

test("what the reader does at the end of the note is counted as done from there", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickNoteEndMarkRead();
  await reader.clickNoteEndFavourite();

  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("reader.overview.")))
    .toEqual([
      { name: "reader.overview.readSwitched", props: { overviewId: overview.id, read: true, from: "noteEnd" } },
      { name: "reader.overview.favouriteSwitched", props: { overviewId: overview.id, favourite: true, from: "noteEnd" } },
    ]);
});

test("marking it read here brings the saving in below the buttons, and nothing moves as it comes and goes", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(lasting(11));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  const before = await reader.noteEndButtonPositions();

  await reader.clickNoteEndMarkRead();

  await reader.verifySavedChipSays("Saved you 10 min");
  await reader.verifySavedChipIsCentredBelowNoteEndButtons();
  expect(await reader.noteEndButtonPositions()).toEqual(before);

  await reader.clickNoteEndMarkRead();

  await reader.verifyNoSavedChip();
  expect(await reader.noteEndButtonPositions()).toEqual(before);
});

test("marking it read from the head's menu keeps the saving in the head", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(lasting(11));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.clickMarkRead();

  await reader.verifySavedChipSays("Saved you 10 min");
  await reader.verifySavedChipIsInHead();
});

test("the buttons belong to the note, so the other tabs don't show them", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.verifyNoteEndActionsAreShown(true);

  await reader.clickTab("Chapters");

  await reader.verifyNoteEndActionsAreShown(false);
});

test("the panel's note ends with them too", async ({ launcher, backendSimulator }) => {
  const overview = lasting(11);
  backendSimulator.overviews.seed({
    ...overview,
    source: { ...overview.source, id: VideoId.parse(IWFT_VIDEO_ID), url: WATCHED_URL },
  });
  const capture = await launcher.launchPanel({ activeVideoUrl: WATCHED_URL });
  const reader = await capture.openStoredOverview();

  await reader.clickNoteEndMarkRead();

  await reader.verifyPanelReadButtonReads("Read");
  await reader.verifyNoteEndReadButtonReads("Read");
  await reader.verifySavedChipIsCentredBelowNoteEndButtons();
});
