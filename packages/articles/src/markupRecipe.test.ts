import test from "node:test";
import assert from "node:assert/strict";
import { ExtractedArticle, Recipe, type ArticleRead } from "@overview/domain";
import { markupRecipe } from "./markupRecipe.js";
import {
  MARKUP_INGREDIENTS,
  MARKUP_METHOD,
  MARKUP_RECIPE_PAGE,
  markupRecipePage,
  pageFrom,
  recipeWith,
} from "./pageFixtures.testHelper.js";
import { pageRecipe } from "./pageRecipe.js";
import { readArticle } from "./readArticle.js";

const URL = "https://www.bbcgoodfoodme.com/recipes/bean-halloumi-stew/";
const recipeIn = (html: string) => markupRecipe(pageFrom(html, URL));
const recipeOf = (recipe: string) => recipeIn(markupRecipePage(recipe));
const stepsOf = (method: string) => recipeOf(MARKUP_INGREDIENTS + method)?.steps;

test("a recipe laid out under its headings arrives whole, with nothing the page didn't state", () => {
  const recipe = recipeIn(MARKUP_RECIPE_PAGE);
  assert.doesNotThrow(() => Recipe.parse(recipe));
  assert.deepEqual(recipe, {
    ingredients: [
      "3 tbsp olive oil",
      "1 onion, thinly sliced",
      "400g can mixed beans, drained",
      "½ x 250g block halloumi, sliced",
      "garlic bread, to serve (optional)",
    ],
    steps: [
      { text: "Heat 2 tbsp of oil in a frying pan and fry the onion for 10 mins.", group: null },
      { text: "Fry the halloumi for 2 mins on each side until golden.", group: null },
    ],
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    yield: null,
  });
});

test("a method written as paragraphs is read a step to a paragraph", () => {
  assert.deepEqual(
    stepsOf("<h2>Method:</h2><p>Heat the oil in a large pan.</p><p>Fry the halloumi until golden.</p>")?.map(({ text }) => text),
    ["Heat the oil in a large pan.", "Fry the halloumi until golden."],
  );
});

test("a smaller heading inside the method names its steps, unless it only numbers them", () => {
  const steps = stepsOf(`<h2>Instructions</h2><h3>For the beans</h3><p>Simmer the beans in the tomatoes.</p>
<h3>Step 2</h3><p>Fry the halloumi until golden.</p>`);
  assert.deepEqual(steps, [
    { text: "Simmer the beans in the tomatoes.", group: "For the beans" },
    { text: "Fry the halloumi until golden.", group: null },
  ]);
});

test("a heading that is a link, or sits in the page's furniture, is never taken for the recipe", () => {
  assert.equal(recipeOf(""), null);
  assert.equal(recipeIn(markupRecipePage(`<nav>${MARKUP_INGREDIENTS}</nav>${MARKUP_METHOD}`)), null);
  assert.equal(recipeIn(markupRecipePage(`<div class="comments">${MARKUP_INGREDIENTS + MARKUP_METHOD}</div>`)), null);
});

test("a page whose own classes mention comments still has its recipe read", () => {
  const open = MARKUP_RECIPE_PAGE.replace("<body>", '<body class="single comments-open">');
  assert.notEqual(recipeIn(open), null);
});

test("a list that doesn't read as ingredients, or a method that doesn't read as steps, is no recipe", () => {
  const lineup = "<h3>Ingredients</h3><ul><li>Fruit</li><li>Vegetables</li><li>Dairy</li></ul>";
  assert.equal(recipeOf(lineup + MARKUP_METHOD), null);
  assert.equal(recipeOf(MARKUP_INGREDIENTS + "<h3>Method</h3><ol><li>Bake</li><li>Serve</li></ol>"), null);
});

test("both parts have to be there, ingredients first", () => {
  assert.equal(recipeOf(MARKUP_INGREDIENTS), null);
  assert.equal(recipeOf(MARKUP_METHOD), null);
  assert.equal(recipeOf(MARKUP_METHOD + MARKUP_INGREDIENTS), null);
});

test("a round-up reads as an article, and the same recipe shown twice is still one recipe", () => {
  const other = MARKUP_INGREDIENTS.replace("3 tbsp olive oil", "2 tbsp butter");
  assert.equal(recipeOf(MARKUP_INGREDIENTS + MARKUP_METHOD + other + MARKUP_METHOD), null);
  assert.notEqual(recipeOf(MARKUP_INGREDIENTS + MARKUP_METHOD + MARKUP_INGREDIENTS + MARKUP_METHOD), null);
});

test("a page that declares a recipe is taken at its word, and its markup isn't read", () => {
  const declaredHidden = markupRecipePage(MARKUP_INGREDIENTS + MARKUP_METHOD, recipeWith({ isAccessibleForFree: false }));
  assert.equal(pageRecipe(pageFrom(declaredHidden, URL)), null);
  assert.notEqual(pageRecipe(pageFrom(MARKUP_RECIPE_PAGE, URL)), null);
});

test("a short page with a recipe only in its markup reads as a recipe, not as nothing", () => {
  const read: ArticleRead = readArticle(pageFrom(MARKUP_RECIPE_PAGE, URL), URL);
  assert.equal(read.status, "read");
  const { article } = read as Extract<ArticleRead, { status: "read" }>;
  assert.doesNotThrow(() => ExtractedArticle.parse(article));
  assert.equal(article.recipe?.ingredients.length, 5);
});
