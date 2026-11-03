import { expect } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview, makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

test("a recipe's note is its summary, the page's times, the ingredients and the method, with no verdict or tabs", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeOverview());
  const library = await launcher.launchExpectingLibrary();
  await expect(page.getByText(/1 hr 5 min recipe/)).toBeVisible();

  await library.nthCard(0).openReader();

  await expect(page.getByText("Example Kitchen · Recipe")).toBeVisible();
  await expect(page.getByText(/By Maya Okafor · Published 28 Oct 2026 · Saved/)).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByText("As the recipe gives them on Example Kitchen.")).toBeVisible();
  await expect(page.getByTestId("RecipeTimes.figure")).toHaveText(["Prep15 min", "Cook50 min", "Total1 hr 5 min", "Makes4 servings"]);
  await expect(page.getByText("Summary", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /See the full recipe on Example Kitchen · 9 min read/ })).toHaveAttribute(
    "href",
    "https://examplekitchen.example/recipes/charred-leek-white-bean-stew",
  );
  await expect(page.getByRole("heading", { name: "Ingredients · 8" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Method · 4 steps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "For the stew" })).toBeVisible();
  await expect(page.getByTestId("RecipeMethod.step").nth(2)).toContainText("3Add the beans");
  await expect(page.getByText("Verdict")).toHaveCount(0);
  await expect(page.getByText("Key points")).toHaveCount(0);
});

test("servings and units adjust the amounts they can read, mark them, and say what they left alone", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await expect(page.getByTestId("RecipeIngredients.units.asWritten")).toBeChecked();
  for (let step = 0; step < 4; step += 1) {
    await page.getByTestId("RecipeIngredients.more").click();
  }
  await page.getByTestId("RecipeIngredients.units.us").check();

  await expect(page.getByTestId("RecipeIngredients.servings")).toHaveText("8 servings");
  await expect(page.getByTestId("RecipeIngredients.line").nth(0)).toHaveText("6 large leeks, trimmed and halved lengthways");
  await expect(page.getByTestId("RecipeIngredients.line").nth(2)).toHaveText("4 × 400g tins cannellini beans, drained· tin size as sold");
  await expect(page.getByTestId("RecipeIngredients.line").nth(3)).toHaveText("4¼ cups vegetable stock");
  await expect(page.getByTestId("RecipeIngredients.line").nth(4)).toHaveText("2 lemons, zested and juiced");
  await expect(page.getByTestId("RecipeIngredients.changed").first()).toHaveText("6");
  await expect(page.getByTestId("RecipeIngredients.status")).toContainText(
    "Adjusted for 8 servings in US units. 2 lines have no amount to adjust.",
  );
  await expect(page.getByTestId("RecipeMethod.note")).toHaveText(
    "The method gives the recipe’s own amounts and temperatures, for 4 servings.",
  );
  await expect(page.getByTestId("RecipeMethod.step").first()).toContainText("220°C");

  await page.getByTestId("RecipeIngredients.backToWritten").click();
  await expect(page.getByTestId("RecipeIngredients.servings")).toHaveText("4 servings");
  await expect(page.getByTestId("RecipeIngredients.status")).toHaveCount(0);
  await expect(page.getByTestId("RecipeIngredients.line").nth(3)).toHaveText("500ml vegetable stock");
});

test("a recipe with no yield scales by a multiplier, and one with no times shows no row", async ({ page, launcher, backendSimulator }) => {
  const plain = makeRecipeOverview();
  backendSimulator.overviews.seed({
    ...plain,
    recipe: { ...plain.recipe!, yield: null, prepMinutes: null, cookMinutes: null, totalMinutes: null },
  });
  const library = await launcher.launchExpectingLibrary();
  await expect(page.getByText(/· Recipe$/)).toBeVisible();
  await library.nthCard(0).openReader();

  await expect(page.getByTestId("RecipeTimes.root")).toHaveCount(0);
  await page.getByTestId("RecipeIngredients.multiplier.2×").check();
  await expect(page.getByTestId("RecipeIngredients.status")).toContainText("Doubled.");
  await expect(page.getByTestId("RecipeIngredients.line").nth(1)).toHaveText("6 tbsp olive oil, plus extra to serve");
});

