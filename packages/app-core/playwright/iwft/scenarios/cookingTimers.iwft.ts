import { expect, type Page } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const STEPS = [
  { text: "Boil the blend in a wide pot until it has thickened, about 15 minutes.", group: null },
  { text: "Simmer for 10 minutes, stirring now and again, and rest it off the heat for 5 minutes.", group: null },
  { text: "Knead for 8–10 minutes, until smooth.", group: null },
  { text: "Spoon it into the tin and bake for 45 minutes.", group: null },
];

const timedRecipe = () => {
  const base = makeRecipeOverview();
  return makeRecipeOverview({ recipe: { ...base.recipe!, steps: STEPS, stepCount: STEPS.length } });
};

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

const MINUTE = 60_000;

const sentEvents = async (page: Page, events: () => { name: string }[], name: string) => {
  await page.clock.fastForward(MINUTE);
  return events().filter((event) => event.name === name);
};

const chips = (page: Page) => page.getByTestId("CookingTimerStrip.chip");
const chipNames = (page: Page) => page.getByTestId("CookingTimerStrip.name");
const chipTimes = (page: Page) => page.getByTestId("CookingTimerStrip.time");
const startPills = (page: Page) => page.getByTestId("CookingTimerPills.start");

const goToStep = async (page: Page, step: number) => {
  await page.getByTestId("CookingMode.steps").click();
  await page
    .getByTestId("CookingStepsSheet.step")
    .nth(step - 1)
    .click();
  await expect(page.getByTestId("CookingMode.place")).toHaveText(`Step ${step}`);
};

test.beforeEach(async ({ page, launcher, backendSimulator }) => {
  await page.clock.install();
  backendSimulator.overviews.seed(timedRecipe());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.nthCard(0).openReader();
  await page.getByTestId("RecipeMethod.cook").click();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();
});

