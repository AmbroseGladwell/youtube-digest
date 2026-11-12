import { expect, type Page } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const STEPS = [
  { text: "Heat the oil in a large pan. Add the onions, then cook for 10 minutes.", group: null },
  { text: "Season to taste.", group: null },
];

const cookingRecipe = () => {
  const base = makeRecipeOverview();
  return makeRecipeOverview({ recipe: { ...base.recipe!, steps: STEPS, stepCount: STEPS.length } });
};

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

const MUTED = "Voice muted. The steps are text only";

const mute = (page: Page) => page.getByRole("button", { name: "Mute voice" });
const voiceLine = (page: Page) => page.getByTestId("CookingMode.voice");

test("Mute stops the voice at once, the steps go text only, and it is still muted next time", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  const recipe = cookingRecipe();
  backendSimulator.overviews.seed(recipe);
  backendSimulator.narration.seedReady(recipe);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await expect(voiceLine(page)).toHaveText("Reading step 1");
  await expect(mute(page)).toHaveAttribute("aria-pressed", "false");

  await mute(page).click();
  await expect(mute(page)).toHaveAttribute("aria-pressed", "true");
  await expect(voiceLine(page)).toHaveText(MUTED);
  await expect(page.getByTestId("CookingMode.again")).toHaveCount(0);
  await expect.poll(async () => (await backendSimulator.settingsStore.get()).readStepsAloud).toBe(false);
  const requests = backendSimulator.narration.requestCount();

  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
  await expect(voiceLine(page)).toHaveText(MUTED);

  await page.getByTestId("CookingMode.done").click();
  await page.getByTestId("RecipeMethod.carryOn").click();
  await expect(voiceLine(page)).toHaveText(MUTED);
  await expect(mute(page)).toHaveAttribute("aria-pressed", "true");
  expect(backendSimulator.narration.requestCount()).toBe(requests);
});

test("unmuting reads the current action from its start, and Say it again comes back", async ({ page, launcher, backendSimulator }) => {
  const recipe = cookingRecipe();
  backendSimulator.overviews.seed(recipe);
  backendSimulator.narration.seedReady(recipe);
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, readStepsAloud: false });
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await expect(voiceLine(page)).toHaveText(MUTED);
  expect(backendSimulator.narration.requestCount()).toBe(0);

  await page.getByTestId("CookingMode.forward").click();
  await mute(page).click();
  await expect(voiceLine(page)).toHaveText("Reading step 1");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
  await expect(page.getByTestId("CookingMode.again")).toBeVisible();
  await expect.poll(async () => (await backendSimulator.settingsStore.get()).readStepsAloud).toBe(true);
});

test("on the web M mutes and unmutes, shown on the button, and R does nothing while muted", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  const recipe = cookingRecipe();
  backendSimulator.overviews.seed(recipe);
  backendSimulator.narration.seedReady(recipe);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await expect(mute(page)).toContainText("M");
  await page.keyboard.press("m");
  await expect(voiceLine(page)).toHaveText(MUTED);
  await page.keyboard.press("r");
  await expect(voiceLine(page)).toHaveText(MUTED);

  await page.keyboard.press("m");
  await expect(voiceLine(page)).toHaveText("Reading step 1");
  await expect
    .poll(() => backendSimulator.analytics.events().filter((event) => event.name === "reader.cooking.voiceMuted"))
    .toMatchObject([{ props: { muted: true, by: "key" } }, { props: { muted: false, by: "key" } }]);
});

test("a recipe with no narration has nothing to mute", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await expect(voiceLine(page)).toHaveText("No narration on this recipe, so it’s text only");
  await expect(mute(page)).toHaveCount(0);
});

test("a timer still rings while muted, and the line keeps saying the voice is muted", async ({ page, launcher, backendSimulator }) => {
  await page.clock.install();
  const recipe = cookingRecipe();
  backendSimulator.overviews.seed(recipe);
  backendSimulator.narration.seedReady(recipe);
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, readStepsAloud: false });
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await expect(voiceLine(page)).toHaveText(MUTED);
  await page.getByTestId("CookingMode.forward").click();
  await page.getByTestId("CookingMode.forward").click();
  await page.getByRole("button", { name: "Start a 10-minute timer" }).click();
  await page.clock.fastForward(10 * 60_000);
  await expect(page.getByTestId("CookingTimerBanner.title")).toHaveText("Cook timer is done");
  await expect(voiceLine(page)).toHaveText(MUTED);
});

test("Settings › Cooking's Read steps aloud is the same setting, and its row says so", async ({ page, launcher, backendSimulator }) => {
  await launcher.launch(SIGNED_IN);
  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("cooking", "Voice on · Ready");
  await settings.openSection("cooking");

  const readAloud = page.getByRole("switch", { name: "Read steps aloud" });
  await expect(readAloud).toHaveAttribute("aria-checked", "true");
  await readAloud.click();
  await expect(readAloud).toHaveAttribute("aria-checked", "false");
  await expect.poll(async () => (await backendSimulator.settingsStore.get()).readStepsAloud).toBe(false);
  await settings.verifyRowReads("cooking", "Voice off · Ready");
});
