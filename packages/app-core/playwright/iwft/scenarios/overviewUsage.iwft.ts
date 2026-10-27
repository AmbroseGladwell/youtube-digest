import { test, expect } from "../../support/fixtures.testHelper.js";
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

test("once the reader's own key is spent, the line says this one uses ours and mentions Plus, and Generate stays", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 10, ours: 1 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUsageLineReads(
    "This month's 10 on your own key are made, so this one is on us: 4 of 5 left. · Get more overviews with Plus · See plans",
  );
  await dialog.form.verifyGenerateButtonEnabled();
});

test("on Plus the line counts our key first", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 12 });
  await launcher.launch({ ...SIGNED_IN, plan: "plus" });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUsageLineReads("38 of 50 left on us this month · Resets 1 November · Plan");
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

// At the limit, the message takes Generate's place and offers only routes that exist
// (designs 95i–95o; docs/architecture/tiers.md, "At the limit").
test("on Free with no key, our key's 5 spent: the message says when more come, takes focus, and leads to a key", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyLimitMessage({
    title: "You've made this month's 5. More on 1 November.",
    body: "Get more overviews with Plus. Or add your own key: your free account makes 10 a month with it.",
    actions: ["Add your own key", "See plans"],
  });
  await dialog.form.verifyLimitActionIsFocused("addKey");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("capture.limitMessage")))
    .toContainEqual({ name: "capture.limitMessage.shown", props: { quota: "ours", plan: "free", from: "dialog" } });

  await dialog.form.clickLimitAction("addKey");
  await launcher.settingsPage.verifySectionIsShown("keys");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "capture.limitMessage.wayChosen"))
    .toEqual([{ name: "capture.limitMessage.wayChosen", props: { way: "addKey", from: "dialog" } }]);
});

test("on Free with both quotas spent, the message names both and offers BYO Plus", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 10, ours: 5 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyLimitMessage({
    title: "You've made this month's 10 on your own key and 5 on us. More on 1 November.",
    body: "BYO Plus makes 200 a month on your own key.",
    actions: ["See BYO Plus"],
  });
});

test("on Plus with both quotas spent, the message says there's no upgrade, on the hero too", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 50, own: 200 });
  const home = await launcher.launch({ ...SIGNED_IN, plan: "plus" });
  await home.verifyLimitMessage({
    title: "You've made this month's 50 on us and 200 on your own. More on 1 November.",
    actions: ["See this month's usage"],
  });

  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.verifyLimitMessage({
    title: "You've made this month's 50 on us and 200 on your own. More on 1 November.",
    body: "That's the most any plan makes on your own key, so there's no upgrade for this.",
    actions: ["See this month's usage"],
  });
});

test("on Free with Only ever use my key on, the own key's 10 is the limit, and BYO Plus the way round", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 10 });
  await launcher.launch({ ...SIGNED_IN, onlyMyKey: true });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyLimitMessage({
    title: "You've made this month's 10 on your own key. More on 1 November.",
    actions: ["See BYO Plus"],
  });
});

test("on the panel, Plus with no key and our key spent is offered a key", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 50 });
  const capture = await launcher.launchPanel({
    ...SIGNED_IN_WITHOUT_A_KEY,
    plan: "plus",
    activeVideoUrl: VALID_URL,
    youTubeFetch: true,
  });

  await capture.verifyLimitMessage({
    title: "You've made this month's 50 on us. More on 1 November.",
    actions: ["Add your own key"],
  });
});

test("signed out with the trial spent, the hero offers an account in the same shape", async ({ launcher }) => {
  const home = await launcher.launch({ sync: true, apiKeys: ANTHROPIC_KEY, signedOutTrial: { made: 3, token: null } });

  await home.verifyLimitMessage({ title: "You've used your 3 trial overviews", actions: ["Create account"] });
});
