import { expect, test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import {
  SIMULATED_ACCOUNT_ID,
  SIMULATED_EMAIL,
  SIMULATED_SECONDS_PER_LINE,
  type BackendSimulator,
} from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const NOTE = makeOverview({
  inOneLine: "A talking-head explainer about three data points.",
  coreClaim: "The economy may finally be improving.",
  keyPoints: [
    { text: "Growth beat expectations.", range: null },
    { text: "Productivity is moving.", range: null },
    { text: "Hiring intent has turned.", range: null },
  ],
  howToApply: { items: ["Re-run the hiring forecast."] },
  verdict: {
    novelty: "common_knowledge",
    standsOut: null,
    dubious: false,
    dubiousClaims: [],
    reasoning: "Standard synthesis.",
    similarTo: [],
  },
  watchAnyway: { answer: "no", reason: "A written note carries it.", range: null },
});

// Premise, its line, Core claim, its line, Verdict, two lines, Key points, then the points.
const PRODUCTIVITY_LINE = 9;

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

// On Plus our key goes first, so a note made here is one ours made, and is narrated ahead
// (docs/architecture/tiers.md, "What an own-key overview costs us").
const ON_OUR_KEY = {
  sync: true,
  syncConnection: { ...SIGNED_IN.syncConnection, accountId: SIMULATED_ACCOUNT_ID },
  plan: "plus" as const,
};

const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = ANTHROPIC_KEY;

test("narration that exists says so before the first press, and plays on its own timings", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.verifyBarSays("Narrated · Heart voice");
  await reader.verifySkipIsEnabled(false);

  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing · Premise$/);
  await reader.verifyIsThePacer(false);
  await reader.verifyScrubberSecondsAtLeast(SIMULATED_SECONDS_PER_LINE);
  await reader.verifyActiveLineReads("A talking-head explainer about three data points.");
});

test("narration opens by naming the video, with the bar on its title and no line lit, then reaches the premise", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickPlayPause();
  await reader.verifyBarSays(`Now playing · ${NOTE.source.title}`);
  await reader.verifyNoLineIsActive();

  await reader.verifyBarSays(/^Now playing · Premise$/);
  await reader.verifyActiveLineReads("Premise");
});

test("tapping a line seeks the narration to where that line starts", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing/);

  await reader.clickLineWithText("Productivity is moving.");

  await reader.verifyActiveLineReads("Productivity is moving.");
  await reader.verifyScrubberSecondsAtLeast(PRODUCTIVITY_LINE * SIMULATED_SECONDS_PER_LINE);
  await reader.verifyBarSays("Now playing · Key points");
});

test("dragging the scrubber names the line it will land on, and lands on its start", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing/);

  const landing = await reader.dragScrubberTo(0.6);

  expect(landing).toMatch(/^Key points · line \d+ · \d+:\d{2}$/);
  await reader.verifyBarSays("Now playing · Key points");
});

test("the transport skips fifteen seconds, and the lines are a keystroke apart", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing/);

  await reader.clickSkipForward();
  await reader.verifyScrubberSecondsAtLeast(15);

  await reader.pressLineKey("]");
  await reader.verifyScrubberSecondsAtLeast(16);
});

test("an old note makes its audio on first play, saying so while it waits", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.verifyBarSays("Audio is made on first play · about 20 s");
  await reader.clickPlayPause();

  await reader.verifyBarSays("Preparing audio · Queued");
  await reader.verifyShowsPreparingSweep();
  await reader.verifyPlayButtonReads("Cancel preparing audio");

  backendSimulator.narration.finishRenders();
  await reader.verifyBarSays(/^Now playing · /);
  await reader.verifyScrubberSecondsAtLeast(1);
});

test("a render that gives up says so in plain words, and reading along instead starts the pacer", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  await reader.clickPlayPause();
  await reader.verifyBarSays("Preparing audio · Queued");

  backendSimulator.narration.failRenders();
  await reader.verifyBarSays("Couldn't prepare the audio");
  await reader.verifyOffersBarAction("tryAgain", true);

  await reader.clickBarAction("readAlongInstead");
  await reader.verifyIsThePacer(true);
  await reader.verifyPlayButtonReads("Pause");
});

test("an account with renders already waiting is told to wait, and offered the pacer", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.accountIsBusy();
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickPlayPause();

  await reader.verifyBarSays("A few notes are already being prepared · try again when one finishes");
  await reader.clickBarAction("readAlong");
  await reader.verifyIsThePacer(true);
});

test("past the day's new narration the note reads along instead, saying when more comes", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.dailyCapIsSpent();
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickPlayPause();

  await reader.verifyBarSays("Read-along · no audio · you’ve started today’s new narration, more tomorrow");
  await reader.verifyIsThePacer(true);
});

