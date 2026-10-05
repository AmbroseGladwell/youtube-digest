import type { DubiousClaim } from "@overview/domain";
import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const VIDEO_ID = "dubiousVideo1";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test" };
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const CLAIMS: DubiousClaim[] = [
  {
    claim: "Cold plunges double your testosterone.",
    basis: "contradictsSettled",
    reason: "The studies he cites found a short spike, not a doubling.",
    startMs: 61_000,
  },
  {
    claim: "My supplement is the only safe way to recover.",
    basis: "conflictOfInterest",
    reason: "He sells the supplement and names no alternative.",
    startMs: 200_000,
  },
];

const seedNote = (backendSimulator: BackendSimulator, dubiousClaims: DubiousClaim[] | null) => {
  const overview = makeOverview({
    verdict: {
      novelty: "recycled",
      dubious: dubiousClaims === null || dubiousClaims.length > 0,
      dubiousClaims,
      reasoning: "Familiar advice, oversold.",
      similarTo: [],
    },
  });
  const seeded = { ...overview, video: { ...overview.video, id: VideoId.parse(VIDEO_ID), url: VIDEO_URL } };
  backendSimulator.overviews.seed(seeded);
  return seeded;
};

const dubiousEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("reader.dubiousReasons."));

test("the dubious flag explains itself: each claim, why it is dubious, and the moment it is said", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, CLAIMS);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyDubiousFlagIsNamed("2 dubious claims");
  const panel = await reader.clickDubiousFlag();

  await panel.verifyCountReads("2 claims, worst first");
  await panel.verifyClaimsRead(CLAIMS.map(({ claim }) => claim));
  await panel.verifyBasesRead(["Contradicts settled evidence", "Conflict of interest"]);
  await panel.verifyReasonsMention(CLAIMS.map(({ reason }) => reason));
  await panel.verifyOffersToWatchFrom([
    { label: "Watch from 1:01", url: `${VIDEO_URL}&t=61` },
    { label: "Watch from 3:20", url: `${VIDEO_URL}&t=200` },
  ]);
});

test("a single claim is named as one, with no count over the panel", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator, [CLAIMS[0]!]);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyDubiousFlagIsNamed("Dubious claim");
  const panel = await reader.clickDubiousFlag();

  await panel.verifyShowsNoCount();
  await panel.verifyClaimsRead([CLAIMS[0]!.claim]);
});

test("the explanation opens and closes by keyboard, taking focus in and giving it back to the flag", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, CLAIMS);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  const panel = await reader.openDubiousReasonsByKeyboard();
  await panel.verifyFocusIsOnHeading();
  await panel.pressEscape();

  await panel.verifyIsNotShown();
  await reader.verifyDubiousFlagIsFocused();

  const reopened = await reader.clickDubiousFlag();
  await reopened.clickClose();
  await reopened.verifyIsNotShown();
  await reader.verifyDubiousFlagIsFocused();
});

test("the flag closes the explanation it opened", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator, CLAIMS);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  const panel = await reader.clickDubiousFlag();
  await reader.clickDubiousFlagToClose();

  await panel.verifyIsNotShown();
});

test("a note made before reasons were saved says so, rather than showing an empty panel", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, null);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  const panel = await reader.clickDubiousFlag();

  await panel.verifySaysNoReasonWasSaved();
});

test("a note that is not dubious has no flag to open", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator, []);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHasNoDubiousFlag();
});

test("beside the video, a claim's moment skips the video there and leaves the explanation open", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator, CLAIMS);
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: { videoId: VIDEO_ID, positionMs: 0, playing: true },
  });
  const reader = await capture.openStoredOverview();

  const panel = await reader.clickDubiousFlag();
  await panel.clickSkipTo(1);
  await panel.clickSkipTo(0);

  await expect.poll(() => launcher.readPlaybackSeeks()).toEqual([200_000, 61_000]);
  await panel.verifyIsShown();
});

test("opening the explanation, following a moment and saying it looks wrong are counted", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = seedNote(backendSimulator, CLAIMS);
  const capture = await launcher.launchPanel({
    ...SIGNED_IN,
    apiKeys: API_KEYS,
    activeVideoUrl: VIDEO_URL,
    playback: { videoId: VIDEO_ID, positionMs: 0, playing: true },
  });
  const reader = await capture.openStoredOverview();

  const panel = await reader.clickDubiousFlag();
  await panel.clickThisLooksWrong();
  await panel.clickSkipTo(0);

  const overviewId = overview.id;
  await expect
    .poll(() => dubiousEvents(backendSimulator))
    .toEqual([
      { name: "reader.dubiousReasons.opened", props: { overviewId, reasonsSaved: 2 } },
      { name: "reader.dubiousReasons.markedWrong", props: { overviewId } },
      { name: "reader.dubiousReasons.momentFollowed", props: { overviewId, by: "skip" } },
    ]);
});

test("opening a note with no reason saved is counted as none saved", async ({ launcher, backendSimulator }) => {
  const overview = seedNote(backendSimulator, null);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickDubiousFlag();

  await expect
    .poll(() => dubiousEvents(backendSimulator))
    .toEqual([{ name: "reader.dubiousReasons.opened", props: { overviewId: overview.id, reasonsSaved: 0 } }]);
});

// The fixture answers with a segment index; the moment below is the transcript's own time.
test("a freshly generated dubious overview explains itself, its moment timed from the transcript", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.setGeneratedOutputOverrides({
    verdict: {
      novelty: "recycled",
      dubiousClaims: [
        {
          claim: "The simulated technique works because the fixture says so.",
          basis: "contradictsSettled",
          reason: "A fixture saying so is not evidence.",
          segmentIndex: 1,
        },
      ],
      reasoning: "This is fixture reasoning text, not a real judgment.",
      similarToIndices: [],
    },
  });
  await launcher.launch({ apiKeys: API_KEYS });
  const newOverview = await launcher.appShell.openNewOverview();
  await newOverview.form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  await newOverview.clickReadOverview();
  const reader = await launcher.readerPage.verifyIsShown();

  const panel = await reader.clickDubiousFlag();

  await panel.verifyClaimsRead(["The simulated technique works because the fixture says so."]);
  await panel.verifyOffersToWatchFrom([
    { label: "Watch from 0:03", url: `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}&t=3` },
  ]);
});
