import test from "node:test";
import assert from "node:assert/strict";
import { tidyIngredient } from "./tidyIngredient.js";
import { spokenMeasures } from "./spokenMeasures.js";
import { methodAmounts } from "./methodAmounts.js";
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
  assert.equal(
    doubled("1 butternut squash peeled, deseeded and cut into chunks"),
    "2 butternut squashes peeled, deseeded and cut into chunks",
  );
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

test("several becoming one, or less, takes the singular of its noun", () => {
  const halved = (line: string) => adjustedText(adjustIngredient(line, 0.5, "asWritten"));
  assert.equal(
    halved("2 large eggs ((50 - 55g / 2 oz each), at room temp (Note 3))"),
    "1 large egg ((50 - 55g / 2 oz each), at room temp (Note 3))",
  );
  assert.equal(halved("2 garlic cloves, crushed"), "1 garlic clove, crushed");
  assert.equal(halved("2 bay leaves"), "1 bay leaf");
  assert.equal(halved("2 red chillies, finely chopped"), "1 red chilli, finely chopped");
  assert.equal(halved("2 large tomatoes"), "1 large tomato");
  assert.equal(halved("2 anchovies"), "1 anchovy");
  assert.equal(halved("2 radishes"), "1 radish");
  assert.equal(adjustedText(adjustIngredient("4 asparagus", 0.25, "asWritten")), "1 asparagus");
  assert.equal(adjustedText(adjustIngredient("3 large eggs", 1 / 3, "asWritten")), "1 large egg");
  assert.equal(adjustedText(adjustIngredient("1 large egg", 0.5, "asWritten")), "½ large egg");
  assert.equal(adjustedText(adjustIngredient("3 large eggs", 0.5, "asWritten")), "1½ large eggs");
});

test("in Metric a cup of a dry ingredient the table knows is weighed, and anything else is measured", () => {
  const metric = (line: string, factor = 1) => adjustedText(adjustIngredient(line, factor, "metric"));
  assert.equal(
    metric("1 cup plain / all purpose flour (cake flour OK too, Note 1)"),
    "120g plain / all purpose flour (cake flour OK too, Note 1)",
  );
  assert.equal(metric("3/4 cup caster / superfine sugar", 2), "285g caster / superfine sugar");
  assert.equal(metric("1/2 cup butter, softened"), "115g butter, softened");
  assert.equal(metric("10 cups plain flour"), "1.2kg plain flour");
  assert.equal(metric("1/2 cup milk, full fat (Note 5)"), "120ml milk, full fat (Note 5)");
  assert.equal(metric("1 cup rice flour"), "235ml rice flour");
  assert.equal(metric("2 tbsp plain flour"), "2 tbsp plain flour");
  assert.equal(adjustedText(adjustIngredient("1 cup plain flour", 2, "us")), "2 cups plain flour");
  assert.equal(adjustedText(adjustIngredient("150g plain flour", 1, "us")), "5¼ oz plain flour");
});

