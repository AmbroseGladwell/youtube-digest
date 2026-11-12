import { DEFAULT_SECTIONS_ENABLED, VideoId, type SourceStep } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const VIDEO_ID = "stepsVideo1";
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const step = (text: string, startMs: number | null, dubiousReason: string | null = null): SourceStep => ({
  text,
  range: startMs === null ? null : { startMs, endMs: startMs + 20_000 },
  dubiousReason,
});

const SLEEP_STEPS = [
  step("Get outside into daylight within 30 minutes of waking.", 45_000),
  step("Wait 90 minutes after waking before your first coffee.", 130_000, "It rests on one small study; later trials found no difference."),
  step("Keep the bedroom at about 18°C.", 302_000),
];

const LONG_STEPS = Array.from({ length: 18 }, (_, index) => step(`Do step ${index + 1} of the routine.`, 60_000 * (index + 1)));

const seedNote = (backendSimulator: BackendSimulator, items: SourceStep[]) => {
  const overview = makeOverview({ sourceSteps: { items }, howToApply: { items: ["Try the daylight step on workdays first."] } });
  const seeded = {
    ...overview,
    source: { ...overview.source, id: VideoId.parse(VIDEO_ID), url: `https://www.youtube.com/watch?v=${VIDEO_ID}` },
  };
  backendSimulator.overviews.seed(seeded);
  return seeded;
};

const stepEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("reader.sourceSteps.") || name === "reader.page.opened");

test("the steps a video gives sit under their own heading, numbered in its order, beside a How to apply for anyone", async ({
  launcher,
  backendSimulator,
}) => {
  seedNote(backendSimulator, SLEEP_STEPS);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.sourceSteps.verifyCaptionReads("From the video, in its order");
  await reader.sourceSteps.verifyShownStepsRead(SLEEP_STEPS.map(({ text }) => text));
  await reader.sourceSteps.verifyNoShowAll();
  await reader.sourceSteps.verifyOtherListsAreDotted(true);
  await reader.sourceSteps.verifyHowToApplyIsPersonalised(false);
  await expect
    .poll(() => stepEvents(backendSimulator).map(({ name, props }) => [name, props["steps"]]))
    .toEqual([["reader.page.opened", 3]]);
});

test("How to apply is tagged as the reader's when we know them", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator, SLEEP_STEPS);
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, aboutYou: { who: ["nurse"], time: [], focus: [] } });
  const reader = await library.nthCard(0).openReader();

  await reader.sourceSteps.verifyHowToApplyIsPersonalised(true);
});

test("a dubious step keeps its place and opens why it is flagged, with the moment it was said", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator, SLEEP_STEPS);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.sourceSteps.verifyDubiousFlagCount(1);
  await reader.sourceSteps.clickDubiousFlagOn("Wait 90 minutes");

  await reader.sourceSteps.verifyDubiousReasonReads("It rests on one small study; later trials found no difference.", "Said at 2:10");
  await reader.sourceSteps.verifyShownStepsRead(SLEEP_STEPS.map(({ text }) => text));
  await expect
    .poll(() => stepEvents(backendSimulator).map(({ name }) => name))
    .toEqual(["reader.page.opened", "reader.sourceSteps.dubiousOpened"]);
});

test("a long list shows its first five and says how many more there are and where they run to", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator, LONG_STEPS);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.sourceSteps.verifyShownStepsRead(LONG_STEPS.slice(0, 5).map(({ text }) => text));
  await reader.sourceSteps.verifyShowAllReads("Show all 18 steps13 more, up to 18:00");

  await reader.sourceSteps.clickShowAll();

  await reader.sourceSteps.verifyShownStepsRead(LONG_STEPS.map(({ text }) => text));
  await reader.sourceSteps.verifyFocusIsOnStep("Do step 6 of the routine.");
  await expect
    .poll(() =>
      stepEvents(backendSimulator)
        .filter(({ name }) => name === "reader.sourceSteps.allShown")
        .map(({ props }) => props["steps"]),
    )
    .toEqual([18]);
});

test("with the steps switched off, an overview that has them doesn't show them", async ({ launcher, backendSimulator }) => {
  seedNote(backendSimulator, SLEEP_STEPS);
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, steps: false } });
  const reader = await library.nthCard(0).openReader();

  await reader.sourceSteps.verifyIsNotShown();
  await reader.sourceSteps.verifyOtherListsAreDotted(false);
  await expect
    .poll(() => stepEvents(backendSimulator).map(({ name, props }) => [name, props["steps"]]))
    .toEqual([["reader.page.opened", 0]]);
});

test("the steps have their own switch in Settings › Personalisation, which says it hides them everywhere", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch(SIGNED_IN);
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.verifySwitchIs("The steps it gives", true);
  await settings.personalisation.verifyStepsOffNoteIsShown(false);

  await settings.personalisation.clickSwitch("steps");

  await settings.personalisation.verifySwitchIs("The steps it gives", false);
  await settings.personalisation.verifyStepsOffNoteIsShown(true);
  await settings.verifyRowReads("personalisation", "About you not set · 4 of 5 sections");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("settings.personalisation.")))
    .toEqual([{ name: "settings.personalisation.sectionSwitched", props: { section: "steps", on: false } }]);
});