test("a time in the step starts a timer that stays in view and counts down as the reader moves on", async ({ page, backendSimulator }) => {
  await expect(page.getByTestId("CookingMode.time")).toHaveText("15 minutes");
  await expect(page.getByTestId("CookingTimerPills.root")).toContainText("Start a timer");
  await expect(page.getByRole("button", { name: "Start a 15-minute timer" })).toHaveText(/15 min/);
  await expect(chips(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await expect(chipNames(page)).toHaveText(["Boil · step 1"]);
  await expect(chipTimes(page)).toHaveText(["15:00"]);
  await expect(page.getByTestId("CookingTimerPills.running")).toHaveText(/15 min · running/);

  await page.clock.fastForward(MINUTE);
  await expect(chipTimes(page)).toHaveText(["14:00"]);
  await page.getByTestId("CookingMode.forward").click();
  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 3");
  await expect(chips(page)).toHaveAccessibleName("Boil timer, step 1, 14 minutes left");
  await expect(page.getByTestId("CookingMode.awake")).toContainText(/hear your timer|Screen stays on/);

  await expect
    .poll(() => sentEvents(page, () => backendSimulator.analytics.events(), "reader.cooking.timerStarted"))
    .toMatchObject([{ props: { seconds: 900, step: 1, range: false } }]);
});

test("tapping the time in the words starts it too", async ({ page }) => {
  await page.getByTestId("CookingMode.time").click();
  await expect(chipNames(page)).toHaveText(["Boil · step 1"]);
});

test("two times in one action get a pill each, named by their verb, and a range offers both ends", async ({ page }) => {
  await goToStep(page, 2);
  await expect(page.getByTestId("CookingMode.time")).toHaveText(["10 minutes", "5 minutes"]);
  await expect(startPills(page)).toHaveText([/Simmer · 10 min/, /Rest · 5 min/]);
  await page.getByRole("button", { name: "Start a 10-minute simmer timer" }).click();
  await page.getByRole("button", { name: "Start a 5-minute rest timer" }).click();
  await expect(chipNames(page)).toHaveText(["Rest", "Simmer"]);
  await expect(chipTimes(page)).toHaveText(["5:00", "10:00"]);

  await goToStep(page, 3);
  await expect(page.getByTestId("CookingTimerPills.root")).toContainText("Start a timer, either end");
  await expect(startPills(page)).toHaveText([/8 min/, /10 min/]);
  await expect(page.getByTestId("CookingTimerPills.root")).toContainText("or");
  await page.getByRole("button", { name: "Start a 10-minute timer" }).click();
  await expect(chipNames(page)).toHaveText(["Rest", "Simmer", "Knead"]);
  await expect(startPills(page)).toHaveText([/8 min/]);
});

test("a timer rings on whatever step the reader is on, Dismiss answers it, and Space is Dismiss's", async ({ page, backendSimulator }) => {
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await goToStep(page, 3);

  await page.clock.fastForward(15 * MINUTE);
  await expect(page.getByTestId("CookingTimerBanner.title")).toHaveText("Boil timer is done");
  await expect(page.getByTestId("CookingTimerBanner.root")).toContainText("Step 1 · 15 min · just now");
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("Timer ringing· the voice waits");
  await expect(chips(page)).toHaveCount(0);
  await expect(page.getByTestId("CookingTimerBanner.dismiss")).toBeFocused();

  await page.keyboard.press("Space");
  await expect(page.getByTestId("CookingTimerBanner.root")).toHaveCount(0);
  await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 3");
  await expect
    .poll(() => sentEvents(page, () => backendSimulator.analytics.events(), "reader.cooking.timerEnded"))
    .toMatchObject([{ props: { by: "dismissed", rang: true } }]);
});

test("+1 min on a ringing timer runs it again for a minute", async ({ page }) => {
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await page.clock.fastForward(15 * MINUTE);
  await page.getByTestId("CookingTimerBanner.more").click();
  await expect(page.getByTestId("CookingTimerBanner.root")).toHaveCount(0);
  await expect(chipTimes(page)).toHaveText(["1:00"]);
});

test("two ringing at once get a row each, oldest first, each dismissed on its own", async ({ page }) => {
  await goToStep(page, 2);
  await page.getByRole("button", { name: "Start a 5-minute rest timer" }).click();
  await page.getByRole("button", { name: "Start a 10-minute simmer timer" }).click();
  await page.clock.fastForward(10 * MINUTE);
  await expect(page.getByTestId("CookingTimerBanner.title")).toHaveText("Two timers are done");
  await expect(page.getByTestId("CookingTimerBanner.row")).toHaveCount(2);
  await expect(page.getByTestId("CookingTimerBanner.row").first()).toContainText("Rest");
  await page.getByRole("button", { name: "Dismiss rest timer" }).click();
  await expect(page.getByTestId("CookingTimerBanner.title")).toHaveText("Simmer timer is done");
});

test("a running timer's sheet takes a minute off, pauses, resumes and cancels", async ({ page, backendSimulator }) => {
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await chips(page).click();
  await expect(page.getByTestId("CookingTimerSheet.root")).toBeVisible();
  await page.getByTestId("CookingTimerSheet.less").click();
  await expect(page.getByTestId("CookingTimerSheet.clock")).toHaveText("14:00");

  await page.getByTestId("CookingTimerSheet.pause").click();
  await expect(page.getByTestId("CookingTimerSheet.line")).toHaveText("paused · left of 14 min");
  await page.clock.fastForward(5 * MINUTE);
  await expect(page.getByTestId("CookingTimerSheet.clock")).toHaveText("14:00");
  await page.getByTestId("CookingTimerSheet.pause").click();
  await page.clock.fastForward(MINUTE);
  await expect(page.getByTestId("CookingTimerSheet.clock")).toHaveText("13:00");

  await page.getByTestId("CookingTimerSheet.cancel").click();
  await expect(page.getByTestId("CookingTimerSheet.root")).toBeHidden();
  await expect(chips(page)).toHaveCount(0);
  await expect
    .poll(() => sentEvents(page, () => backendSimulator.analytics.events(), "reader.cooking.timerEnded"))
    .toMatchObject([{ props: { by: "cancelled", rang: false } }]);
});

test("a paused timer reads as paused in the strip", async ({ page }) => {
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await chips(page).click();
  await page.getByTestId("CookingTimerSheet.pause").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingTimerSheet.root")).toBeHidden();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();
  await expect(chipNames(page)).toHaveText(["Boil · step 1 · paused"]);
});

test("leaving with a timer running asks first: Keep cooking stays, Esc keeps cooking, Leave stops it", async ({
  page,
  backendSimulator,
}) => {
  await page.getByRole("button", { name: "Start a 15-minute timer" }).click();
  await page.getByTestId("CookingMode.done").click();
  await expect(page.getByTestId("CookingLeaveSheet.sentence")).toHaveText("Your boil timer has 15 minutes left. Leaving stops it.");
  await expect(page.getByTestId("CookingLeaveSheet.keep")).toBeFocused();
  await page.getByTestId("CookingLeaveSheet.keep").click();
  await expect(page.getByTestId("CookingLeaveSheet.root")).toBeHidden();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingLeaveSheet.root")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingLeaveSheet.root")).toBeHidden();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();

  await page.getByTestId("CookingMode.done").click();
  await page.getByTestId("CookingLeaveSheet.leave").click();
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
  await expect
    .poll(() => sentEvents(page, () => backendSimulator.analytics.events(), "reader.cooking.timerEnded"))
    .toMatchObject([{ props: { by: "left", rang: false } }]);
});

test("with several running, the confirm lists them soonest first", async ({ page }) => {
  await goToStep(page, 2);
  await page.getByRole("button", { name: "Start a 10-minute simmer timer" }).click();
  await page.getByRole("button", { name: "Start a 5-minute rest timer" }).click();
  await page.getByTestId("CookingMode.done").click();
  await expect(page.getByTestId("CookingLeaveSheet.sentence")).toHaveText("Two timers are running. Leaving stops them all.");
  await expect(page.getByTestId("CookingLeaveSheet.timer")).toHaveText([/Rest · step 2\s*5:00/, /Simmer · step 2\s*10:00/]);
});

test("Finish keeps a running timer on the end screen, and Back to the recipe asks", async ({ page }) => {
  await goToStep(page, 4);
  await page.getByRole("button", { name: "Start a 45-minute timer" }).click();
  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.end")).toContainText("That’s the method.");
  await expect(chipNames(page)).toHaveText(["Bake · step 4"]);
  await page.getByTestId("CookingMode.backToRecipe").click();
  await expect(page.getByTestId("CookingLeaveSheet.sentence")).toHaveText("Your bake timer has 45 minutes left. Leaving stops it.");
});

test("T starts the action's one timer, and with two it moves to the first pill", async ({ page }) => {
  await page.keyboard.press("t");
  await expect(chipNames(page)).toHaveText(["Boil · step 1"]);

  await goToStep(page, 2);
  await page.keyboard.press("t");
  await expect(page.getByRole("button", { name: "Start a 10-minute simmer timer" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(chipNames(page)).toHaveText(["Simmer", "Boil"]);
  await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 2");
});