test("a tidied line from a page that wraps its notes twice still scales", () => {
  assert.equal(
    doubled(tidyIngredient("60g / 1/4 cup unsalted butter (, cut into 1.5cm / 1/2” cubes)")),
    "120g / ½ cup unsalted butter, cut into 1.5cm / 1/2” cubes",
  );
  assert.equal(
    doubled(tidyIngredient("2 large eggs ((50 - 55g / 2 oz each), at room temp (Note 3))")),
    "4 large eggs (50 - 55g / 2 oz each), at room temp (Note 3)",
  );
  assert.equal(doubled("600g chicken breast fillets cut into 2cm pieces"), "1200g chicken breast fillets cut into 2cm pieces");
  assert.equal(adjustIngredient("2cm/¾in fresh root ginger", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("1 onion, plus 2 more to serve", 2, "asWritten").kind, "unreadable");
});

test("a counted measure scales and agrees, and the ingredient keeps its name", () => {
  assert.equal(doubled("1 pint milk"), "2 pints milk");
  assert.equal(doubled("1 stick butter"), "2 sticks butter");
  assert.equal(doubled("1 dash Worcestershire sauce"), "2 dashes Worcestershire sauce");
  assert.equal(doubled("1 pinch of salt"), "2 pinches of salt");
  assert.equal(doubled("1 clove garlic, crushed"), "2 cloves garlic, crushed");
  assert.equal(doubled("2 garlic cloves, crushed"), "4 garlic cloves, crushed");
  assert.equal(doubled("1 sprig rosemary"), "2 sprigs rosemary");
  assert.equal(doubled("1 handful spinach"), "2 handfuls spinach");
  assert.equal(doubled("1 bunch coriander, chopped"), "2 bunches coriander, chopped");
  assert.equal(adjustedText(adjustIngredient("2 pinches chilli flakes", 0.5, "asWritten")), "1 pinch chilli flakes");
  assert.equal(adjustedText(adjustIngredient("4 rashers smoked bacon", 0.5, "asWritten")), "2 rashers smoked bacon");
});

test("quarts and gallons convert, a pint never does, and Metric weighs a stick of butter", () => {
  assert.equal(adjustedText(adjustIngredient("1 quart chicken stock", 1, "metric")), "945ml chicken stock");
  assert.equal(adjustedText(adjustIngredient("1 gallon water", 1, "metric")), "3.79 litres water");
  assert.equal(adjustedText(adjustIngredient("1 quart stock", 2, "us")), "2 quarts stock");
  assert.equal(adjustIngredient("1 pint milk", 1, "metric").kind, "same");
  assert.equal(adjustedText(adjustIngredient("1 pint milk", 2, "metric")), "2 pints milk");
  assert.equal(adjustedText(adjustIngredient("1 stick unsalted butter, softened", 1, "metric")), "115g unsalted butter, softened");
  assert.equal(adjustedText(adjustIngredient("2 sticks butter", 1, "metric")), "225g butter");
  assert.equal(adjustIngredient("1 stick celery", 1, "metric").kind, "same");
});

test("an amount written as a word scales as its number does", () => {
  assert.equal(doubled("two eggs"), "4 eggs");
  assert.equal(doubled("Three large carrots, peeled"), "6 large carrots, peeled");
  assert.equal(doubled("one onion, diced"), "2 onions, diced");
  assert.equal(doubled("half a lemon, juiced"), "1 lemon, juiced");
  assert.equal(doubled("half an onion"), "1 onion");
  assert.equal(doubled("a dozen eggs"), "24 eggs");
  assert.equal(doubled("Juice of one lemon"), "Juice of 2 lemons");
  assert.equal(doubled("two cups plain flour"), "4 cups plain flour");
  assert.equal(adjustedText(adjustIngredient("four eggs", 0.25, "asWritten")), "1 egg");
  assert.equal(adjustIngredient("two eggs", 1, "metric").kind, "same");
  assert.equal(adjustIngredient("onions", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("A handful of parsley", 2, "asWritten").kind, "unreadable");
  const adjusted = adjustIngredient("two eggs", 2, "asWritten");
  assert.equal(adjusted.kind === "adjusted" && adjusted.written, "two");
});

test("a scaled cup or spoon is said in sizes a kitchen has, within 5%", () => {
  const halved = (line: string) => adjustedText(adjustIngredient(line, 0.5, "asWritten"));
  assert.equal(halved("3/4 cup caster / superfine sugar"), "¼ cup + 2 tbsp caster / superfine sugar");
  assert.equal(halved("1 1/4 tsp baking powder"), "½ tsp + ⅛ tsp baking powder");
  assert.equal(halved("1 1/4 teaspoons vanilla extract"), "½ teaspoon + ⅛ teaspoon vanilla extract");
  assert.equal(halved("1/4 cup unsalted butter"), "2 tbsp unsalted butter");
  assert.equal(halved("1/3 cup oil"), "2 tbsp + 2 tsp oil");
  assert.equal(halved("1 tbsp olive oil"), "1½ tsp olive oil");
  assert.equal(halved("3/4 tsp salt"), "¼ tsp + ⅛ tsp salt");
  assert.equal(halved("1/8 tsp salt"), "1 pinch salt");
  assert.equal(adjustedText(adjustIngredient("3/4 cup plain flour", 1.5, "asWritten")), "1 cup + 2 tbsp plain flour");
  assert.equal(adjustedText(adjustIngredient("250ml milk", 1, "us")), "1 cup + 1 tbsp milk");
  assert.equal(adjustedText(adjustIngredient("60g / 1/4 cup unsalted butter", 0.5, "us")), "2 tbsp unsalted butter");
});

test("an amount already a kitchen size, or not scaled, reads as before", () => {
  assert.equal(adjustedText(adjustIngredient("1/2 cup milk", 3, "asWritten")), "1½ cups milk");
  assert.equal(adjustedText(adjustIngredient("2/3 cup milk", 0.5, "asWritten")), "⅓ cup milk");
  assert.equal(adjustedText(adjustIngredient("1 1/2 tsp oil", 0.5, "asWritten")), "¾ tsp oil");
  assert.equal(adjustedText(adjustIngredient("1/8 tsp salt", 2, "asWritten")), "¼ tsp salt");
  assert.equal(adjustIngredient("1/3 tsp cumin", 1, "us").kind, "same");
  assert.equal(adjustedText(adjustIngredient("2–3 tbsp cold water", 0.5, "asWritten")), "1–1½ tbsp cold water");
});

test("a size and a spoon read aloud with plus, and the method follows them", () => {
  const sugar = adjustIngredient("3/4 cup caster sugar", 0.5, "asWritten");
  assert.equal(spokenMeasures(adjustedText(sugar)), "quarter cup plus 2 tablespoons caster sugar");
  const [followed] = methodAmounts(["3/4 cup caster sugar"], [sugar]);
  assert.equal(followed?.adjusted, "¼ cup + 2 tbsp");
});

test("a bracketed note whose numbers point at a note, a cut or one item scales with the line", () => {
  assert.equal(
    doubled("1 cup plain / all purpose flour ((cake flour OK too, Note 1))"),
    "2 cups plain / all purpose flour ((cake flour OK too, Note 1))",
  );
  assert.equal(doubled("1 1/4 tsp baking powder ((NOT baking soda, Note 2))"), "2½ tsp baking powder ((NOT baking soda, Note 2))");
  assert.equal(
    doubled("2 large eggs ((50 - 55g / 2 oz each), at room temp (Note 3))"),
    "4 large eggs ((50 - 55g / 2 oz each), at room temp (Note 3))",
  );
  assert.equal(doubled("60g unsalted butter (, cut into 1.5cm / 1/2” cubes)"), "120g unsalted butter (, cut into 1.5cm / 1/2” cubes)");
  assert.equal(doubled("200ml/7fl oz stock (Note 4)"), "400ml/14fl oz stock (Note 4)");
  assert.equal(adjustedText(adjustIngredient("1/2 cup milk (, full fat (Note 5))", 1, "metric")), "120ml milk (, full fat (Note 5))");
  assert.equal(doubled("1 onion, diced (see notes 2 and 3)"), "2 onions, diced (see notes 2 and 3)");
});

test("a bracket holding another amount still keeps a line as written", () => {
  assert.equal(adjustIngredient("2 onions (about 300g)", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("1 onion (or 2 small ones), diced", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("1 cup milk (Note 2, or 250ml cream)", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("60g / 1/4 cup butter (plus 1 tbsp for the tin)", 2, "asWritten").kind, "unreadable");
});

test("lines with no amount, or more than one, stay as written", () => {
  assert.equal(adjustIngredient("A handful of parsley", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("Salt and black pepper", 2, "us").kind, "unreadable");
  assert.equal(adjustIngredient("1 tbsp sugar & 1 tsp salt", 2, "asWritten").kind, "unreadable");
});

test("units convert within their kind, apart from a cup the weight table knows", () => {
  assert.equal(adjustedText(adjustIngredient("500ml vegetable stock", 2, "us")), "4¼ cups vegetable stock");
  assert.equal(adjustedText(adjustIngredient("50g parmesan, finely grated", 2, "us")), "3½ oz parmesan, finely grated");
  assert.equal(adjustedText(adjustIngredient("8 oz cheddar", 1, "metric")), "225g cheddar");
  assert.equal(adjustedText(adjustIngredient("2 cups flour", 1, "metric")), "240g flour");
  assert.equal(adjustedText(adjustIngredient("2 cups chicken stock", 1, "metric")), "475ml chicken stock");
  assert.equal(adjustedText(adjustIngredient("2.2kg lamb shoulder", 1, "us")), "4¾ lb lamb shoulder");
});

test("one amount in both systems scales both halves as written, the metric half in Metric, and US units in US", () => {
  const atDouble = (line: string) =>
    (["asWritten", "metric", "us"] as const).map((units) => adjustedText(adjustIngredient(line, 2, units)));
  assert.deepEqual(atDouble("200ml/7fl oz chicken stock"), ["400ml/14fl oz chicken stock", "400ml chicken stock", "1⅔ cups chicken stock"]);
  assert.deepEqual(atDouble("400ml/14fl oz coconut milk"), ["800ml/28fl oz coconut milk", "800ml coconut milk", "3⅓ cups coconut milk"]);
  assert.deepEqual(atDouble("150g/5½oz mangetout, finely sliced"), [
    "300g/11oz mangetout, finely sliced",
    "300g mangetout, finely sliced",
    "11oz mangetout, finely sliced",
  ]);
  assert.deepEqual(atDouble("500g/1lb 2oz jasmine or basmati rice"), [
    "1000g/2¼lb jasmine or basmati rice",
    "1000g jasmine or basmati rice",
    "2¼lb jasmine or basmati rice",
  ]);
  assert.deepEqual(atDouble("150–200g/5½–7oz tinned black-eyed beans"), [
    "300–400g/11–14oz tinned black-eyed beans",
    "300–400g tinned black-eyed beans",
    "11–14oz tinned black-eyed beans",
  ]);
  assert.deepEqual(atDouble("50g–100g/1¾oz–3½oz peanuts"), ["100–200g/3½–7oz peanuts", "100–200g peanuts", "3½–7oz peanuts"]);
  assert.deepEqual(changed(adjustIngredient("200ml/7fl oz chicken stock", 2, "asWritten")), ["400ml/14fl oz"]);
});

test("US keeps the page's own half where it is already in US units, and converts British fl oz and big ounces", () => {
  const inUs = (line: string, factor: number) => adjustedText(adjustIngredient(line, factor, "us"));
  assert.equal(inUs("400g/14oz beef mince", 1), "14oz beef mince");
  assert.equal(inUs("400g/14oz beef mince", 2), "1¾ lb beef mince");
  assert.equal(inUs("200ml/7fl oz chicken stock", 1), "⅔ cup + 3 tbsp chicken stock");
  assert.equal(inUs("3 tbsp/45ml olive oil", 2), "6 tbsp olive oil");
});

test("in Metric a line in both systems drops the other half even unscaled", () => {
  assert.equal(adjustedText(adjustIngredient("200ml/7fl oz chicken stock", 1, "metric")), "200ml chicken stock");
  assert.equal(adjustedText(adjustIngredient("3 tbsp/45ml olive oil", 1, "metric")), "45ml olive oil");
});

test("a weight the author also gives as a volume scales both halves, and never converts between them", () => {
  const butter = "60g / 1/4 cup unsalted butter (, cut into 1.5cm / 1/2” cubes)";
  assert.equal(adjustedText(adjustIngredient(butter, 2, "asWritten")), "120g / ½ cup unsalted butter (, cut into 1.5cm / 1/2” cubes)");
  assert.equal(adjustedText(adjustIngredient(butter, 2, "metric")), "120g unsalted butter (, cut into 1.5cm / 1/2” cubes)");
  assert.equal(adjustedText(adjustIngredient(butter, 2, "us")), "½ cup unsalted butter (, cut into 1.5cm / 1/2” cubes)");
  assert.equal(adjustedText(adjustIngredient("200g/7fl oz yoghurt", 3, "us")), "21fl oz yoghurt");
  assert.equal(adjustedText(adjustIngredient("15g/1 tbsp butter", 2, "us")), "2 tbsp butter");
});

test("a slash that isn't one amount in both systems keeps the line as written", () => {
  assert.equal(adjustIngredient("2cm/¾in fresh root ginger", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("200g/250g butter", 2, "asWritten").kind, "unreadable");
  assert.equal(adjustIngredient("200ml/7fl oz stock, plus 2 tbsp", 2, "asWritten").kind, "unreadable");
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
