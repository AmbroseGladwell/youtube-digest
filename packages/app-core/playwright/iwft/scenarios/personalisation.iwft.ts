import { DEFAULT_SECTIONS_ENABLED, ProjectId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { makeProject } from "../../../src/features/projects/types/ProjectFactory.testHelper.js";

// Overviews made on us, so the simulator holds the input each one was made from.
const SIGNED_IN_WITHOUT_A_KEY = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

test("the reader context and sections in Settings are what the next overview is made from", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const sectionsEnabled = { ...DEFAULT_SECTIONS_ENABLED, selling: false };
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, aboutYou: { who: ["nurse"], time: [], focus: ["new recipes"] }, sectionsEnabled });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  await launcher.readerPage.verifyIsShown();
  const [request] = backendSimulator.ourKey.generations();
  expect(request?.input.readerContext).toBe("I'm a nurse, and right now I'm focusing on new recipes.");
  expect(request?.input.sectionsEnabled).toEqual(sectionsEnabled);
});

test("turning a section off in Settings › Personalisation leaves it out of the next overview, and is counted", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.verifyRowReads("personalisation", "About you not set · Every section");

  await settings.personalisation.clickSwitch("watchAnyway");

  await settings.personalisation.verifySwitchIs("Watch it anyway?", false);
  await settings.personalisation.verifySwitchIs("Verdict", true);
  await settings.verifyRowReads("personalisation", "About you not set · 6 of 7 sections");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("settings.personalisation.")))
    .toEqual([{ name: "settings.personalisation.sectionSwitched", props: { section: "watchAnyway", on: false } }]);

  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  await launcher.readerPage.verifyIsShown();
  const [request] = backendSimulator.ourKey.generations();
  expect(request?.input.sectionsEnabled).toEqual({ ...DEFAULT_SECTIONS_ENABLED, watchAnyway: false });
});

test("About you set in Settings › Personalisation is what the next overview is written for, and can be cleared", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.verifyAboutYouIsNotSet();

  await settings.personalisation.openAboutYou();
  await settings.personalisation.sentence.fill("who", "parent");
  await settings.personalisation.sentence.fill("time", "teaching");
  await settings.personalisation.closeAboutYou();

  await settings.personalisation.verifyAboutYouReads("I'm a parent, and I spend my time on teaching.");
  await settings.verifyRowReads("personalisation", "A parent · Every section");
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBe("I'm a parent, and I spend my time on teaching.");

  const again = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await again.personalisation.clearAboutYou();
  await again.personalisation.verifyAboutYouIsNotSet();
});

test("a pick in Settings is kept when the card's Done is pressed with the sheet still open", async ({ launcher }) => {
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");

  await settings.personalisation.openAboutYou();
  await settings.personalisation.sentence.openSection("who");
  await settings.personalisation.sentence.pick("parent");
  await settings.personalisation.sentence.verifySentenceReads(
    "I'm a parent, I spend my time on all sorts, and right now I'm focusing on getting better at something.",
  );
  await settings.personalisation.closeAboutYou();

  await settings.personalisation.verifyAboutYouReads("I'm a parent.");
});

test("the sentence reopens in Settings as it was left, and an old line can be seen and edited", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, aboutYou: { who: ["dad"], time: ["A nurse learning to cook"], focus: [] } });
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.verifyAboutYouReads("I'm a dad, and I spend my time on A nurse learning to cook.");

  await settings.personalisation.openAboutYou();
  await settings.personalisation.sentence.openSection("time");
  await settings.personalisation.sentence.verifyInSection("A nurse learning to cook");
  await settings.personalisation.sentence.remove("A nurse learning to cook");
  await settings.personalisation.sentence.pick("healthcare");
  await settings.personalisation.sentence.done();
  await settings.personalisation.closeAboutYou();

  await settings.personalisation.verifyAboutYouReads("I'm a dad, and I spend my time on healthcare.");
});

test.describe("filing into projects", () => {
  const kitchen = makeProject();
  const launch = makeProject({ id: ProjectId.parse("5c0f1b7e-2a4d-4c3e-8f61-9b2d7e4a1c30"), name: "Launch", purpose: null });
  const shed = makeProject({
    id: ProjectId.parse("1e9a4c2b-7d3f-4a51-9c8e-6f0b2d5a7e14"),
    name: "Old shed",
    archivedAt: "2026-11-15T09:00:00.000Z",
  });

  test("a new overview is offered the active projects and filed into those our key matched", async ({ launcher, backendSimulator }) => {
    backendSimulator.ourKey.isAvailable();
    backendSimulator.ourKey.filesInto(["Kitchen renovation"]);
    for (const project of [kitchen, launch, shed]) backendSimulator.projects.seed(project);
    await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
    const dialog = await launcher.appShell.openNewOverview();

    await dialog.form.submitUrl(VALID_URL);
    await dialog.clickReadOverview();

    await launcher.readerPage.verifyIsShown();
    expect(backendSimulator.ourKey.generations()[0]?.input.existingProjects).toEqual([
      { id: kitchen.id, name: kitchen.name, purpose: kitchen.purpose },
      { id: launch.id, name: "Launch", purpose: null },
    ]);
    await expect
      .poll(async () => (await backendSimulator.projects.members()).map(({ projectId, addedBy }) => ({ projectId, addedBy })))
      .toEqual([{ projectId: kitchen.id, addedBy: { by: "filing" } }]);
  });

  test("turning filing off in Settings › Personalisation sends no projects with the next overview, and is counted", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.ourKey.isAvailable();
    backendSimulator.ourKey.filesInto(["Kitchen renovation"]);
    backendSimulator.projects.seed(kitchen);
    await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
    const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
    await settings.personalisation.verifySwitchIs("File new overviews into projects", true);

    await settings.personalisation.clickProjectFilingSwitch();

    await settings.personalisation.verifySwitchIs("File new overviews into projects", false);
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("settings.personalisation.")))
      .toEqual([{ name: "settings.personalisation.projectFilingSwitched", props: { on: false } }]);
    const dialog = await launcher.appShell.openNewOverview();
    await dialog.form.submitUrl(VALID_URL);
    await dialog.clickReadOverview();

    await launcher.readerPage.verifyIsShown();
    expect(backendSimulator.ourKey.generations()[0]?.input.existingProjects).toEqual([]);
    expect(await backendSimulator.projects.members()).toEqual([]);
  });
});
