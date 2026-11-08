import test from "node:test";
import assert from "node:assert/strict";
import { adjustIngredient, adjustedText, servingsLabel, yieldCount, type AdjustedIngredient } from "./adjustIngredient.js";

const doubled = (line: string) => adjustedText(adjustIngredient(line, 2, "asWritten"));
const changed = (adjusted: AdjustedIngredient) =>
  adjusted.kind === "adjusted" ? adjusted.pieces.filter((piece) => piece.changed).map(({ text }) => text) : [];

test("as written at 1× is the page's line, untouched", () => {
  assert.deepEqual(adjustIngredient("3 tbsp olive oil", 1, "asWritten"), { kind: "asWritten", line: "3 tbsp olive oil" });
});

test("an amount at the start of a line scales, and only the amount is marked", () => {
  assert.equal(doubled("3 tbsp olive oil, plus extra to serve"), "6 tbsp olive oil, plus extra to serve");
  assert.equal(doubled("500ml vegetable stock"), "1000ml vegetable stock");
  assert.equal(doubled("3 large leeks, trimmed"), "6 large leeks, trimmed");
  assert.deepEqual(changed(adjustIngredient("3 tbsp olive oil", 2, "asWritten")), ["6 tbsp"]);
});

test("fractions and ranges scale as kitchen fractions", () => {
  assert.equal(adjustedText(adjustIngredient("1½ tsp salt", 0.5, "asWritten")), "¾ tsp salt");
  assert.equal(doubled("2–3 tbsp cold water"), "4–6 tbsp cold water");
  assert.equal(doubled("2-3 tbsp cold water"), "4–6 tbsp cold water");
  assert.equal(doubled("1-1/2 cups sweetened shredded coconut"), "3 cups sweetened shredded coconut");
  assert.equal(adjustedText(adjustIngredient("1-1/2 teaspoons vanilla extract", 0.5, "asWritten")), "¾ teaspoon vanilla extract");
  assert.equal(adjustedText(adjustIngredient("1/2 cup milk", 3, "asWritten")), "1½ cups milk");
});

test("one becoming several takes the plural of its noun", () => {
  assert.equal(doubled("1 lemon, zested and juiced"), "2 lemons, zested and juiced");
  assert.equal(doubled("1 small garlic clove, grated"), "2 small garlic cloves, grated");
  assert.equal(doubled("1 bay leaf"), "2 bay leaves");
  assert.equal(doubled("Juice of 1 lemon"), "Juice of 2 lemons");
  assert.equal(doubled("1 red chilli, finely chopped"), "2 red chillies, finely chopped");
  assert.equal(doubled("1 ripe avocado, stoned"), "2 ripe avocados, stoned");
  assert.equal(doubled("1 large tomato"), "2 large tomatoes");
});

test("with no comma, the noun is the word before how it's prepared", () => {
  assert.equal(doubled("1 onion finely chopped"), "2 onions finely chopped");
  assert.equal(doubled("1 large onion finely chopped"), "2 large onions finely chopped");
  assert.equal(doubled("1 red chilli deseeded and finely chopped"), "2 red chillies deseeded and finely chopped");
  assert.equal(doubled("1 garlic clove crushed"), "2 garlic cloves crushed");
  assert.equal(doubled("1 leek finely sliced"), "2 leeks finely sliced");
  assert.equal(doubled("1 ripe avocado stoned and cubed"), "2 ripe avocados stoned and cubed");
  assert.equal(doubled("1 butternut squash peeled, deseeded and cut into chunks"), "2 butternut squashes peeled, deseeded and cut into chunks");
  assert.equal(doubled("1 dried bay leaf"), "2 dried bay leaves");
  assert.equal(doubled("1 smoked haddock fillet"), "2 smoked haddock fillets");
});

test("a heaped or level spoon is still a spoon", () => {
  assert.equal(doubled("1 heaped tsp ground coriander"), "2 heaped tsp ground coriander");
  assert.equal(doubled("1 level teaspoon salt"), "2 level teaspoons salt");
});

test("a tin's size stays as sold, and is said to", () => {
  const adjusted = adjustIngredient("2 × 400g tins cannellini beans, drained", 2, "us");
  assert.equal(adjustedText(adjusted), "4 × 400g tins cannellini beans, drained");
  assert.equal(adjusted.kind === "adjusted" && adjusted.packAsSold, true);
});

