import { JSDOM } from "jsdom";

const paragraph = (seed: string) =>
  `${seed} The council met for three hours on Tuesday evening, and most of that time went on the question of who would pay for the repairs, which nobody on either side had expected to take so long to settle.`;

export const paragraphs = (count: number, seed = "The bridge has been closed since March.") =>
  Array.from({ length: count }, (_, index) => `<p>${paragraph(`${seed} Point ${index + 1}.`)}</p>`).join("\n");

export const pageFrom = (html: string, url = "https://news.example.com/2026/11/bridge-repairs?utm_source=mail") =>
  new JSDOM(html, { url }).window.document;

export const NEWS_PAGE = `<!doctype html><html lang="en-GB"><head>
<title>Bridge repairs will cost the town twice what it planned | Example News</title>
<link rel="canonical" href="https://news.example.com/2026/11/bridge-repairs">
<meta property="og:site_name" content="Example News">
<meta property="og:image" content="/images/bridge.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Example"},
{"@type":"NewsArticle","headline":"Bridge repairs","datePublished":"2026-11-01T09:30:00+00:00",
"author":[{"@type":"Person","name":"Asha Rao"},{"@type":"Person","name":"Tom Lee"}],"publisher":{"@type":"Organization","name":"Example Group"}}]}</script>
</head><body><nav><a href="/">Home</a><a href="/news">News</a></nav>
<main><article><h1>Bridge repairs will cost the town twice what it planned</h1>
${paragraphs(4)}
<h2 id="who-pays">Who pays</h2>${paragraphs(4, "The county offered half.")}
<h2><span id="what-next">What happens next</span></h2>${paragraphs(4, "Work starts in spring.")}
</article></main><footer>All rights reserved. Sign up to our newsletter.</footer></body></html>`;

export const BLOG_PAGE = `<!doctype html><html><head><title>What I learned from a year of cold showers</title>
<meta name="author" content="Sam Field"><meta property="article:published_time" content="2026-08-14T07:00:00Z">
</head><body><div class="post"><h1>What I learned from a year of cold showers</h1>
${paragraphs(10, "I started in January.")}</div></body></html>`;

export const PAYWALLED_PAGE = `<!doctype html><html><head><title>The bond market's quiet panic</title>
<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":"False","headline":"The bond market's quiet panic"}</script>
</head><body><article><h1>The bond market's quiet panic</h1>${paragraphs(2)}<p>Subscribe to keep reading.</p></article></body></html>`;

export const UNLOCKED_PAGE = PAYWALLED_PAGE.replace("<p>Subscribe to keep reading.</p>", paragraphs(30));

export const NO_ARTICLE_PAGE = `<!doctype html><html><head><title>Example Shop</title></head><body>
<nav><a href="/a">Shoes</a><a href="/b">Hats</a></nav>
<ul><li><a href="/1">Red shoes £40</a></li><li><a href="/2">Blue hat £15</a></li></ul>
<form><input name="q"><button>Search</button></form></body></html>`;

const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => `Thought ${index + 1} on why the work that matters tends to look like a toy at first, and only later like the obvious thing to have done.<br><br>`).join("\n");

export const LINE_BROKEN_ESSAY = `<!doctype html><html><head><title>How to do great work</title></head><body>
<table><tr><td><font size="2" face="verdana">${lines(40)}</font></td></tr></table></body></html>`;

export const FRONT_PAGE = `<!doctype html><html><head><title>Example News: the latest</title></head><body><main>
${Array.from({ length: 80 }, (_, index) => `<div>Story ${index} about something that happened today and was reported at some length</div>`).join("\n")}
</main></body></html>`;

const RECIPE_JSON = {
  "@type": "Recipe",
  name: "Weeknight dal",
  prepTime: "PT10M",
  cookTime: "PT1H5M",
  totalTime: "PT1H15M",
  recipeYield: ["4", "4 servings"],
  recipeIngredient: ["250g red lentils", "1 tsp cumin seeds &amp; a pinch of salt", "  2 <b>large</b> onions "],
  recipeInstructions: [
    { "@type": "HowToSection", name: "For the dal", itemListElement: [{ "@type": "HowToStep", text: "Rinse the lentils.", name: "Rinse" }, { "@type": "HowToStep", text: "Simmer until soft." }] },
    { "@type": "HowToSection", name: "For the tarka", itemListElement: [{ "@type": "HowToStep", text: "Fry the cumin in butter." }, { "@type": "HowToTip", text: "Use ghee if you have it." }] },
  ],
};

export const recipePage = (declared: unknown, body = paragraphs(6, "My grandmother made this every winter.")) =>
  `<!doctype html><html><head><title>Weeknight dal | Example Kitchen</title>
<script type="application/ld+json">${JSON.stringify(declared)}</script>
</head><body><article><h1>Weeknight dal</h1>${body}</article></body></html>`;

export const RECIPE_PAGE = recipePage({ "@graph": [{ "@type": "WebSite", name: "Example Kitchen" }, { "@type": "BlogPosting", headline: "Weeknight dal" }, RECIPE_JSON] });

export const recipeWith = (fields: Record<string, unknown>) => ({ ...RECIPE_JSON, ...fields });

export const FOOD_ARTICLE_PAGE = recipePage({ "@type": "NewsArticle", headline: "Why lentils are having a moment" });

export const markupRecipePage = (recipe: string, declared?: unknown) =>
  `<!doctype html><html><head><title>Bean &amp; halloumi stew - Good Food Middle East</title>
<meta property="og:type" content="article">
${declared === undefined ? "" : `<script type="application/ld+json">${JSON.stringify(declared)}</script>`}
</head><body><div class="menu"><div class="col"><h4><a href="/categories/ingredients">Ingredients</a></h4>
<a href="/fruit">Fruit</a><a href="/vegetables">Vegetables</a><a href="/meat">Meat</a></div></div>
<div class="entry"><h1>Bean &amp; halloumi stew</h1><p>Use a can of mixed beans to make this tomato-based veggie stew with halloumi.</p>
${recipe}</div>
<div class="widget"><h3>Restaurant Reviews</h3><ul><li><a href="/r/1">Review: brunch at Above Eleven</a></li><li><a href="/r/2">Review: Hanu Dubai</a></li></ul></div>
<footer><h3>Method</h3><ol><li>Sign up to our newsletter for the best recipes every week.</li></ol></footer></body></html>`;

export const MARKUP_INGREDIENTS = `<div class="ingredient-list"><h3 class="bubble">Ingredients</h3><ul>
<li>3 tbsp olive oil</li><li>1 onion, thinly sliced</li><li>400g can mixed beans,  drained</li><li>½ x 250g block halloumi, sliced</li><li>garlic bread, to serve (optional)</li></ul>
<div class="cooking-tip"><h4>Tip</h4><p>Swap the halloumi for fried aubergine slices.</p></div></div>`;

export const MARKUP_METHOD = `<div class="method-list"><h3 class="bubble">Method</h3><ol>
<li><p>Heat 2 tbsp of oil in a frying pan and fry the onion for 10 mins.</p></li>
<li><p>Fry the halloumi for 2 mins on each side until golden.&nbsp;</p></li></ol></div>`;

export const MARKUP_RECIPE_PAGE = markupRecipePage(MARKUP_INGREDIENTS + MARKUP_METHOD);