test("the library files recipes as their own source once there are others", async ({ page, launcher, backendSimulator }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  backendSimulator.overviews.seed(makeRecipeOverview());
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "A video about pricing" } }));
  const library = await launcher.launchExpectingLibrary();

  await page.getByTestId("FilterPanel.moreFiltersButton").click();
  await page.getByTestId("FilterPanel.source.recipe").click();

  await library.expectCardCountToBe(1);
  await library.verifyCardOrder(["Charred leek and white bean stew"]);
  await expect(page.getByTestId("FilterPanel.moreFiltersSummary")).toHaveText("Recipes · Any verdict");
});

test("copy recipe gives the page's recipe with its source, and never the summary", async ({ page, context, launcher, backendSimulator }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  backendSimulator.overviews.seed(makeRecipeOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("OverviewActionsMenu.trigger").click();
  await page.getByTestId("OverviewActionsMenu.copyRecipeItem").click();

  await expect(page.getByRole("status").filter({ hasText: "Recipe copied, with a link to Example Kitchen" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Charred leek and white bean stew\nFrom Example Kitchen: https://examplekitchen.example/recipes/charred-leek-white-bean-stew");
  expect(copied).toContain("Ingredients\n- 3 large leeks");
  expect(copied).toContain("Method\n1. Heat the oven");
  expect(copied).not.toContain("weeknight stew rests");
});

test("a list's Read aloud starts at its first line, and the bar says where the voice is", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeIngredients.readAloud").click();

  await expect(page.getByTestId("RecipeIngredients.activeLine")).toHaveText("3 large leeks, trimmed and halved lengthways");
  await expect(page.getByTestId("ReaderPlayerBar.label")).toContainText("Now reading · Ingredients · 1 of 8");
  await expect(page.getByTestId("RecipeIngredients.readAloud")).toHaveText("Pause reading");
  await expect(page.getByText("Ingredients · 8", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("ReadAlongNote.line").filter({ hasText: "3 large leeks" })).toHaveCount(0);
});

test("the narration runs from the summary through the ingredients into the method", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  for (let step = 0; step < 3; step += 1) await page.keyboard.press("]");
  await expect(page.getByTestId("RecipeIngredients.activeLine")).toHaveText("3 large leeks, trimmed and halved lengthways");
  for (let step = 0; step < 9; step += 1) await page.keyboard.press("]");
  await expect(page.getByTestId("RecipeIngredients.activeLine")).toHaveCount(0);
  await expect(page.getByTestId("RecipeMethod.activeStep")).toContainText("Heat the oven");
});

test("Read aloud plays just its list, and stops before the method", async ({ page, launcher, backendSimulator }) => {
  const recipe = makeRecipeOverview();
  backendSimulator.overviews.seed({ ...recipe, recipe: { ...recipe.recipe!, ingredients: ["2 leeks", "Salt"] } });
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeIngredients.readAloud").click();
  await expect(page.getByTestId("RecipeIngredients.activeLine")).toHaveText("2 leeks");

  await expect(page.getByTestId("RecipeIngredients.readAloud")).toHaveText("Read them aloud", { timeout: 20_000 });
  await expect(page.getByTestId("RecipeIngredients.activeLine")).toContainText("Salt");
  await expect(page.getByTestId("RecipeMethod.activeStep")).toHaveCount(0);
});

test("the print sheet carries the page's image and our name and mark, and nothing of our summary", async ({ page, launcher, backendSimulator }) => {
  await page.route("https://images.example/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"),
    }),
  );
  const recipe = makeRecipeOverview();
  backendSimulator.overviews.seed({ ...recipe, source: { ...recipe.source, imageUrl: "https://images.example/stew.png" } as never });
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });

  await page.getByTestId("OverviewActionsMenu.trigger").click();
  await page.getByTestId("OverviewActionsMenu.printRecipeItem").click();

  const sheet = page.getByTestId("RecipePrintSheet.root");
  await expect(sheet.getByTestId("RecipePrintSheet.image")).toHaveAttribute("src", "https://images.example/stew.png");
  await expect(sheet.getByTestId("RecipePrintSheet.madeWith")).toHaveText("Made with The Overview");
  await expect(sheet).not.toContainText("weeknight stew rests");
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
});
