import { expect } from "@playwright/experimental-ct-react";
import type { Overview } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import {
  makeOverview,
  makeOverviewState,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const PHONE = { width: 390, height: 800 };
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const YEAR = new Date().getFullYear();
const on = (monthDay: string) => `${YEAR}-${monthDay}T12:00:00.000Z`;
const HOUR_MS = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

// Every factory note takes a minute to read, so a video of n minutes saves n - 1.
const seedRead = (backendSimulator: BackendSimulator, minutes: number) => {
  const overview: Overview = makeOverview({
    video: { ...makeOverview().video, title: `${minutes} minute video`, durationMs: minutes * 60_000 },
  });
  backendSimulator.overviews.seed(overview);
  backendSimulator.overviews.seedState(makeOverviewState(overview.id, { read: true }));
};

// 9h 47m saved, past 30 minutes, 1 hour and 5 hours; 30 minutes was dismissed long ago.
const NINE_HOURS_47 = 9 * 60 + 48;
const REACHED = {
  "30m": { crossedAt: on("08-02"), dismissedAt: on("08-02") },
  "1h": { crossedAt: on("08-09"), dismissedAt: null },
  "5h": { crossedAt: on("09-14"), dismissedAt: null },
};

test("the row carries the total and how many milestones it reaches", async ({ launcher, backendSimulator }) => {
  seedRead(backendSimulator, NINE_HOURS_47);
  await launcher.launch({ milestones: REACHED });

  const settings = await launcher.appShell.openSettings();

  await settings.verifyRowReads("milestones", "9h 47m saved · 3 of 10");
});

test("the section shows the total, the way to the next, and every milestone, dismissed ones included", async ({
  launcher,
  backendSimulator,
}) => {
  seedRead(backendSimulator, NINE_HOURS_47);
  await launcher.launch({ milestones: REACHED });
  await launcher.openPage(Routes.settingsSection("milestones"));
  const milestones = (await launcher.settingsPage.verifyIsShown()).milestones;

  await milestones.verifyFigureSays("9 hours 47 minutes");
  await milestones.verifyCountReads("3 of 10 milestones");
  await milestones.verifyNextReads("10 hours");
  await milestones.verifyNextReads("13 min to go");
  await milestones.verifyProgress("Progress to 10 hours", 587, 300, 600);

  await milestones.verifyTileIsNamed("30m", "30 minutes, reached 2 Aug");
  await milestones.verifyTileIsNamed("1h", "1 hour, reached 9 Aug");
  await milestones.verifyTileIsNamed("5h", "5 hours, reached 14 Sep");
  await milestones.verifyTileState("10h", "next");
  await milestones.verifyTileIsNamed("10h", "10 hours, not reached yet, 13 minutes to go");
  await milestones.verifyTileState("15h", "ahead");
  await milestones.verifyTileIsNamed("15h", "15 hours, not reached yet, 5 hours 13 minutes to go");
});

test("picking a reached milestone shows its card underneath, and one not reached cannot be picked", async ({
  launcher,
  backendSimulator,
}) => {
  seedRead(backendSimulator, NINE_HOURS_47);
  await launcher.launch({ milestones: REACHED });
  await launcher.openPage(Routes.settingsSection("milestones"));
  const milestones = (await launcher.settingsPage.verifyIsShown()).milestones;
  await milestones.verifyTileIsPicked("5h", true);
  await milestones.verifyCardPillReads("5 hours saved · 14 Sep");
  await milestones.verifyCardCannotBeDismissed();

  await milestones.pickTile("30m");

  await milestones.verifyTileIsPicked("30m", true);
  await milestones.verifyTileIsPicked("5h", false);
  await milestones.verifyCardPillReads("30 minutes saved · 2 Aug");

  await milestones.verifyTileCannotBePicked("10h");
  await milestones.pressUnreachedTile("10h");
  await milestones.verifyCardPillReads("30 minutes saved · 2 Aug");
});

test("before any milestone, there is no card to show", async ({ launcher, backendSimulator }) => {
  seedRead(backendSimulator, 11);
  await launcher.launch();
  await launcher.openPage(Routes.settingsSection("milestones"));
  const milestones = (await launcher.settingsPage.verifyIsShown()).milestones;

  await milestones.verifyCountReads("0 of 10 milestones");
  await milestones.verifyNextReads("20 min to go");
  await milestones.verifyNoCard();
});

test("on a phone the section is its own page from the list", async ({ page, launcher, backendSimulator }) => {
  await page.setViewportSize(PHONE);
  seedRead(backendSimulator, NINE_HOURS_47);
  await launcher.launch({ milestones: REACHED });
  await launcher.openPage(Routes.settings());
  const settings = await launcher.settingsPage.verifyIsShown();

  await settings.openSection("milestones");

  await settings.verifyListIsShown(false);
  await settings.verifySectionHeadingIsFocused("milestones");
  await settings.milestones.verifyCardPillReads("5 hours saved · 14 Sep");
});

test("turning the cards off hides the library's card, and the account keeps it off", async ({
  launcher,
  backendSimulator,
}) => {
  seedRead(backendSimulator, 40);
  const library = await launcher.launchExpectingLibrary({
    milestones: { "30m": { crossedAt: hoursAgo(1), dismissedAt: null } },
  });
  await library.milestones.verifyFrontCardIs("30 minutes");

  await launcher.openPage(Routes.settingsSection("milestones"));
  const milestones = (await launcher.settingsPage.verifyIsShown()).milestones;
  await milestones.verifyCardsSwitchIs(true);
  await milestones.clickCardsSwitch();
  await milestones.verifyCardsSwitchIs(false);
  await milestones.verifyTileState("30m", "reached");

  await launcher.openPage(Routes.home());
  await library.milestones.verifyShowsNothing();
  await expect(async () => {
    const settings = await backendSimulator.settingsStore.get();
    expect(settings.showMilestoneCards).toBe(false);
  }).toPass();
});

test("with the cards turned off on the account, a milestone crossed today shows only in Settings", async ({
  launcher,
  backendSimulator,
}) => {
  seedRead(backendSimulator, 40);
  const library = await launcher.launchExpectingLibrary({
    milestones: { "30m": { crossedAt: hoursAgo(1), dismissedAt: null } },
    showMilestoneCards: false,
  });

  await library.milestones.verifyShowsNothing();

  await launcher.openPage(Routes.settingsSection("milestones"));
  const milestones = (await launcher.settingsPage.verifyIsShown()).milestones;
  await milestones.verifyCardsSwitchIs(false);
  await milestones.verifyTileState("30m", "reached");
});

test("opening the section, picking a milestone and switching the cards are counted", async ({
  launcher,
  backendSimulator,
}) => {
  seedRead(backendSimulator, NINE_HOURS_47);
  await launcher.launch({ ...SIGNED_IN, milestones: REACHED });
  const settings = await launcher.appShell.openSettings();

  await settings.openSection("milestones");
  await settings.milestones.pickTile("1h");
  await settings.milestones.pressUnreachedTile("10h");
  await settings.milestones.clickCardsSwitch();

  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("timeSaved.")))
    .toEqual([
      { name: "timeSaved.settingsMilestones.opened", props: {} },
      { name: "timeSaved.settingsMilestones.milestonePicked", props: { milestone: "1h" } },
      { name: "timeSaved.settingsMilestones.cardsSwitched", props: { shown: false } },
    ]);
});
