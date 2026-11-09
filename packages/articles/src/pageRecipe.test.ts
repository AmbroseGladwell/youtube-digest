import test from "node:test";
import assert from "node:assert/strict";
import { ExtractedArticle, Recipe, type ArticleRead } from "@overview/domain";
import { FOOD_ARTICLE_PAGE, pageFrom, paragraphs, RECIPE_PAGE, recipePage, recipeWith } from "./pageFixtures.testHelper.js";
import { pageRecipe } from "./pageRecipe.js";
import { readArticle } from "./readArticle.js";

const URL = "https://kitchen.example/dal";
const recipeIn = (html: string) => pageRecipe(pageFrom(html, URL));
const read = (html: string): ArticleRead => {
  const page = pageFrom(html, URL);
  return readArticle(page, page.location.href);
};
const articleIn = (html: string) => {
  const result = read(html);
  assert.equal(result.status, "read");
  return (result as Extract<ArticleRead, { status: "read" }>).article;
};

test("a declared recipe arrives whole, in the shape the rest of the app reads", () => {
  const recipe = recipeIn(RECIPE_PAGE);
  assert.doesNotThrow(() => Recipe.parse(recipe));
  assert.deepEqual(recipe, {
    ingredients: ["250g red lentils", "1 tsp cumin seeds & a pinch of salt", "2 large onions"],
    steps: [
      { text: "Rinse the lentils.", group: "For the dal" },
      { text: "Simmer until soft.", group: "For the dal" },
      { text: "Fry the cumin in butter.", group: "For the tarka" },
    ],
    prepMinutes: 10,
    cookMinutes: 65,
    totalMinutes: 75,
    yield: "4 servings",
  });
});

test("the method is read however the page wrote it", () => {
  const steps = (recipeInstructions: unknown) => recipeIn(recipePage(recipeWith({ recipeInstructions })))?.steps.map(({ text }) => text);
  assert.deepEqual(steps("Rinse them.\nSimmer them."), ["Rinse them.", "Simmer them."]);
  assert.deepEqual(steps("<ol><li>Rinse them.</li><li>Simmer them.</li></ol>"), ["Rinse them.", "Simmer them."]);
  assert.deepEqual(steps(["Rinse them.", "Simmer them."]), ["Rinse them.", "Simmer them."]);
  assert.deepEqual(steps([{ "@type": "HowToStep", name: "Rinse them." }]), ["Rinse them."]);
  assert.deepEqual(steps({ "@type": "ItemList", itemListElement: [{ "@type": "HowToStep", text: "Rinse them." }] }), ["Rinse them."]);
});

test("a time or a yield the page didn't state in a form code can read stays empty, never guessed", () => {
  const recipe = recipeIn(
    recipePage(recipeWith({ prepTime: "10 minutes", cookTime: "PT0M", totalTime: undefined, recipeYield: undefined })),
  );
  assert.equal(recipe?.prepMinutes, null);
  assert.equal(recipe?.cookMinutes, null);
  assert.equal(recipe?.totalMinutes, null);
  assert.equal(recipe?.yield, null);
});

test("a numeric yield is kept, and the legacy ingredients key is read", () => {
  const recipe = recipeIn(recipePage(recipeWith({ recipeYield: 6, recipeIngredient: undefined, ingredients: ["1 lemon"] })));
  assert.equal(recipe?.yield, "6");
  assert.deepEqual(recipe?.ingredients, ["1 lemon"]);
});

test("a recipe nested as the page's main entity, or typed as several things, is found", () => {
  assert.notEqual(recipeIn(recipePage({ "@type": "WebPage", mainEntity: recipeWith({}) })), null);
  assert.notEqual(recipeIn(recipePage(recipeWith({ "@type": ["Recipe", "NewsArticle"] }))), null);
});

test("no recipe is claimed from a page that doesn't give both ingredients and method", () => {
  assert.equal(recipeIn(FOOD_ARTICLE_PAGE), null);
  assert.equal(recipeIn(recipePage(recipeWith({ recipeInstructions: undefined }))), null);
  assert.equal(recipeIn(recipePage(recipeWith({ recipeIngredient: [] }))), null);
});

test("a round-up reads as an article, and the same recipe declared twice is still one recipe", () => {
  assert.equal(recipeIn(recipePage([recipeWith({}), recipeWith({ name: "Weeknight rice" })])), null);
  assert.notEqual(recipeIn(recipePage([recipeWith({}), recipeWith({})])), null);
});

test("a recipe the page marks as not free is left alone", () => {
  assert.equal(recipeIn(recipePage(recipeWith({ isAccessibleForFree: "False" }))), null);
});

test("an article read from a recipe page carries the recipe, and passes the article shape", () => {
  const article = articleIn(RECIPE_PAGE);
  assert.doesNotThrow(() => ExtractedArticle.parse(article));
  assert.equal(article.recipe?.ingredients.length, 3);
});

test("a food article with no recipe reads exactly as an article", () => {
  assert.equal(articleIn(FOOD_ARTICLE_PAGE).recipe, null);
});

test("a recipe with almost no prose around it is still read", () => {
  const short = articleIn(recipePage(recipeWith({}), "<p>Quick dal.</p>"));
  assert.ok(short.recipe !== null);
  assert.ok(short.wordCount > 0);
});

test("a recipe with no prose at all still reads, its text standing in for the article's", () => {
  const empty = articleIn(recipePage(recipeWith({}), ""));
  assert.equal(empty.sections.length, 1);
  assert.ok(empty.recipe !== null);
});

test("an older device's article, with no recipe on it, still parses", () => {
  const { recipe: _, ...older } = articleIn(recipePage({ "@type": "NewsArticle" }, paragraphs(6)));
  assert.equal(ExtractedArticle.parse(older).recipe, null);
});
