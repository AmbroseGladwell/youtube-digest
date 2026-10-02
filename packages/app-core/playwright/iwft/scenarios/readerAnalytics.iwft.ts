import type { TranscriptSegment } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const VIDEO_ID = VideoId.parse("captionedVideo1");
const SEGMENTS: TranscriptSegment[] = makeCaptionRun(
  ["Productivity is the claim here,", "and productivity is the trap", "for anyone listening."],
  { startMs: 0, cueMs: 3500 },
);

const seedOne = (backendSimulator: BackendSimulator) => {
  const overview = makeOverview({
    watchAnyway: { answer: "no", reason: "The claim is in the first minute.", range: null },
  });
  const seeded = { ...overview, video: { ...overview.video, id: VIDEO_ID } };
  backendSimulator.overviews.seed(seeded);
  backendSimulator.transcripts.seed(makeStoredTranscript({ videoId: VIDEO_ID, segments: SEGMENTS }));
  return seeded;
};

const readerEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("reader."));

test("opening an overview is counted with what its verdict said, and what the reader then does carries its id", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = seedOne(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickTab("Chapters");
  await reader.clickMarkRead();
  await reader.clickFavourite();

  const overviewId = overview.id;
  await expect
    .poll(() => readerEvents(backendSimulator))
    .toEqual([
      {
        name: "reader.page.opened",
        props: {
          overviewId,
          answer: "no",
          novelty: overview.verdict?.novelty ?? "none",
          dubious: overview.verdict?.dubious ?? false,
          read: false,
          favourite: false,
        },
      },
      { name: "reader.tabs.switched", props: { overviewId, tab: "chapters" } },
      { name: "reader.actionsMenu.opened", props: { overviewId } },
      { name: "reader.actionsMenu.itemChosen", props: { overviewId, item: "toggleRead" } },
      { name: "reader.overview.readSwitched", props: { overviewId, read: true, from: "actionsMenu" } },
      { name: "reader.overview.favouriteSwitched", props: { overviewId, favourite: true, from: "masthead" } },
    ]);
});

test("searching the transcript is counted once the reader stops typing, with how many it found and never the words", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = seedOne(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Transcript");

  await reader.searchTheTranscript("productivity");

  await expect
    .poll(() => readerEvents(backendSimulator).filter(({ name }) => name === "reader.transcript.searched"))
    .toEqual([{ name: "reader.transcript.searched", props: { overviewId: overview.id, matches: 2 } }]);
  expect(JSON.stringify(backendSimulator.analytics.batches())).not.toContain("productivity");
});

test("the ⋯ menu's opening, closing and choices are counted", async ({ launcher, backendSimulator }) => {
  const overview = seedOne(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.openActionsMenu();
  await reader.clickAwayFromAnyPopover();
  await reader.openActionsMenu();
  await reader.clickReasonMenuItem();

  const overviewId = overview.id;
  await expect
    .poll(() => readerEvents(backendSimulator).filter(({ name }) => name.startsWith("reader.actionsMenu.")))
    .toEqual([
      { name: "reader.actionsMenu.opened", props: { overviewId } },
      { name: "reader.actionsMenu.closed", props: { overviewId } },
      { name: "reader.actionsMenu.opened", props: { overviewId } },
      { name: "reader.actionsMenu.itemChosen", props: { overviewId, item: "editReason" } },
    ]);
});
