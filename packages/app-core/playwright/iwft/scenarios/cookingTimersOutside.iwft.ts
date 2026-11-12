import { expect, type Page } from "@playwright/test";
import { VideoId, type Overview } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const CURRY = [
  { text: "Boil the blend in a wide pot until it has thickened, about 15 minutes.", group: null },
  { text: "Simmer for 10 minutes, stirring now and again, and rest it off the heat for 5 minutes.", group: null },
];
const LOAF = [
  { text: "Beat the butter and sugar together until pale.", group: null },
  { text: "Spoon it into the tin and bake for 45 minutes.", group: null },
];

const recipe = (title: string, steps: typeof CURRY, id: string): Overview => {
  const base = makeRecipeOverview();
  return makeRecipeOverview({
    source: { ...base.source, id: VideoId.parse(id), url: `https://examplekitchen.example/${id}`, title } as Overview["source"],
    recipe: { ...base.recipe!, steps, stepCount: steps.length },
  });
};

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

const MINUTE = 60_000;

const dockTiles = (page: Page) => page.getByTestId("CookingTimerDock.tile");
const dockNames = (page: Page) => page.getByTestId("CookingTimerDock.name");

const toLibrary = async (page: Page) => {
  await page.getByRole("link", { name: "The Overview" }).first().click();
  await expect(page.getByTestId("LibraryPage.root")).toBeVisible();
};

const cook = async (page: Page, title: string) => {
  await page
    .getByRole("link", { name: new RegExp(title) })
    .first()
    .click();
  await page.getByTestId("RecipeMethod.cook").first().click();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();
};

const leaveKeeping = async (page: Page) => {
  await page.getByTestId("CookingMode.done").click();
  await page.getByTestId("CookingLeaveSheet.keep").click();
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
};

const sentEvents = async (page: Page, events: () => { name: string }[], name: string) => {
  await page.clock.fastForward(MINUTE);
  return events().filter((event) => event.name === name);
};

test.beforeEach(async ({ page, launcher, backendSimulator }) => {
  await page.clock.install();
  backendSimulator.overviews.seed(recipe("Weeknight curry", CURRY, "curry0000000000000000000000000000"));
  backendSimulator.overviews.seed(recipe("Lemon drizzle loaf", LOAF, "loaf00000000000000000000000000000"));
  await launcher.launchExpectingLibrary(SIGNED_IN);
});

test("Keep running carries a timer out of the mode, to the foot of every page, named by its recipe", async ({ page, backendSimulator }) => {
  await cook(page, "Weeknight curry");
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await leaveKeeping(page);

  await expect(dockNames(page)).toHaveText(["Boil · Weeknight curry"]);
  await toLibrary(page);
  await expect(dockNames(page)).toHaveText(["Boil · Weeknight curry"]);
  await page.clock.fastForward(MINUTE);
  await expect(page.getByTestId("CookingTimerDock.time")).toHaveText(/^1[34]:\d\d$/);
  await expect
    .poll(() => sentEvents(page, () => backendSimulator.analytics.events(), "reader.cooking.timersKept"))
    .toMatchObject([{ props: { count: 1, ringing: false } }]);
});

test("Stop timer on leaving stops it, and nothing is left at the foot", async ({ page }) => {
  await cook(page, "Weeknight curry");
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await page.getByTestId("CookingMode.done").click();
  await page.getByTestId("CookingLeaveSheet.stop").click();
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
  await expect(dockTiles(page)).toHaveCount(0);
});

test("a kept timer's controls name its recipe and go back to its step", async ({ page, backendSimulator }) => {
  await cook(page, "Weeknight curry");
  await page.getByTestId("CookingMode.forward").click();
  await page.getByRole("button", { name: "Start a 10-minute simmer timer" }).click();
  await leaveKeeping(page);
  await toLibrary(page);

  await dockTiles(page).click();
  await expect(page.getByTestId("CookingTimerSheet.recipe")).toHaveText("Weeknight curry");
  await expect(page.getByTestId("TimerControlsSheet.wayBack")).toContainText("Back to step 2");
  await page.getByTestId("TimerControlsSheet.wayBack").click();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();
  await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 2");
  await expect
    .poll(() => sentEvents(page, () => backendSimulator.analytics.events(), "reader.cooking.backToStep"))
    .toMatchObject([{ props: { landed: "step" } }]);
});

