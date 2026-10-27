import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

// What's left this month, wherever a reader generates and in Settings › Plan (designs
// 95a–95h, with the key order flipped for everyone but Plus, decided on OV-131).
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
  apiKeys: ANTHROPIC_KEY,
};
const { apiKeys: _noKey, ...SIGNED_IN_WITHOUT_A_KEY } = SIGNED_IN;

test("on Free with a key, the line counts the reader's own key first, and counts the overview just made", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 3 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUsageLineReads("7 of 10 left on your own key this month · Resets 1 November · Plan");
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();

  const again = await launcher.appShell.openNewOverview();
  await again.form.verifyUsageLineReads("6 of 10 left on your own key this month · Resets 1 November · Plan");
});

test("once the reader's own key is spent, the line says this one uses ours, and Generate stays", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 10, ours: 1 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUsageLineReads(
    "This month's 10 on your own key are made, so this one uses ours: 4 of 5 left. · Plan",
  );
  await dialog.form.verifyGenerateButtonEnabled();
});

test("on Plus the line counts our key first", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 12 });
  await launcher.launch({ ...SIGNED_IN, plan: "plus" });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUsageLineReads("38 of 50 left on our key this month · Resets 1 November · Plan");
});

test("while the counts load, the line and Settings read Checking…, never 0", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OVERVIEW_USAGE);
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.verifyUsageLineReads("Overviews left this month: Checking… · Plan");
  await dialog.form.clickCancel();

  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("plan", "Free · Checking…");
  await settings.openSection("plan");
  await settings.verifyPlanUsageCellReads("ours", ["Checking…"]);
  await settings.verifyPlanUsageCellReads("own", ["Checking…"]);
});

test("Plan on the line opens Settings › Plan, where both quotas are counted", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 3, ours: 5 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.clickUsagePlanLink();

  const settings = launcher.settingsPage;
  await settings.verifySectionIsShown("plan");
  await settings.verifyPlanReads("Free");
  await settings.verifyPlanUsagePeriodReads("This month · resets 1 November");
  await settings.verifyPlanUsageCellReads("ours", ["0 of 5 left", "None left. More on 1 November."]);
  await settings.verifyPlanUsageCellReads("own", ["7 of 10 left"]);
  await settings.verifyRowReads("plan", "Free · 7 of 10 left");
});

test("with no key saved, Settings gives the own-key quota as a number, with a way to add a key", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 38 });
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, plan: "plus" });
  const settings = await (await launcher.appShell.openSettings()).openSection("plan");

  await settings.verifyPlanReads("Plus");
  await settings.verifyPlanUsageCellReads("ours", ["12 of 50 left"]);
  await settings.verifyPlanUsageCellReads("own", ["200 a month", "Once you add a key · Add a key"]);
});

test("signed out, the line, the row and the panel count the trial's 3 on either key", async ({ launcher }) => {
  await launcher.launch({ sync: true, apiKeys: ANTHROPIC_KEY, signedOutTrial: { made: 1, token: null } });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.verifyUsageLineReads("2 of 3 trial overviews left · On either key · Plan");
  await dialog.form.clickCancel();

  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("plan", "Trial · 2 of 3 left");
  await settings.openSection("plan");
  await settings.verifyPlanReads("Trial");
  await settings.verifyPlanUsageCellsAre(["trial"]);
  await settings.verifyPlanUsageCellReads("trial", ["2 of 3 left", "On either key. They don't reset."]);
});

test("the panel's capture screen gives the narrow line", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 3 });
  const capture = await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: VALID_URL, youTubeFetch: true });

  await capture.verifyUsageLineReads("7 of 10 left on your own key · Resets 1 Nov");
});
