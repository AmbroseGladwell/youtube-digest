import test from "node:test";
import assert from "node:assert/strict";
import { markupRecipe } from "./markupRecipe.js";
import { MARKUP_INGREDIENTS, MARKUP_METHOD, markupRecipePage, pageFrom } from "./pageFixtures.testHelper.js";

const factsOf = (before: string, { method = MARKUP_METHOD, after = "" } = {}) => {
  const recipe = markupRecipe(pageFrom(markupRecipePage(before + MARKUP_INGREDIENTS + method + after)));
  assert.notEqual(recipe, null);
  const { prepMinutes, cookMinutes, totalMinutes, yield: stated } = recipe!;
  return { prepMinutes, cookMinutes, totalMinutes, yield: stated };
};

const NONE = { prepMinutes: null, cookMinutes: null, totalMinutes: null, yield: null };

test("times and servings labelled on the page are read, and a total it doesn't give stays empty", () => {
  const halloumi = `<ul class="clearfix"><li><span class="text"><strong>Prep:</strong>5 mins <br><meta content="PT5M">
<strong>Cook:</strong>20 mins <br><meta content="PT20M"><meta content="PT25M"></span></li><li><span class="text"> Serves 2 </span></li></ul>`;
  assert.deepEqual(factsOf(halloumi), { prepMinutes: 5, cookMinutes: 20, totalMinutes: null, yield: "Serves 2" });
});

test("a label and its value in neighbouring blocks are read together", () => {
  const listed = "<dl><dt>Prep time</dt><dd>1 hr 15 mins</dd><dt>Total time:</dt><dd>2 hours</dd><dt>Makes</dt><dd>12 cookies</dd></dl>";
  assert.deepEqual(factsOf(listed), { prepMinutes: 75, cookMinutes: null, totalMinutes: 120, yield: "Makes 12 cookies" });
});

test("a range, a time in words or a zero is left empty, never guessed", () => {
  assert.deepEqual(factsOf("<p>Prepare: 30 mins to 1 hour</p><p>Cook: overnight</p><p>Ready in: 0 mins</p><p>Serves: plenty</p>"), NONE);
  assert.deepEqual(factsOf("<p>Prep: 10-15 mins</p>").prepMinutes, null);
});

test("times in the prose or the method are never read as the recipe's", () => {
  const prose = "<p>Cook 10 mins and it's done, and it serves 4 people with plenty left over for lunch.</p>";
  const method = MARKUP_METHOD.replace("</ol>", "<li>Cook: 10 mins</li></ol>");
  assert.deepEqual(factsOf(prose), NONE);
  assert.deepEqual(factsOf("", { method }), NONE);
});

test("labels after the method belong to other recipes, and two different values for one label leave it empty", () => {
  assert.deepEqual(factsOf("", { after: '<div class="related"><p>Prep: 10 mins</p><p>Serves 6</p></div>' }), NONE);
  assert.deepEqual(factsOf("<p>Prep: 10 mins</p><p>Prep: 25 mins</p><p>Cook: 20 mins</p><p>Cook: 20 mins</p>"), {
    ...NONE,
    cookMinutes: 20,
  });
});