test("if the method changed since, the way back opens at the start, and a deleted note has none", async ({ page }) => {
  await cook(page, "Weeknight curry");
  await page.getByTestId("CookingMode.forward").click();
  await page.getByRole("button", { name: "Start a 10-minute simmer timer" }).click();
  await leaveKeeping(page);
  await toLibrary(page);

  await page.evaluate(async () => {
    const store = window.__iwftStores__.overviewStore;
    const all = await store.listOverviews();
    const curry = all.find((overview) => overview.source.title === "Weeknight curry")!;
    const steps = curry.recipe!.steps.map((step, index) => (index === 1 ? { ...step, text: "Simmer gently for 12 minutes." } : step));
    await store.saveOverview({ ...curry, recipe: { ...curry.recipe!, steps } });
  });
  await dockTiles(page).click();
  await expect(page.getByTestId("TimerControlsSheet.wayBack")).toContainText("At the start: the method has changed since");
  await page.getByTestId("TimerControlsSheet.wayBack").click();
  await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 1");
  await leaveKeeping(page);

  await page.evaluate(async () => {
    const store = window.__iwftStores__.overviewStore;
    const curry = (await store.listOverviews()).find((overview) => overview.source.title === "Weeknight curry")!;
    await store.deleteOverview(curry.id);
  });
  await dockTiles(page).click();
  await expect(page.getByTestId("TimerControlsSheet.gone")).toHaveText(
    "This note was deleted, so there’s no step to go back to. The timer carries on.",
  );
  await expect(page.getByTestId("TimerControlsSheet.wayBack")).toHaveCount(0);
});

test("a timer that runs out outside the mode rings at the foot, named by its recipe, and Space dismisses it", async ({
  page,
  backendSimulator,
}) => {
  await cook(page, "Weeknight curry");
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await leaveKeeping(page);
  await toLibrary(page);

  await page.clock.fastForward(15 * MINUTE);
  await expect(page.getByTestId("CookingTimerBanner.title")).toHaveText("Boil timer is done");
  await expect(page.getByTestId("CookingTimerBanner.root")).toContainText("Weeknight curry · step 1 · 15 min");
  await expect(page.getByTestId("CookingTimerBanner.dismiss")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("CookingTimerBanner.root")).toHaveCount(0);
  await expect
    .poll(() => sentEvents(page, () => backendSimulator.analytics.events(), "reader.cooking.timerEnded"))
    .toMatchObject([{ props: { by: "dismissed", rang: true } }]);
});

test("cooking a second recipe shows the first's timer by its recipe, and leaving asks only about this one's", async ({ page }) => {
  await cook(page, "Lemon drizzle loaf");
  await page.getByTestId("CookingMode.forward").click();
  await page.getByRole("button", { name: "Start a 45-minute timer" }).click();
  await leaveKeeping(page);
  await toLibrary(page);

  await cook(page, "Weeknight curry");
  await expect(page.getByTestId("CookingTimerStrip.name")).toHaveText(["Bake · Lemon drizzle loaf"]);
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await page.getByTestId("CookingMode.done").click();
  await expect(page.getByTestId("CookingLeaveSheet.heading")).toHaveText("Keep the boil timer running?");
  await expect(page.getByTestId("CookingLeaveSheet.others")).toHaveText("Your bake timer for Lemon drizzle loaf carries on either way.");
  await page.getByTestId("CookingLeaveSheet.stop").click();
  await expect(dockNames(page)).toHaveText(["Bake · Lemon drizzle loaf"]);
});

test("leaving with only a ringing timer: Keep it ringing takes it out of the mode, still ringing", async ({ page }) => {
  await cook(page, "Weeknight curry");
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await page.clock.fastForward(15 * MINUTE);
  await expect(page.getByTestId("CookingTimerBanner.title")).toHaveText("Boil timer is done");

  await page.getByTestId("CookingMode.done").click();
  await expect(page.getByTestId("CookingLeaveSheet.heading")).toHaveText("The boil timer is ringing");
  await expect(page.getByTestId("CookingLeaveSheet.stop")).toHaveText("Dismiss and leave");
  await page.getByTestId("CookingLeaveSheet.keep").click();
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
  await expect(page.getByTestId("CookingTimerDock.root").getByTestId("CookingTimerBanner.title")).toHaveText("Boil timer is done");
});