test("a line that starts with a pack size scales by how many packs", () => {
  const adjusted = adjustIngredient("400g can chopped tomatoes", 2, "asWritten");
  assert.equal(adjustedText(adjusted), "2 × 400g cans chopped tomatoes");
  assert.deepEqual(changed(adjusted), ["2"]);
  assert.equal(adjusted.kind === "adjusted" && adjusted.packAsSold, true);
  assert.equal(doubled("400g tin of tomatoes"), "2 × 400g tins of tomatoes");
  assert.equal(adjustedText(adjustIngredient("500g tub mascarpone", 3, "us")), "3 × 500g tubs mascarpone");
  assert.equal(adjustedText(adjustIngredient("190g jar pesto", 0.5, "asWritten")), "½ × 190g jar pesto");
  assert.equal(adjustedText(adjustIngredient("400g can chopped tomatoes", 1.5, "asWritten")), "1½ × 400g cans chopped tomatoes");
  assert.equal(doubled("4 × 400g tins"), "8 × 400g tins");
});

test("a pack's size is never converted, so changing units alone leaves it the same", () => {
  assert.equal(adjustIngredient("400g can chopped tomatoes", 1, "us").kind, "same");
});

test("a pack size in brackets after the pack is not a second amount", () => {
  const adjusted = adjustIngredient("1 small tub (200g) low-fat crème fraîche", 2, "asWritten");
  assert.equal(adjustedText(adjusted), "2 small tubs (200g) low-fat crème fraîche");
  assert.deepEqual(changed(adjusted), ["2"]);
  assert.equal(adjusted.kind === "adjusted" && adjusted.packAsSold, true);
  assert.equal(adjustIngredient("1 small tub (200g) low-fat crème fraîche", 1, "us").kind, "same");
});

test("a second amount anywhere else still keeps a line as written", () => {
  assert.equal(adjustIngredient("1 tbsp (15ml) oil", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("1 tub (or 2 small ones) yoghurt", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("400–500g jar passata", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("400g can tomatoes, plus 1 tbsp purée", 2, "asWritten").kind, "unreadable");
});

test("lines with no amount, or more than one, stay as written", () => {
  assert.equal(adjustIngredient("A handful of parsley", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("Salt and black pepper", 2, "us").kind, "unreadable");
  assert.equal(adjustIngredient("1 tbsp sugar & 1 tsp salt", 2, "asWritten").kind, "unreadable");
});

test("units convert within their kind only", () => {
  assert.equal(adjustedText(adjustIngredient("500ml vegetable stock", 2, "us")), "4¼ cups vegetable stock");
  assert.equal(adjustedText(adjustIngredient("50g parmesan, finely grated", 2, "us")), "3½ oz parmesan, finely grated");
  assert.equal(adjustedText(adjustIngredient("8 oz cheddar", 1, "metric")), "225g cheddar");
  assert.equal(adjustedText(adjustIngredient("2 cups flour", 1, "metric")), "475ml flour");
  assert.equal(adjustedText(adjustIngredient("2.2kg lamb shoulder", 1, "us")), "4¾ lb lamb shoulder");
});

test("a line already in the units asked for is the same, not marked", () => {
  assert.equal(adjustIngredient("3 tbsp olive oil", 1, "us").kind, "same");
  assert.equal(adjustIngredient("3 large leeks", 1, "metric").kind, "same");
  assert.equal(adjustIngredient("500ml stock", 1, "metric").kind, "same");
});

test("servings step from the yield's own number", () => {
  assert.equal(yieldCount("4 servings"), 4);
  assert.equal(yieldCount("6"), 6);
  assert.equal(yieldCount("Makes 24 cookies"), 24);
  assert.equal(yieldCount("1 jar"), 1);
  assert.equal(yieldCount("4-6 servings"), null);
  assert.equal(yieldCount("A big pot"), null);
  assert.equal(yieldCount(null), null);
  assert.equal(servingsLabel("4 servings", 8), "8 servings");
  assert.equal(servingsLabel("6", 12), "Makes 12");
});