test("a server with no narration is the pacer, marked as such and saying why", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.simulateEndpointError(EndpointKey.NARRATION_LOOKUP);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.verifyBarSays("Read-along · no audio · narration is unavailable right now");
  await reader.verifyOffersSignInForAudio(false);
});

test("reaching the end offers to play again and to mark the note read", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing/);

  await reader.pressOnScrubber("End");

  await reader.verifyBarSays("Finished");
  await reader.verifyPlayButtonReads("Play again");
  await reader.clickBarAction("markRead");
  await reader.verifyIsRead(true);
});

test("Listen in the library plays in place, and the mini-player follows you into the note", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const card = library.nthCard(0);

  await card.clickListen();

  await card.verifyListenReads("Playing");
  await launcher.miniPlayer.verifyIsShown(true);
  await launcher.miniPlayer.verifyTitleReads(NOTE.source.title);
  await launcher.miniPlayer.verifyPlayButtonReads("Pause");

  const reader = await launcher.miniPlayer.openReader();
  await launcher.miniPlayer.verifyIsShown(false);
  await reader.verifyBarSays(/^Now playing/);
});

test("pausing from the mini-player pauses the row too, and × stops and puts it away", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const card = library.nthCard(0);
  await card.clickListen();
  await card.verifyListenReads("Playing");

  await launcher.miniPlayer.clickPlayPause();
  await card.verifyListenReads("Listen");
  await launcher.miniPlayer.verifyPlayButtonReads("Play");

  await launcher.miniPlayer.clickClose();
  await launcher.miniPlayer.verifyIsShown(false);
});

test("a note made on our key asks for its narration in the background, and has it by the time it is opened", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const form = await launcher.launchExpectingFirstRun({ ...ON_OUR_KEY, apiKeys: API_KEYS });

  await form.submitUrl(VIDEO_URL);
  const dialog = launcher.appShell.newOverviewDialog;
  await dialog.verifyStepState("02", "done");
  await expect.poll(() => backendSimulator.narration.requestedPriorities()).toEqual(["background"]);

  backendSimulator.narration.finishRenders();
  await dialog.clickReadOverview();
  const reader = await launcher.readerPage.verifyIsShown();

  await reader.verifyBarSays("Narrated · Heart voice");
  expect(backendSimulator.narration.requestCount()).toBe(1);
});

test("a note made on the reader's own key asks for no narration until it is first played", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const form = await launcher.launchExpectingFirstRun({ ...ON_OUR_KEY, plan: "free", apiKeys: API_KEYS });
  await form.submitUrl(VIDEO_URL);
  const dialog = launcher.appShell.newOverviewDialog;
  await dialog.verifyStepState("02", "done");
  await dialog.clickReadOverview();
  const reader = await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.narration.requestCount()).toBe(0);

  await reader.clickPlayPause();

  await expect.poll(() => backendSimulator.narration.requestedPriorities()).toEqual(["interactive"]);
});

test("a note opened before its background render lands says it is preparing, and becomes narrated without playing", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const form = await launcher.launchExpectingFirstRun({ ...ON_OUR_KEY, apiKeys: API_KEYS });
  await form.submitUrl(VIDEO_URL);
  const dialog = launcher.appShell.newOverviewDialog;
  await dialog.verifyStepState("02", "done");
  await expect.poll(() => backendSimulator.narration.requestedPriorities()).toEqual(["background"]);

  await dialog.clickReadOverview();
  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyBarSays("Preparing audio · Queued");
  await reader.verifyShowsPreparingSweep();
  await reader.verifyPlayButtonReads("Play");

  backendSimulator.narration.finishRenders();

  await reader.verifyBarSays("Narrated · Heart voice");
  await reader.verifyPlayButtonReads("Play");
  expect(backendSimulator.narration.requestCount()).toBe(1);
});

test("pressing play while a background render is under way asks for it at the front, and plays when it lands", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const form = await launcher.launchExpectingFirstRun({ ...ON_OUR_KEY, apiKeys: API_KEYS });
  await form.submitUrl(VIDEO_URL);
  const dialog = launcher.appShell.newOverviewDialog;
  await dialog.verifyStepState("02", "done");
  await expect.poll(() => backendSimulator.narration.requestedPriorities()).toEqual(["background"]);
  await dialog.clickReadOverview();
  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyBarSays("Preparing audio · Queued");

  await reader.clickPlayPause();

  await reader.verifyPlayButtonReads("Cancel preparing audio");
  expect(backendSimulator.narration.requestedPriorities()).toEqual(["background", "interactive"]);
  backendSimulator.narration.finishRenders();
  await reader.verifyBarSays(/^Now playing · /);
});

test("a note made while signed out asks for no narration", async ({ launcher, backendSimulator }) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(VIDEO_URL);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  expect(backendSimulator.getCallCount(EndpointKey.NARRATION_REQUEST)).toBe(0);
});

