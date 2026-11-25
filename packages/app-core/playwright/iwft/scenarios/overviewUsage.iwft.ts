import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID, makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { OverviewId, SourceKey, VideoId, youTubeSource, type Capture } from "@overview/domain";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
  apiKeys: ANTHROPIC_KEY,
};
const { apiKeys: _noKey, ...SIGNED_IN_WITHOUT_A_KEY } = SIGNED_IN;

const keptLinkEvents = (backendSimulator: { analytics: { events: () => { name: string; props: unknown }[] } }, name: string) =>
  backendSimulator.analytics
    .events()
    .filter((event) => event.name === `keptLinks.saved.${name}`)
    .map((event) => event.props);

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

test("once the reader's own key is spent, the counter counts the overviews on us, and Generate stays", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 10, ours: 1 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyUsageLineReads("4 of 5 left this month · More on 1 November");
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
  await settings.verifyPlanSummaryReads("This month: Checking… · See usage");
  await settings.openSection("usage");
  await settings.verifyPlanUsageCellReads("ours", ["Checking…"]);
  await settings.verifyPlanUsageCellReads("own", ["Checking…"]);
});

test("Plan on the line opens Settings › Plan, whose usage line leads to both quotas counted", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 3, ours: 5 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.clickUsagePlanLink();

  const settings = launcher.settingsPage;
  await settings.verifySectionIsShown("plan");
  await settings.verifyPlanReads("Free");
  await settings.verifyPlanSummaryReads("This month: 7 of 10 overviews on your own key left · See usage");
  await settings.seeUsage();
  await settings.verifyUsagePlanReads("Your plan: Free");
  await settings.verifyUpgradeOffered(true);
  await settings.verifyPlanUsagePeriodReads("This month’s usage · resets 1 November");
  await settings.verifyPlanUsageCellReads("ours", ["0 of 5 left", "None left. More on 1 November."]);
  await settings.verifyPlanUsageCellReads("own", ["7 of 10 left"]);
  await settings.verifyRowReads("plan", "Free · 7 of 10 left");
});

test("with no key saved, Settings gives the own-key quota as a number, with a way to add a key", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 38 });
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, plan: "plus" });
  const settings = await (await launcher.appShell.openSettings()).openSection("usage");

  await settings.verifyUsagePlanReads("Your plan: Plus");
  await settings.verifyUpgradeOffered(false);
  await settings.verifyPlanUsageCellReads("ours", ["12 of 50 left"]);
  await settings.verifyPlanUsageCellReads("own", ["200 a month", "Once you add a key · Add a key"]);
});

test("the panel's capture screen gives the narrow line", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 3 });
  const capture = await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: VALID_URL, youTubeFetch: true });

  await capture.verifyUsageLineReads("7 of 10 left on your own key · Resets 1 Nov");
});

test("on Free with no key, our key's 5 spent: saving a link meets the wall, which keeps the link and leads to a key", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();
  await launcher.softWall.verifyIsAbsent();

  await dialog.form.submitUrl(VALID_URL);

  await launcher.softWall.verifyIsShown({ resetsOn: "1 November", link: { kicker: "YouTube · Video", title: VALID_URL } });
  await launcher.softWall.verifyOffersAKey(true);
  expect(backendSimulator.ourKey.generations()).toEqual([]);
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "capture.newOverviewForm.wallShown"))
    .toEqual([{ name: "capture.newOverviewForm.wallShown", props: { plan: "free" } }]);

  await launcher.softWall.addAKey();
  await launcher.settingsPage.verifySectionIsShown("keys");
});

test("the wall's Get Plus and See every plan open the paid plans, where Tell me when puts the reader on the list", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);

  await launcher.softWall.getPlus();

  await launcher.plansModal.verifyIsShown();
  await launcher.plansModal.verifyHeading("Get more from your library");
  await launcher.plansModal.verifyCardsInOrder(["byo-plus", "plus"]);
  await launcher.plansModal.verifyCardsRead([
    {
      plan: "byo-plus",
      lines: ["£4.99 a month", "Billed yearly at £59.88 · save 17%", "Everything in Free, plus:", "10 overviews a month, on us"],
    },
    { plan: "plus", lines: ["£7.99 a month", "Recommended", "Coming soon", "50 overviews a month, on us", "300 saves a month"] },
  ]);
  await launcher.plansModal.chooseMonthly();
  await launcher.plansModal.verifyCardsRead([
    { plan: "byo-plus", lines: ["£5.99 a month"] },
    { plan: "plus", lines: ["£9.49 a month"] },
  ]);
  await launcher.plansModal.tellMeWhen("plus");
  await launcher.plansModal.verifyOnTheList("plus");
  await expect
    .poll(() =>
      backendSimulator.analytics
        .events()
        .filter(({ name, props }) => name.startsWith("plus.prompt.") && (props as { variant: string }).variant === "modal"),
    )
    .toEqual([
      { name: "plus.prompt.shown", props: { variant: "modal", plan: "free" } },
      { name: "plus.prompt.chosen", props: { variant: "modal", plan: "free", outcome: "tellMeWhen", tellMeWhen: "plus" } },
    ]);
  await launcher.plansModal.close();
  await launcher.plansModal.verifyIsClosed();

  await launcher.softWall.seeEveryPlan();
  await launcher.plansModal.verifyIsShown();
  await launcher.plansModal.verifyOnTheList("plus");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "capture.newOverviewForm.plansOpened"))
    .toEqual([
      { name: "capture.newOverviewForm.plansOpened", props: { from: "wall" } },
      { name: "capture.newOverviewForm.plansOpened", props: { from: "wall" } },
    ]);
});

