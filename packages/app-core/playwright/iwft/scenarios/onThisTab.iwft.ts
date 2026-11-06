import { VideoId } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const ANOTHER_ID = "anotherVideoId";
const ANOTHER_URL = `https://www.youtube.com/watch?v=${ANOTHER_ID}`;

const panel = { apiKeys: ANTHROPIC_KEY, activeVideoUrl: WATCHED_URL } as const;

const seedOpenNote = (backendSimulator: { overviews: { seed: (o: ReturnType<typeof makeOverview>) => void } }) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    source: { ...overview.source, id: VideoId.parse(IWFT_VIDEO_ID), url: WATCHED_URL },
  });
  return overview;
};

// Design 205e. The copy is generic on purpose: the reader can see the tab beside the
// panel, so naming it would only cost the line its one line.
test("with a note open, moving the tab on offers to make an overview of what's there now", async ({
  launcher,
  backendSimulator,
}) => {
  seedOpenNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();
  await reader.verifyOnThisTabLineIsShown(false);

  await launcher.watchAnotherVideo(ANOTHER_URL);

  await reader.verifyOnThisTabLineIsShown(true);
  await reader.verifyOnThisTabLineSays("Another video on this tab", "Make an overview");
});

test("where the library already holds it, the offer is to read it", async ({
  launcher,
  backendSimulator,
}) => {
  seedOpenNote(backendSimulator);
  const held = makeOverview();
  backendSimulator.overviews.seed({
    ...held,
    source: { ...held.source, id: VideoId.parse(ANOTHER_ID), url: ANOTHER_URL },
  });
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await launcher.watchAnotherVideo(ANOTHER_URL);

  await reader.verifyOnThisTabLineSays("Another video on this tab", "Read overview");
});

// The note being read is the one the tab is on, so there is nothing to have moved away
// from — and home is already the offer, so the line never shows there either.
test("the line stays away while the tab still holds the note's own video, and on home", async ({
  launcher,
  backendSimulator,
}) => {
  seedOpenNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifyOnThisTabLineIsShown(false);

  await launcher.watchAnotherVideo(ANOTHER_URL);
  await reader.verifyOnThisTabLineIsShown(true);

  await launcher.appShell.clickBrand();
  await capture.verifyIsShown();
  await reader.verifyOnThisTabLineIsShown(false);
});

// Dismissed for this tab, not for ever: moving on again asks afresh (205e-4).
test("dismissing it holds until the tab moves on again", async ({ launcher, backendSimulator }) => {
  seedOpenNote(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();
  await launcher.watchAnotherVideo(ANOTHER_URL);
  await reader.verifyOnThisTabLineIsShown(true);

  await reader.dismissOnThisTabLine();
  await reader.verifyOnThisTabLineIsShown(false);

  await launcher.watchAnotherVideo("https://www.youtube.com/watch?v=aThirdVideoId");

  await reader.verifyOnThisTabLineIsShown(true);
});