test("two or three sit side by side, and four or more fold into one, listed soonest first", async ({ page }) => {
  await cook(page, "Weeknight curry");
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await page.getByTestId("CookingMode.forward").click();
  await page.getByRole("button", { name: "Start a 10-minute simmer timer" }).click();
  await page.getByRole("button", { name: "Start a 5-minute rest timer" }).click();
  await leaveKeeping(page);
  await expect(dockNames(page)).toHaveText(["Rest", "Simmer", "Boil"]);

  await toLibrary(page);
  await cook(page, "Lemon drizzle loaf");
  await page.getByTestId("CookingMode.forward").click();
  await page.getByRole("button", { name: "Start a 45-minute timer" }).click();
  await leaveKeeping(page);
  await expect(page.getByTestId("CookingTimerDock.folded")).toContainText("Timers");
  await expect(page.getByTestId("CookingTimerDock.folded")).toContainText("+3");

  await page.getByTestId("CookingTimerDock.folded").click();
  await expect(page.getByTestId("TimersListSheet.item")).toHaveCount(4);
  await expect(page.getByTestId("TimersListSheet.item").first()).toContainText("Rest · step 2");
  await expect(page.getByTestId("TimersListSheet.item").last()).toContainText("Lemon drizzle loaf");
  await page.getByTestId("TimersListSheet.item").first().click();
  await expect(page.getByTestId("CookingTimerSheet.recipe")).toHaveText("Weeknight curry");
});

test("a ring pauses the narration, the player says why, and dismissing carries it on", async ({ page, backendSimulator }) => {
  const loaf = (await page.evaluate(() => window.__iwftStores__.overviewStore.listOverviews())).find(
    (overview) => overview.source.title === "Lemon drizzle loaf",
  )!;
  backendSimulator.narration.seedReady(loaf);
  await cook(page, "Weeknight curry");
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await leaveKeeping(page);
  await toLibrary(page);

  await page
    .getByRole("link", { name: /Lemon drizzle loaf/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Listen" }).first().click();
  await toLibrary(page);
  const miniPlayer = page.getByTestId("MiniPlayer.root");
  await expect(miniPlayer.getByRole("button", { name: "Pause" })).toBeVisible();

  await page.clock.fastForward(15 * MINUTE);
  await expect(page.getByTestId("CookingTimerBanner.title")).toHaveText("Boil timer is done");
  await expect(page.getByTestId("MiniPlayer.meta")).toHaveText("Paused for the timer");
  await expect(miniPlayer.getByRole("button", { name: "Play" })).toBeVisible();

  await page.keyboard.press("Space");
  await expect(page.getByTestId("CookingTimerBanner.root")).toHaveCount(0);
  await expect(miniPlayer.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("narration the reader had paused stays paused after the ring is dismissed", async ({ page, backendSimulator }) => {
  const loaf = (await page.evaluate(() => window.__iwftStores__.overviewStore.listOverviews())).find(
    (overview) => overview.source.title === "Lemon drizzle loaf",
  )!;
  backendSimulator.narration.seedReady(loaf);
  await cook(page, "Weeknight curry");
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await leaveKeeping(page);
  await toLibrary(page);

  await page
    .getByRole("link", { name: /Lemon drizzle loaf/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Listen" }).first().click();
  await toLibrary(page);
  const miniPlayer = page.getByTestId("MiniPlayer.root");
  await miniPlayer.getByRole("button", { name: "Pause" }).click();
  await expect(miniPlayer.getByRole("button", { name: "Play" })).toBeVisible();

  await page.clock.fastForward(15 * MINUTE);
  await expect(page.getByTestId("CookingTimerBanner.title")).toHaveText("Boil timer is done");
  await expect(page.getByTestId("MiniPlayer.meta")).not.toHaveText("Paused for the timer");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("CookingTimerBanner.root")).toHaveCount(0);
  await expect(miniPlayer.getByRole("button", { name: "Play" })).toBeVisible();
});