test("a BYO Plus reader at the wall is offered Plus alone", async ({ launcher, backendSimulator }) => {
  backendSimulator.auth.accountIsOn("byo-plus");
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 10, own: 200 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);

  await launcher.softWall.seeEveryPlan();

  await launcher.plansModal.verifyHeading("Get more with Plus");
  await launcher.plansModal.verifyCardsInOrder(["plus"]);
});

test("on a phone the plans fill the screen with Plus first", async ({ page, launcher, backendSimulator }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);

  await launcher.softWall.seeEveryPlan();

  await launcher.plansModal.verifyCardsInOrder(["plus", "byo-plus"]);
  await launcher.plansModal.verifyFullHeight();
});

test("on Free with both quotas spent, the wall offers no key to a reader who has one", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 10, ours: 5 });
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  await launcher.softWall.verifyIsShown({ resetsOn: "1 November", link: { kicker: "YouTube · Video", title: VALID_URL } });
  await launcher.softWall.verifyOffersAKey(false);
});

test("on Plus with both quotas spent, the message says there's no upgrade, on the hero too", async ({ launcher, backendSimulator }) => {
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

test("on Free with Only ever use my key on, the own key's 10 is the limit, and saving meets the wall", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ own: 10 });
  await launcher.launch({ ...SIGNED_IN, onlyMyKey: true });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  await launcher.softWall.verifyIsShown({ resetsOn: "1 November", link: { kicker: "YouTube · Video", title: VALID_URL } });
  await launcher.softWall.verifyOffersAKey(false);
});

test("on the panel, Free at the limit sees the wall in the offer's place straight away", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  await launcher.launchPanel({ ...SIGNED_IN_WITHOUT_A_KEY, activeVideoUrl: VALID_URL, youTubeFetch: true });

  await launcher.softWall.verifyIsShown({ resetsOn: "1 Nov", link: { kicker: null, title: VALID_URL } });
  await launcher.softWall.verifyOffersAKey(true);
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

test("at the wall, Save it for now keeps the link with its transcript, makes nothing, and it opens with only its transcript", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await launcher.softWall.verifyOffersSaving(true);
  await launcher.softWall.verifySavesLeftReads(null);

  await launcher.softWall.saveForNow();

  await launcher.softWall.verifySaved("The Simulated Video");
  expect(backendSimulator.ourKey.generations()).toEqual([]);
  await expect
    .poll(() => keptLinkEvents(backendSimulator, "savedWithoutOverview"))
    .toEqual([{ plan: "free", captureSurface: "web", transcribed: false, fromKeptLink: false }]);
  const [capture] = await backendSimulator.captureStore.list();
  expect(capture).toMatchObject({ stage: "saved", sourceKey: IWFT_VIDEO_ID });
  await launcher.softWall.savedDone();
  await launcher.savedItem.verifyLibraryRow("The Simulated Video");
  await launcher.savedItem.showOnlyWithoutOverview();
  await launcher.savedItem.openFromLibrary("The Simulated Video");
  await launcher.savedItem.verifyIsShown("The Simulated Video");
});

test("near the month's saves the wall counts what's left, and with none left it offers no save", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  backendSimulator.ourKey.monthHasSaved(44);
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);

  await launcher.softWall.verifySavesLeftReads("6 of 50 saves left this month.");
});

test("with the month's saves made, the wall offers only Plus and a key", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  backendSimulator.ourKey.monthHasSaved(50);
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);

  await launcher.softWall.verifyOffersSaving(false);
  await expect.poll(() => keptLinkEvents(backendSimulator, "saveCapReached")).toEqual([{ plan: "free", captureSurface: "web" }]);
});

test("once overviews are back, a saved item's Make overview writes it from its kept transcript, under its own id", async ({
  launcher,
  backendSimulator,
}) => {
  const source = youTubeSource({
    ...makeOverview().source,
    id: VideoId.parse(IWFT_VIDEO_ID),
    url: VALID_URL,
    title: "The Simulated Video",
  });
  const capture: Capture = {
    id: OverviewId.parse("5b8e2f1a-6c3d-4e7f-8a9b-0c1d2e3f4a5b"),
    sourceKey: SourceKey.parse(IWFT_VIDEO_ID),
    url: VALID_URL,
    keptAt: "2026-10-20T09:00:00.000Z",
    keptFrom: "phone",
    captureReason: null,
    title: "The Simulated Video",
    thumbnailUrl: null,
    fromPlaylist: null,
    addedAt: null,
    playlistIndex: null,
    chosenAt: null,
    stage: "saved",
    source,
    savedAt: "2026-10-20T09:00:00.000Z",
    notes: null,
  };
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 2 });
  backendSimulator.captureStore.seed(capture);
  backendSimulator.transcripts.seed(makeServiceTranscriptFixture(IWFT_VIDEO_ID, "The Simulated Video"));
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  await launcher.openPage(Routes.overview(capture.id));

  await launcher.savedItem.verifyOffersMakingIt();
  await launcher.savedItem.makeOverview();

  await expect
    .poll(async () => (await backendSimulator.overviewStore.listOverviews()).map((overview) => overview.id))
    .toEqual([capture.id]);
  expect(await backendSimulator.captureStore.list()).toEqual([]);
  await expect
    .poll(() => keptLinkEvents(backendSimulator, "overviewMadeLater"))
    .toMatchObject([{ plan: "free", captureSurface: "web", after: "reset" }]);
});
