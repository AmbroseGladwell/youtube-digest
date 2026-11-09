import { VideoId, type LearnedItem } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN_WITHOUT_A_KEY = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

const seededOverview = (videoId: string) => makeOverview({ source: { ...makeOverview().source, id: VideoId.parse(videoId) } });

const learnedItem = (text: string, overrides: Partial<LearnedItem> = {}): LearnedItem => ({
  text,
  source: "From 3 overviews on tech",
  learnedAt: "2026-11-01T10:00:00.000Z",
  noticedAt: "2026-11-01T11:00:00.000Z",
  removedAt: null,
  ...overrides,
});

test("the third overview runs the pass, what it found waits on the library, and Undo keeps it out for good", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.profilePassFinds([{ text: "building a consumer app", source: "From 2 overviews on tech" }]);
  backendSimulator.overviews.seed(seededOverview("seeded00001"));
  backendSimulator.overviews.seed(seededOverview("seeded00002"));
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, aboutYou: { who: ["dad"], time: [], focus: [] } });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();
  await expect.poll(() => backendSimulator.ourKey.profilePasses()).toHaveLength(1);
  expect(backendSimulator.ourKey.profilePasses()[0]?.sentence).toBe("I'm a dad.");
  expect(backendSimulator.ourKey.profilePasses()[0]?.overviews).toHaveLength(3);
  await launcher.learnedNotice.verifyIsGone();

  await launcher.appShell.clickBrand();
  await launcher.learnedNotice.verifyOffers("building a consumer app");
  await launcher.learnedNotice.undo("building a consumer app");
  await launcher.learnedNotice.verifyReads("Removed. We won't add it again.");

  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.openAboutYou();
  await settings.personalisation.verifyNothingLearned();
  await expect
    .poll(() => backendSimulator.analytics.events().map(({ name }) => name))
    .toEqual(expect.arrayContaining(["settings.personalisation.profilePassRan", "settings.personalisation.learnedItemUndone"]));
});

test("the notice shows several at once, each with its own Undo, and See opens What we know about you", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(seededOverview("seeded00001"));
  await launcher.launch({
    ...SIGNED_IN_WITHOUT_A_KEY,
    learned: {
      "building a consumer app": learnedItem("building a consumer app", { noticedAt: null }),
      "training for strength": learnedItem("training for strength", { noticedAt: null }),
    },
  });

  await launcher.learnedNotice.verifyReads("Added 2 things to what we know about you");
  await launcher.learnedNotice.verifyOffers("building a consumer app", "training for strength");
  await launcher.learnedNotice.see();

  await launcher.settingsPage.verifySectionIsShown("personalisation");
  await launcher.settingsPage.personalisation.openAboutYou();
  await launcher.settingsPage.personalisation.verifyLearned("building a consumer app", "training for strength");
});

test("dismissing the notice keeps the item and doesn't show it again", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(seededOverview("seeded00001"));
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, learned: { "building a consumer app": learnedItem("building a consumer app", { noticedAt: null }) } });

  await launcher.learnedNotice.verifyOffers("building a consumer app");
  await launcher.learnedNotice.dismiss();
  await launcher.learnedNotice.verifyIsGone();

  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.openAboutYou();
  await settings.personalisation.verifyLearned("building a consumer app");
});

test("Settings shows what was learned and where from, a removed item goes, and Keep learning switches off", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch({
    ...SIGNED_IN_WITHOUT_A_KEY,
    aboutYou: { who: ["dad"], time: [], focus: [] },
    learned: { "building a consumer app": learnedItem("building a consumer app"), "training for strength": learnedItem("training for strength") },
  });
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.verifyRowReads("personalisation", "A dad · 2 learned · Every section");
  await settings.personalisation.verifyMetaReads("2 things learned from your overviews · Keep learning is on");

  await settings.personalisation.openAboutYou();
  await settings.personalisation.verifyLearnedSource("training for strength", "From 3 overviews on tech");
  await settings.personalisation.removeLearned("training for strength");
  await settings.personalisation.switchKeepLearning();
  await settings.personalisation.closeAboutYou();

  await settings.personalisation.verifyMetaReads("1 thing learned · Keep learning is off");
  await settings.verifyRowReads("personalisation", "A dad · Learning off");
});

test("sharing with assistants is on until switched off, and the switch holds", async ({ launcher }) => {
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, aboutYou: { who: ["dad"], time: [], focus: [] } });
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.openAboutYou();
  await settings.personalisation.verifySwitchIs("Share with your assistants", true);

  await settings.personalisation.switchShareWithAssistants();
  await settings.personalisation.closeAboutYou();
  await settings.personalisation.openAboutYou();

  await settings.personalisation.verifySwitchIs("Share with your assistants", false);
});

test("sharing with assistants isn't offered signed out, since only an account can connect one", async ({ launcher }) => {
  await launcher.launch({ aboutYou: { who: ["dad"], time: [], focus: [] } });
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");

  await settings.personalisation.openAboutYou();

  await settings.personalisation.verifyCantShareWithAssistants();
});

test("learning hides itself where no key can run the pass", async ({ launcher }) => {
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, aboutYou: { who: ["dad"], time: [], focus: [] } });
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.verifyRowReads("personalisation", "A dad · Every section");

  await settings.personalisation.openAboutYou();

  await settings.personalisation.verifyLearningIsHidden();
});

test("items already held stay readable and removable when no key can learn any more", async ({ launcher }) => {
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, learned: { "building a consumer app": learnedItem("building a consumer app") } });
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");

  await settings.personalisation.openAboutYou();

  await settings.personalisation.verifyLearned("building a consumer app");
  await settings.personalisation.verifyCantSwitchLearning();
});

test("a failed pass tells the reader nothing and takes nothing from the overview", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointError(EndpointKey.PROFILE_PASS);
  backendSimulator.overviews.seed(seededOverview("seeded00001"));
  backendSimulator.overviews.seed(seededOverview("seeded00002"));
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  await launcher.readerPage.verifyIsShown();
  await expect
    .poll(() => backendSimulator.analytics.events().map(({ name }) => name))
    .toContain("settings.personalisation.profilePassFailed");
});
