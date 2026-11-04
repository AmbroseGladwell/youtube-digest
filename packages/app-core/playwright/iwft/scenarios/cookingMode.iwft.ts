import { expect } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const STEPS = [
  { text: "Heat the oil in a large pan. Add the onions, then cook for 10 minutes.", group: null },
  { text: "Cook beef - Turn the heat up to high.", group: "For the stew" },
  { text: "If you're using a slow cooker, move everything into it now.", group: "For the stew" },
  { text: "Season to taste.", group: "For the stew" },
];

const cookingRecipe = () => {
  const base = makeRecipeOverview();
  return makeRecipeOverview({ recipe: { ...base.recipe!, steps: STEPS, stepCount: STEPS.length } });
};

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

test("cooking step by step shows one action at a time, the next one under it, and Next moves on", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  const mode = page.getByTestId("CookingMode.root");
  await expect(mode).toBeVisible();
  await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 1 · 1 of 3");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Heat the oil in a large pan.");
  await expect(page.getByTestId("CookingMode.nextLead")).toHaveText("Then");
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("No narration on this recipe, so it’s text only");
  await expect(page.getByTestId("CookingMode.again")).toHaveCount(0);

  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("");
  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("…then cook for 10 minutes.");
  await expect(page.getByTestId("CookingMode.nextLead")).toHaveText("Then step 2");

  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.group")).toHaveText("For the stew");
  await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 2");
  await expect(page.getByTestId("CookingMode.label")).toHaveText("Cook beef");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Turn the heat up to high.");

  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.condition")).toHaveText("If you're using a slow cooker,");

  await page.getByTestId("CookingMode.back").click();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Turn the heat up to high.");
});

test("the keys move through it: Space or → for Next, ← for Back, I for the ingredients, Esc to leave", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");

  await page.keyboard.press("i");
  await expect(page.getByTestId("CookingIngredientsSheet.root")).toBeVisible();
  await expect(page.getByTestId("CookingIngredientsSheet.root")).toContainText("3 large leeks");
  await page.keyboard.press("i");
  await expect(page.getByTestId("CookingIngredientsSheet.root")).toBeHidden();
  await page.keyboard.press("i");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingIngredientsSheet.root")).toBeHidden();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
});

test("leaving keeps the place, and the method offers to carry on from it", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  for (let press = 0; press < 3; press += 1) await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 2");
  await page.getByTestId("CookingMode.done").click();

  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
  await expect(page.getByTestId("RecipeMethod.stopped")).toHaveText("You stopped at step 2 of 4.");
  await expect(page.getByTestId("RecipeMethod.reachedStep")).toContainText("Cook beef");
  await page.getByTestId("RecipeMethod.carryOn").click();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Turn the heat up to high.");
});

test("the steps sheet jumps to a step's first action", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await page.getByTestId("CookingMode.steps").click();
  await expect(page.getByTestId("CookingStepsSheet.step")).toHaveCount(4);
  await page.getByTestId("CookingStepsSheet.step").nth(3).click();
  await expect(page.getByTestId("CookingStepsSheet.root")).toBeHidden();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Season to taste.");
});

test("Finish ends on the method's last word and forgets the place", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await page.getByTestId("CookingMode.steps").click();
  await page.getByTestId("CookingStepsSheet.step").nth(3).click();
  await expect(page.getByTestId("CookingMode.forward")).toHaveText(/Finish/);
  await page.getByTestId("CookingMode.forward").click();

  await expect(page.getByTestId("CookingMode.end")).toContainText("That’s the method.");
  await page.getByTestId("CookingMode.backToRecipe").click();
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
  await expect(page.getByTestId("RecipeMethod.carryOn")).toHaveCount(0);
  await expect(page.getByTestId("RecipeMethod.cook")).toBeVisible();
});

test("with narration, the voice reads one action and then waits for the reader", async ({ page, launcher, backendSimulator }) => {
  const recipe = cookingRecipe();
  backendSimulator.overviews.seed(recipe);
  backendSimulator.narration.seedReady(recipe);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("Reading step 1");
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("Waiting for you", { timeout: 10_000 });
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Heat the oil in a large pan.");
  await expect(page.getByTestId("CookingMode.again")).toBeVisible();

  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("Reading step 1");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
});

test("the bar's Cook from here starts at the action the voice is on", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.step").filter({ hasText: "Season to taste" }).click();
  await page.getByTestId("ReaderPlayerBar.cookFromHere").click();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Season to taste.");
});

test("in US units the mode shows the oven in Fahrenheit and says the amounts are the recipe's", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeIngredients.units.us").check();
  await page.getByTestId("RecipeMethod.cook").click();
  await expect(page.getByTestId("CookingMode.note")).toHaveText("Temperatures in °F. Amounts as written, for 4 servings");
  await expect(page.getByTestId("CookingMode.action")).toContainText("Heat the oven to 425°F (400°F fan)");
});

test("a swipe up moves on, a swipe down goes back, and a short drag doesn't move", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  await page.getByTestId("RecipeMethod.cook").click();

  const drag = async (dy: number) => {
    const box = (await page.getByTestId("CookingMode.swipeArea").boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + dy, { steps: 8 });
    await page.mouse.up();
  };

  await drag(-150);
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
  await drag(-150);
  await expect(page.getByTestId("CookingMode.action")).toHaveText("…then cook for 10 minutes.");
  await drag(150);
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
  await drag(-20);
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
});

test("the step being cooked fills a little with each of its actions, and is full on its last", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  await page.getByTestId("RecipeMethod.cook").click();

  const fill = page.getByTestId("CookingMode.stepFill");
  await expect(fill).toHaveAttribute("style", /width: 33\.33/);
  await page.getByTestId("CookingMode.forward").click();
  await expect(fill).toHaveAttribute("style", /width: 66\.66/);
  await page.getByTestId("CookingMode.forward").click();
  await expect(fill).toHaveAttribute("style", /width: 100%/);
  await page.getByTestId("CookingMode.forward").click();
  await expect(fill).toHaveAttribute("style", /width: 100%/);
});

test("the button above the summary starts cooking, and carries on from the place once there is one", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await expect(page.getByTestId("RecipeCookButton.root")).toHaveText("Cook step by step");
  await page.getByTestId("RecipeCookButton.root").click();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Heat the oil in a large pan.");
  for (let press = 0; press < 3; press += 1) await page.getByTestId("CookingMode.forward").click();
  await page.getByTestId("CookingMode.done").click();

  await expect(page.getByTestId("RecipeCookButton.root")).toHaveText("Carry on from step 2");
  await page.getByTestId("RecipeCookButton.root").click();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Turn the heat up to high.");
});
