import { expect, type Locator } from "@playwright/test";
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

test("cooking step by step shows one action at a time, the next one under it, and Next moves on", async ({
  page,
  launcher,
  backendSimulator,
}) => {
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

test("the keys move through it: Space or → for Next, ← for Back, I for the ingredients, Esc to leave", async ({
  page,
  launcher,
  backendSimulator,
}) => {
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
  await expect(page.getByTestId("CookingIngredientsDrawer.root")).toBeVisible();
  await expect(page.getByTestId("CookingIngredientsDrawer.root")).toContainText("3 large leeks");
  await page.keyboard.press("i");
  await expect(page.getByTestId("CookingIngredientsDrawer.root")).toBeHidden();
  await page.keyboard.press("i");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingIngredientsDrawer.root")).toBeHidden();
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

test("in US units the mode shows the oven in Fahrenheit and says the units changed", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeIngredients.units.us").check();
  await page.getByTestId("RecipeMethod.cook").click();
  await expect(page.getByTestId("CookingMode.note")).toHaveText("In US units");
  await expect(page.getByTestId("CookingMode.action")).toContainText("Heat the oven to 425°F (400°F fan)");
});

test("a doubled recipe's step shows the amounts it repeats from the ingredients adjusted, and a share as written", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  const base = makeRecipeOverview();
  const steps = [
    { text: "Put 100g plain flour, 2 large eggs and 300ml milk into a bowl, then whisk to a smooth batter.", group: null },
    { text: "Pour in about 3 tbsp of the batter and swirl it to cover the base.", group: null },
  ];
  backendSimulator.overviews.seed(
    makeRecipeOverview({
      recipe: {
        ...base.recipe!,
        ingredients: ["100g plain flour", "2 large eggs", "300ml milk", "3 tbsp butter"],
        steps,
        stepCount: steps.length,
      },
    }),
  );
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  for (let step = 0; step < 4; step += 1) {
    await page.getByTestId("RecipeIngredients.more").click();
  }
  await page.getByTestId("RecipeMethod.cook").click();

  await expect(page.getByTestId("CookingMode.note")).toHaveText("Adjusted for 8 servings");
  await expect(page.getByTestId("CookingMode.action")).toContainText("Put 200g plain flour, 4 large eggs and 600ml milk into a bowl");
  await expect(page.getByTestId("CookingMode.action").getByTestId("OvenText.adjusted")).toHaveText(["200g", "4", "600ml"]);
  await page.getByTestId("CookingMode.forward").click();
  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.action")).toContainText("Pour in about 3 tbsp of the batter");
  await expect(page.getByTestId("CookingMode.action").getByTestId("OvenText.adjusted")).toHaveCount(0);
  await expect(page.getByTestId("CookingMode.note")).toHaveText("Adjusted for 8 servings");
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

test("the step being cooked fills a little with each of its actions, and is full on its last", async ({
  page,
  launcher,
  backendSimulator,
}) => {
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

test("the button above the summary starts cooking, and carries on from the place once there is one", async ({
  page,
  launcher,
  backendSimulator,
}) => {
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

const LONG_ACTION =
  "Roll each piece into a tight ball by tucking the edges underneath and turning it against the worktop with a cupped hand while keeping the seam on the bottom so the top stays smooth and stretched and set the balls apart on a floured tray";

const longActionRecipe = () => {
  const base = makeRecipeOverview();
  const steps = [
    { text: LONG_ACTION, group: null },
    { text: "Cover loosely and leave for 30 minutes.", group: null },
  ];
  return makeRecipeOverview({ recipe: { ...base.recipe!, steps, stepCount: steps.length } });
};

const boxOf = async (locator: Locator) => (await locator.boundingBox())!;

test("on the wide web the ingredients make room beside the step, and every key keeps working with them open", async ({
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
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("Waiting for you", { timeout: 10_000 });

  const drawer = page.getByTestId("CookingIngredientsDrawer.root");
  const ingredients = page.getByTestId("CookingMode.ingredients");
  await page.keyboard.press("i");
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("3 large leeks");
  await expect(ingredients).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("CookingIngredientsSheet.root")).toHaveCount(0);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('[data-testid="CookingIngredientsDrawer.root"]') !== null))
    .toBe(true);

  await expect.poll(async () => (await boxOf(drawer)).width).toBe(384);
  const action = await boxOf(page.getByTestId("CookingMode.action"));
  const drawerBox = await boxOf(drawer);
  expect(action.x + action.width).toBeLessThanOrEqual(drawerBox.x);

  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("…then cook for 10 minutes.");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Add the onions");
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("Waiting for you", { timeout: 10_000 });
  await page.keyboard.press("r");
  await expect(page.getByTestId("CookingMode.voice")).toHaveText("Reading step 1");

  await page.keyboard.press("i");
  await expect(drawer).toBeHidden();
  await expect(ingredients).toHaveAttribute("aria-expanded", "false");
  await expect(ingredients).toBeFocused();

  await page.keyboard.press("i");
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
});

test("Space on the drawer's Close button closes it rather than moving on", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  await page.getByTestId("RecipeMethod.cook").click();

  await page.getByTestId("CookingMode.ingredients").click();
  await page.getByTestId("CookingIngredientsDrawer.close").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("CookingIngredientsDrawer.root")).toBeHidden();
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Heat the oil in a large pan.");
});

test("beside the drawer the action's size follows the column: one step down at 1024, the phone's at 768 and still narrow shut, and a long action fits", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(longActionRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByTestId("RecipeMethod.cook").click();

  const action = page.getByTestId("CookingMode.action");
  const fontSize = () => action.evaluate((element) => getComputedStyle(element).fontSize);
  await expect.poll(fontSize).toBe("32px");
  await expect(page.getByTestId("CookingMode.next")).toBeVisible();

  await page.keyboard.press("i");
  await expect.poll(fontSize).toBe("28px");
  await expect(page.getByTestId("CookingMode.next")).toHaveCount(0);
  await expect(page.getByTestId("CookingMode.title")).toBeHidden();
  const drawer = page.getByTestId("CookingIngredientsDrawer.root");
  await expect.poll(async () => (await boxOf(drawer)).width).toBe(384);
  const narrow = await boxOf(action);
  expect(narrow.x + narrow.width).toBeLessThanOrEqual((await boxOf(drawer)).x);

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect.poll(fontSize).toBe("23px");
  await expect.poll(async () => (await boxOf(drawer)).width).toBe(320);
  await expect(page.getByTestId("CookingMode.next")).toBeVisible();
  const forward = await boxOf(page.getByTestId("CookingMode.forward"));
  expect(forward.y + forward.height).toBeLessThanOrEqual(1024);
  expect(await page.getByTestId("CookingMode.root").evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);

  await page.keyboard.press("i");
  await expect(drawer).toBeHidden();
  await expect.poll(fontSize).toBe("28px");
});

test("at phone width the ingredients are still a modal sheet, and Esc leaves only once it is shut", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(cookingRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("RecipeMethod.cook").click();

  await page.getByTestId("CookingMode.ingredients").click();
  await expect(page.locator('dialog:modal[data-testid="CookingIngredientsSheet.root"]')).toBeVisible();
  await expect(page.getByTestId("CookingIngredientsDrawer.root")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("CookingMode.action")).toHaveText("Heat the oil in a large pan.");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingIngredientsSheet.root")).toBeHidden();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
});

test("under reduced motion the drawer just appears", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(cookingRecipe());
  await page.emulateMedia({ reducedMotion: "reduce" });
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  await page.getByTestId("RecipeMethod.cook").click();

  await page.keyboard.press("i");
  const drawer = page.getByTestId("CookingIngredientsDrawer.root");
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  expect((await boxOf(drawer)).width).toBe(384);
});

const LONG_LIST = Array.from({ length: 30 }, (_, index) => `${index + 1} tbsp of something worth writing on its own line`);

const longListRecipe = () => {
  const base = makeRecipeOverview();
  return makeRecipeOverview({ recipe: { ...base.recipe!, ingredients: LONG_LIST } });
};

test("an ingredients list longer than the window scrolls in the drawer, and the controls stay on screen", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(longListRecipe());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.getByTestId("RecipeMethod.cook").click();

  const drawer = page.getByTestId("CookingIngredientsDrawer.root");
  await page.keyboard.press("i");
  await expect(drawer).toBeVisible();
  await expect.poll(async () => (await boxOf(drawer)).width).toBe(384);

  expect((await boxOf(drawer)).height).toBe(700);
  const forward = await boxOf(page.getByTestId("CookingMode.forward"));
  expect(forward.y + forward.height).toBeLessThanOrEqual(700);
  const root = page.getByTestId("CookingMode.root");
  expect(await root.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);

  expect(await drawer.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.keyboard.press("End");
  await expect.poll(() => drawer.evaluate((element) => element.scrollTop > 0)).toBe(true);
  await expect(drawer).toContainText("30 tbsp");
  await expect(page.getByTestId("CookingMode.action")).toHaveText(
    "Heat the oven to 220°C (200°C fan) and roast the leeks for 20 to 25 minutes.",
  );
});
