# Recipe notes

A recipe web page gets a note built around the page's own recipe instead of an argument-shaped
note. Trello OV-144, decided 2026-11-03. The designs are 144a–144ab in Claude Design (OV-144 1–3).

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The recipe's shape | `Recipe`, `RecipeStep` in `packages/domain` |
| Reading it from a page | `packages/articles/src/pageRecipe.ts`, `linkedData.ts` |
| Carrying it to generation | `ExtractedArticle.recipe` |
| The note | `RecipeNote`, `Overview.recipe`, schema version 12 |
| Writing the summary | `packages/generation/src/recipe/` |
| Times, step groups, copy text | `recipeFacts.ts`, `recipeText.ts` |
| Servings and units | `adjustIngredient.ts`, `app-core/.../reader/util/recipeAdjustment.ts` |
| The screens | `RecipeTimes`, `RecipeIngredients`, `RecipeMethod`, `RecipePageLink`, `RecipePrintSheet` |
| Each list read aloud | `useRecipeVoice`, `PlayerTrack.part` |

## Web pages first, shaped for video too

OV-122 (recipe videos) was planned first. The owner reversed that: web pages give clean structured
data, so they set the shape, and OV-122 adopts it. `Recipe` says nothing about where it came from,
and steps are objects, so a video can add a link to its moment (design 144i) without changing what
a step is.

## Code reads the recipe, never a model

The ingredients, steps, times and yield come from the page's schema.org `Recipe` JSON-LD
(`docs/prototype/constraints.md`), and code copies them onto the note.

- **An ingredient is one string, as the page wrote it.** It is stored that way, and parsed only on
  screen when the reader adjusts it.
- **Times are read from ISO 8601 only.** "10 minutes" is left empty, and zero counts as not stated.
  A total the page didn't give is never worked out from the other two, on the note or in the
  library.
- **Yield** prefers the form with words: `["4", "4 servings"]` gives "4 servings".
- **The method** arrives as a string, a list of strings, HTML, `HowToStep`s or `HowToSection`s. A
  section's name becomes the step's `group`. `HowToTip`s are left out, because they aren't steps.

## What counts as a recipe page

Both ingredients and a method have to be declared. Anything else reads as an article, and nothing
is said about recipes, because anything we said would be a guess (design 144v):

| The page | What happens |
|---|---|
| No `Recipe` in its structured data | An article, with no attempt at a recipe from the text |
| A `Recipe` with no method, as some subscription sites publish | An article |
| Several different recipes, a round-up | An article |
| The same recipe declared twice, as when two plugins both do it | One recipe |
| A `Recipe` marked `isAccessibleForFree: false` | An article: the data may hold what the page withholds |

A recipe page skips the word-count floor, because a recipe with one line of introduction is a
complete page. With no prose at all, the steps stand in as the article's text, so `sections` and
`wordCount` stay valid.

## The note

No verdict and no Make it? judgement (owner, 2026-11-03). One Summary paragraph replaces Premise,
Core claim, Key points and the verdict: what the dish is in the author's framing, quoted where the
page has a line worth keeping, with what makes it work kept in the prose. The prompt forbids
repeating a step, an amount, a time or a temperature, and working out a figure, since the recipe sits
right below. A thin page gets only what it says, quoted. The model also writes the library's one
line, topics and tags.

So an `Overview` with a `recipe` has empty `keyPoints` and `coreClaim`, and no verdict, article,
chapters or Read it anyway. The schema checks that, and still asks every other note for three key
points. `CoreFields` keeps its minimum, because it is also the model's schema for videos and articles.

## On screen

- **One column, no tabs (144a).** Masthead ("{Site} · Recipe", by, published, saved), the time row,
  the Summary ending in "See the full recipe on {site} · N min read", then Ingredients on a raised
  card (two columns on the wide web), then Method. Nothing follows the method.
- **The time row (144f)** is Prep, Cook, Total and Makes, only what the page gives, captioned
  "As the recipe gives them on {site}."
- **The method (144g)** is numbered straight through the page's groups, so "step 9" means one thing.
  Nothing collapses behind Show more: a hidden ingredient is a missed one.
- **In the panel (144l)** the link moves the recipe page beside it to its top, as articles do.
- **The library (144m)** names a recipe by its stated total, "1 hr 5 min recipe", or just "Recipe".
  Recipes are their own kind in the source filter.