test("a narration request that fails leaves the note it was made for saved and readable", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.NARRATION_REQUEST);
  backendSimulator.ourKey.isAvailable();
  const form = await launcher.launchExpectingFirstRun({ ...ON_OUR_KEY, apiKeys: API_KEYS });

  await form.submitUrl(VIDEO_URL);
  const dialog = launcher.appShell.newOverviewDialog;
  await dialog.verifyStepState("02", "done");
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.NARRATION_REQUEST)).toBe(1);

  await dialog.clickReadOverview();
  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle("The Simulated Video");
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
});

test("a press says which state the player was in, so a listen begun is told from one carried on", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing/);
  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Paused/);
  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing/);

  await expect
    .poll(() =>
      backendSimulator.analytics
        .events()
        .filter(({ name }) => name === "reader.playerBar.mainPressed")
        .map(({ props }) => props),
    )
    .toEqual([
      { button: "play", state: "ready", overviewId: NOTE.id },
      { button: "pause", state: "playing", overviewId: NOTE.id },
      { button: "play", state: "paused", overviewId: NOTE.id },
    ]);
});

const firstSounds = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics
    .events()
    .filter(({ name }) => name === "player.playback.firstSound")
    .map(({ props }) => props);

test("the wait from pressing play to the first sound is counted, with narration that was ready marked as not prepared", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing/);

  await expect
    .poll(() => firstSounds(backendSimulator))
    .toEqual([{ overviewId: NOTE.id, from: "playerBar", source: "audio", prepared: false, waitMs: expect.any(Number) }]);
  const { waitMs } = firstSounds(backendSimulator)[0]!;
  expect(Number.isInteger(waitMs)).toBe(true);
  expect(waitMs).toBeGreaterThanOrEqual(0);
});

test("narration made on the press counts its wait as prepared", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickPlayPause();
  await reader.verifyBarSays("Preparing audio · Queued");
  backendSimulator.narration.finishRenders();
  await reader.verifyBarSays(/^Now playing · /);

  await expect
    .poll(() => firstSounds(backendSimulator))
    .toEqual([{ overviewId: NOTE.id, from: "playerBar", source: "audio", prepared: true, waitMs: expect.any(Number) }]);
});

test("Listen in the library counts its first sound as from the row, and pausing then playing again does not count twice", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const card = library.nthCard(0);

  await card.clickListen();
  await expect
    .poll(() => firstSounds(backendSimulator))
    .toEqual([{ overviewId: NOTE.id, from: "libraryRow", source: "audio", prepared: false, waitMs: expect.any(Number) }]);

  await launcher.miniPlayer.clickPlayPause();
  await launcher.miniPlayer.verifyPlayButtonReads("Play");
  await launcher.miniPlayer.clickPlayPause();
  await launcher.miniPlayer.verifyPlayButtonReads("Pause");

  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "player.miniPlayer.playToggled").length)
    .toBe(2);
  expect(firstSounds(backendSimulator)).toHaveLength(1);
});

const listens = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics
    .events()
    .filter(({ name }) => name === "player.playback.started" || name === "player.playback.ended")
    .map(({ name, props }) => ({ name, props }));

// Short enough that a listen reaches its end within the test, long enough for the bar to be seen playing.
const QUICK_SECONDS_PER_LINE = 0.5;

test("a listen played to its end is counted as finished with all of the note heard, and the opening it had", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE, undefined, QUICK_SECONDS_PER_LINE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickPlayPause();
  await reader.verifyBarSays(/^Now playing/);
  await reader.verifyBarSays(/^Finished/);

  await expect
    .poll(() => listens(backendSimulator))
    .toEqual([
      { name: "player.playback.started", props: { overviewId: NOTE.id, source: "audio" } },
      {
        name: "player.playback.ended",
        props: { overviewId: NOTE.id, source: "audio", percentHeard: 100, reason: "finished", withOpening: true },
      },
    ]);
});

test("stopping from the mini-player ends the listen as stopped, with what was heard in whole tens", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.nthCard(0).clickListen();
  await launcher.miniPlayer.verifyPlayButtonReads("Pause");
  await expect.poll(() => listens(backendSimulator)).toHaveLength(1);
  await launcher.miniPlayer.clickClose();

  await expect.poll(() => listens(backendSimulator).map(({ name }) => name)).toEqual(["player.playback.started", "player.playback.ended"]);
  const { props } = listens(backendSimulator)[1]!;
  expect(props).toEqual({
    overviewId: NOTE.id,
    source: "audio",
    percentHeard: expect.any(Number),
    reason: "stopped",
    withOpening: true,
  });
  const percentHeard = Number(props.percentHeard);
  expect(percentHeard % 10).toBe(0);
  expect(percentHeard).toBeLessThan(100);
});
