import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

// Long enough that the page scrolls well past a window, which is what reading ahead of
// the voice means.
const NOTE = makeOverview({
  inOneLine: "A talking-head explainer about three data points.",
  coreClaim: "The economy may finally be improving.",
  keyPoints: Array.from({ length: 12 }, (_, index) => ({
    text: `Point ${index + 1} carries on for a sentence or so, the way a real one does.`,
    range: null,
  })),
  howToApply: {
    items: Array.from({ length: 6 }, (_, index) => `Action ${index + 1}, written out at the length a real one runs to.`),
  },
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

// The bug: every open scrolled the page down to the premise before the reader had asked
// for anything (docs/features/audio-player.md, "The note follows the voice").
test("opening a note nobody is reading aloud leaves the page at the top", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.verifyActiveLineReads("Premise");

  await reader.verifyTheNoteStaysWhereItWasOpened();
  await reader.verifyOffersTheWayBackToTheVoice(false);
});

test("a note opened while it is being read aloud comes to the line being spoken", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickPlayPause();
  await reader.verifyPlayButtonReads("Pause");

  const back = await reader.clickBackToLibrary();
  const again = await back.nthCard(0).openReader();

  await again.verifyTheNoteHasScrolled();
  await again.verifyTheSpokenLineIsOnScreen(true);
});

test("reading ahead of the voice hands the scroll back, and the way back returns to it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickPlayPause();
  await reader.verifyPlayButtonReads("Pause");

  await reader.scrollDown(3000);

  await reader.verifyTheSpokenLineIsOnScreen(false);
  await reader.verifyOffersTheWayBackToTheVoice(true);
  await reader.verifyTheWayBackToTheVoiceReads(/^Back to /);

  await reader.clickBackToTheVoice();

  await reader.verifyTheSpokenLineIsOnScreen(true);
  await reader.verifyOffersTheWayBackToTheVoice(false);
});

// Nothing is reading, so nothing wants the scroll back: scrolling a note you are reading
// with your eyes is just reading it.
test("scrolling a note that is not being read aloud offers no way back", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.scrollDown(3000);

  await reader.verifyOffersTheWayBackToTheVoice(false);
});