- **Creating (144o–144q)** says "Reading the recipe" or "Fetching the recipe" with its counts once
  the page has been read, and "Recipe on {site}" under a pasted link. The panel names the kind only
  after Create, not on the card before it as 144o draws: we promise not to read a page until then.

## Servings and units

Designs 144y–144ab, the owner's request on 2026-11-03, reversing the card's "left out". A stepper
for the page's yield, or ½× 1× 2× 3× where it has no number, and As written / Metric / US. As written
is where every note opens. The units are remembered on the device for every recipe; servings start
again on each.

It is arithmetic on an amount we can read at the start of a line (or after "Juice of"), never a
guess:

- A changed amount sits on the stone tint, and only the amount and its unit.
- A line with no amount, or with two ("1 tbsp sugar & 1 tsp salt"), stays exactly as written, says
  so, and is counted in the status line, which offers the way back.
- Units move within their kind only: weight to weight, volume to volume. Grams of flour never become
  cups, which would need a density we'd be guessing. Spoons stay spoons in both systems.
- A tin's size stays as sold ("4 × 400g tins"), and says so. A line that starts with a pack size
  ("400g tin of tomatoes") is left as written, since scaling it would mean buying a tin that isn't
  sold.
- One becoming several takes the plural of its noun: "1 small garlic clove" doubled is "2 small
  garlic cloves".
- The method keeps the author's words and amounts, and says so above step 1 once anything is
  adjusted. Oven temperatures are not converted for US units: that is still open for the owner,
  since it is the only change that would edit the author's text.

Copy and Print take the lines as shown, with a line saying what they were adjusted from.

## Copy and print

⋯ gains Copy recipe and Print recipe (144r, 144s). Both give the page's recipe only: title, where it
came from with the link, the time row, the ingredients and the method. Never the summary, which is
ours. Copy is plain text with "-" and numbers so it pastes cleanly anywhere. Print is one sheet in
two columns, black on white whatever the theme, rendered only while the print dialog is open.

## Reading aloud

Listen reads the Summary: it is the narration, for deciding. Each list has its own Read aloud, for
cooking (144t), which reads that list exactly as shown, line by line, in the reader's voice, and
tints the line it is on. Every spoken word is a line on screen. It plays through the app's one
player as a track of its own, marked by `PlayerTrack.part`, so the note's highlight doesn't follow it,
and the bar says "Now reading · Method · step 3 of 6". Audio is keyed by its words, as the note's is.

## Sharing

The owner hasn't settled this; the build takes the design's recommendation (144u). A shared copy
carries the summary, the times and the ingredients, and leaves the method on the page: an
ingredient list is generally free to copy, a method in the author's own words may not be, and
sending readers to it is fair to the site. `shareSnapshot` empties `steps` and keeps `stepCount`, so
the heading still says "Method · 6 steps" beside "See the method on {site}". A copy saved from a
share keeps no method either. Like `article`, `recipe` is absent rather than null on anything
else, so a share's hash doesn't move.

This is the one place a note keeps the page's text, which OV-77 decided against for articles: the
owner's own note carries the method, because the design puts it there.

## Time saved

Recipes aren't counted, the design's recommendation while the owner decides: reading time is the
wrong measure for something the reader means to cook. The time saved sheet lists them under Not
counted.

## Older devices

`ExtractedArticle.recipe` defaults to null, so an older device's request still parses, and a newer
device talking to an older server has the field stripped and gets an article note. `Overview.recipe`
is schema version 12, null for everything before it, and moves `CLIENT_VERSION` to 12, so older
clients are handled as for any record change (`record-migrations.md`).

## Not built

- OV-122's moment link under each step (144i).
- Converting oven temperatures in the method for US units (open).
- Copy and Print from a shared page.

## Testing

`pageRecipe.test.ts` runs handwritten pages, for the same reason as `readArticle.test.ts`: others'
text stays out of the repo. `recipeNote.test.ts` and `adjustIngredient.test.ts` cover the record and
the arithmetic, `generateRecipeOverview.test.ts` the prompt and routing with a simulated model, and
`recipes.iwft.ts` with the shared page scenario cover the screens. Nothing has been run against real
recipe sites or a real model yet.
