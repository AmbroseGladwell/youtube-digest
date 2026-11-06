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
| Narrating the whole recipe | `overviewNoteLines`, `useRecipeVoice` |
| A step's actions | `recipeActions.ts` |
| Cooking step by step | `useCookingMode`, `CookingMode`, `CookingStepsSheet`, `CookingIngredientsSheet`, `cookingPlaceStorage.ts` |
| Oven temperatures in US units | `usOvenTemperatures.ts`, `OvenText` |
| Units said in full | `spokenMeasures.ts` |

## Web pages first, shaped for video too

OV-122 (recipe videos) was planned first. The owner reversed that: web pages give clean structured
data, so they set the shape, and OV-122 adopts it. `Recipe` says nothing about where it came from,
and steps are objects, so a video can add a link to its moment (design 144i) without changing what
a step is.

## Code reads the recipe, never a model

The ingredients, steps, times and yield come from the page's schema.org `Recipe` JSON-LD
(`docs/prototype/constraints.md`), and code copies them onto the note. A page that declares no
`Recipe` at all is read from its markup instead ("Read from the page itself", below).

- **An ingredient is one string, as the page wrote it.** It is stored that way, and parsed only on
  screen when the reader adjusts it.
- **Times are read from ISO 8601 only** in structured data. "10 minutes" there is left empty, and
  zero counts as not stated. A recipe read from markup reads labelled text instead (below). A total
  the page didn't give is never worked out from the other two, on the note or in the library: the
  time row says "As the recipe gives them", and prep plus cook leaves out marinating, proving and
  resting.
- **Yield** prefers the form with words: `["4", "4 servings"]` gives "4 servings".
- **The method** arrives as a string, a list of strings, HTML, `HowToStep`s or `HowToSection`s. A
  section's name becomes the step's `group`. `HowToTip`s are left out, because they aren't steps.

## What counts as a recipe page

Both ingredients and a method have to be there, declared or laid out under their headings. Anything
else reads as an article, and nothing is said about recipes, because anything we said would be a
guess (design 144v):

| The page | What happens |
|---|---|
| No `Recipe` in its structured data | Read from the page itself, below; an article if that finds none |
| A `Recipe` in its structured data | Taken at its word: its markup is never read, whatever the rows below decide |
| A `Recipe` with no method, as some subscription sites publish | An article |
| Several different recipes, a round-up | An article |
| The same recipe declared twice, as when two plugins both do it | One recipe |
| A `Recipe` marked `isAccessibleForFree: false` | An article: the data may hold what the page withholds |

A recipe page skips the word-count floor, because a recipe with one line of introduction is a
complete page. With no prose at all, the steps stand in as the article's text, so `sections` and
`wordCount` stay valid.

## Read from the page itself

Smaller sites often publish no structured data (OV-173). Good Food Middle East's recipes are an
"Ingredients" heading over a list and a "Method" heading over a numbered list, with nothing
declared, and read as `nothing-readable` before this. `markupRecipe.ts` reads that layout, still in
code and never by a model:

- **The headings it knows** are English: "Ingredients", "What you need", "You will need" for the
  ingredients; "Method", "Instructions", "Directions", "Steps", "Preparation", "How to make it"
  for the method. A page in another language reads as an article.
- **A section runs** from its heading to the next heading as important, or the other part's
  heading, and never past the heading's own container: the nearest ancestor holding more than the
  heading. That keeps the sidebar's "Restaurant Reviews" out of a method above it.
- **Ingredients are list items.** The method is list items, or its paragraphs when it has no list.
  A smaller heading inside the method becomes the steps' `group`, unless it only numbers them
  ("Step 2").
- **Not the page's furniture.** A heading that is all link is navigation: Good Food Middle East's
  menu has an "Ingredients" link over Fruit, Vegetables and Meat. Nothing in `nav`, `footer`,
  `aside`, a form, something hidden, or comments is read.
- **It has to look like a recipe.** At least half the ingredient lines carry a quantity (a number,
  a fraction, or a word like "pinch", "tbsp", "to taste"), and at least half the steps are four
  words or more. Ingredients come before the method.
- **One recipe**, as with structured data: two different ingredient lists or methods are a round-up,
  and the same one shown twice, as a page with a mobile and a desktop layout does, is one.
- **Times and yield are read where the page labels them** (OV-180), ahead of the method, since
  labels after it belong to related recipes. A label is "Prep", "Prepare", "Preparation", "Cook",
  "Cooking" (each with an optional "time"), "Total", "Total time" or "Ready in", on the same line
  as a plain duration ("Prep: 5 mins", "1 hr 15 mins") or alone on the line before it. Yield is a
  line starting "Serves", "Makes", "Yield", "Servings" or "Portions" with a number in it, kept as
  written ("Serves 4–6"). A range ("30 mins to 1 hour"), a time in words, a zero, or one label given
  two different values stays empty. Unlabelled durations, like the bare `PT5M`s Good Food Middle
  East leaves in its markup, are never read: nothing says which is which.

A page that declares a `Recipe` is never read this way, even one left out above for being hidden
or missing its method: the publisher said what the recipe is.

## The note

No verdict and no Make it? judgement (owner, 2026-11-03). One Summary paragraph replaces Premise,
Core claim, Key points and the verdict: what the dish is in the author's framing, quoted where the
page has a line worth keeping, with what makes it work kept in the prose. The prompt forbids
repeating a step, an amount, a time or a temperature, and working out a figure, since the recipe sits
right below. A thin page gets only what it says, quoted, and the note is never marked `thin`: that
flag means "no clear claim", which has no sense for a recipe, so the prompt no longer asks for it and
the record carries `false` (OV-179, https://trello.com/c/GQNQ5RQr; recipes written before it may
still carry `true`, which nothing reads for a recipe). The model also writes the library's one line,
topics and tags.

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
  Where a video's row carries its verdict chip, a recipe's carries "Recipe · 4 servings", or
  "Recipe" when the page gives no yield, and never "Thin · no clear claim" (OV-179, decided
  without a design; the yield is the one figure the row didn't already give). Recipes are their own
  kind in the source filter.
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
  adjusted. Its oven temperatures are the one thing US units change (OV-150, see "Oven
  temperatures in US units").

Copy and Print take the lines as shown, with a line saying what they were adjusted from.

## Copy and print

⋯ gains Copy recipe and Print recipe (144r, 144s). Both give the page's recipe only: title, where it
came from with the link, the time row, the ingredients and the method. Never the summary, which is
ours. Copy is plain text with "-" and numbers so it pastes cleanly anywhere. Print is one sheet in
two columns, black on white whatever the theme, rendered only while the print dialog is open. Since
OV-148 it opens with the page's own image where there is one (the dialog waits for it to load, and a
dead link is left out) and closes with "Made with The Overview" beside the mark.

## Reading aloud

Changed by the owner on 2026-11-03 (OV-148, https://trello.com/c/WEIryD5R). A recipe's narration is
the whole recipe: the Summary, then the ingredients, then the method. So pressing Listen makes one
render that has every section ready, and plays straight through. The ingredients are read as shown,
so an adjusted amount is what is heard, and adjusting servings or units makes a fresh render.

- **Headings are counted, as key points are.** "There are 8 ingredients" and "The method, in 6
  steps", counted in code.
- **The method is read one action to a line** (OV-150, see "A step's actions" below). A step's
  first action says its number, and its label where it has one: "Step 3. Cook beef. Turn the heat
  up to high.", in `spoken`, so the screen keeps the page's words. Its other actions are read
  plainly.
- **Read aloud plays one list from the same audio.** It seeks to the list's first line and
  stops at the end of the last, so it never needs a render of its own. Listen, or the bar's play
  button, lifts that stop and plays on.
- **A stop lands exactly at a line's end.** The engine is told the line to stop after
  (`stopAfterLine`) and pauses 40ms before the next line starts, on a timer set from the audio's
  own clock and set again on every play, seek, rate change and time update. A stop the voice has
  already passed (the pacer moves in 250ms steps) is pulled back inside the line. Pausing once the
  next line showed as active, as Read aloud first did, let up to a quarter of a second of it through:
  the "the" of a following "then" in cooking step by step.
- **The highlight follows the voice into the lists.** The note shows only the Summary's lines;
  the ingredients card tints the line being read, and the method tints the sentence being read
  inside its step, wrapping with the text, rather than the step as a block (design 150ac). Both
  keep it on screen. The bar counts steps, not actions: "Now reading · Method · step 3 of 6".

- **The Summary heading is said "The summary"** (OV-149). "In short" sounded odd before the
  summary was the only thing read; now it opens a whole recipe.
- **Tapping an ingredient or a step moves the voice there**, as tapping a line of the note does
  (OV-149, https://trello.com/c/4CCEWv18): while playing it plays on from there, and while
  paused it moves the reading mark, so play starts from it. Enter and Space do the same. A tap
  inside the list that Read aloud is playing keeps its stop; a tap anywhere else lifts it.
- **Units are said in full, and only said** (OV-149). `spokenMeasures` rewrites a line's
  `spoken`, never its `text`, so the screen, Copy and Print keep the page's words. A unit is
  expanded only straight after an amount, so "g" in "garlic" is safe: "1 tsp" is "1 teaspoon",
  "½ tsp" "half a teaspoon", "1½ tbsp" "1 and a half tablespoons", "2-3 tbsp" "2 to 3
  tablespoons". A size that describes a thing stays singular: "400g tins" is "400 gram tins",
  "2cm pieces" "2 centimetre pieces", while "3mm thick" stays plural. Oven lines read
  "200 degrees Celsius, or 180 degrees Celsius fan, or gas mark 6", and "mins" and "hrs" are
  said in full. A conversion in brackets is dropped, as `speakable` already drops brackets, and
  one after a slash is read "or". The words change, so each recipe's audio re-renders the next
  time it is played (`tts-pre-rendered-speech.md`).

A copy shared before OV-159 carries no method, so on its page the voice has nothing to follow after the ingredients.

## A step's actions

A page's step is often several things to do ("Heat the oil. Add the onions and cook for 10 minutes.
Stir in the garlic."), so the method is split into actions, in code and never by a model
(`docs/prototype/constraints.md`). Trello OV-150, designs 150a–150au in Claude Design (OV-150 1–10).
The rules were set by a test on 115 steps from 11 real recipe pages, on 3 Nov 2026:

- **At a sentence's end**, where the next sentence starts with a capital or a digit. "approx.",
  "e.g.", "i.e." and "vs." don't end one; a temperature ("200C.") does.
- **At ", then" and a verb**, which the owner chose to read as "…then drain the pasta." on its own
  screen, with the comma dropped (3 Nov 2026). Not when "then" is followed by a thing ("then the
  chips"), a word ending -ing or -ly ("then gradually beat in"), or when the sentence starts "If",
  so "If you're using a bread machine, …, then skip to step 7" keeps its condition.
- **Never** at "then" without a comma (that is nearly always a list of ingredients: "tofu, noodles
  then Sauce"), at a semicolon (an action and its reason), at a dash (an aside or a range) or at a
  colon.
- **A sentence that is only an aside in brackets** stays with the action before it, since narration
  drops brackets and it would be a silent screen.
- **A label is lifted**: one to four words before " - " and a capital, or before ":", at the very
  start of a step ("Cook beef - Turn the heat…", "To make pizza later: …"). Each of the step's
  actions carries it, and the voice says it once, after the number. Words before a dash that run on
  in lower case are the sentence, not a label.
- **A condition is marked**: an action that starts "If " carries its words up to the first comma, to
  set in bold (150at).

Every action keeps its step and its place in the page's text, so "step 3" still means one thing and
the method can tint a sentence in place. Checks and explanations ("The sauce should be thick…")
come out as actions too, since code can't tell them apart (150p).

## Cooking step by step

Trello OV-150, designs 150a–150au (OV-150 1–10 in Claude Design), with the owner's choices of
3 Nov 2026. One action on screen, read once, and then the voice waits for the reader.

- **Getting in (150a, 150b).** "Cook step by step" on the Method heading, full width under it on a
  phone, starts at step 1. "Cook from here" in the bar, whenever the voice is in the method, starts
  at the action it is on, so tapping a step and then Cook from here starts there. Not in ⋯. On a
  shared copy too since OV-159, unless it was shared before the method travelled with it.
  Since OV-172 (owner, 4 Nov 2026) it is also a centred button above the summary, so it is in
  sight when the note opens; it reads "Carry on from step N" while a place is kept, and its starts
  are counted as `from: "summary"`.
- **The screen (150c–150h).** The group, "Step 4 · 2 of 2" ("Step 7" for a one-action step), the
  action large in Figtree 400 sized by its length (34px to 23px on a phone, 30 to 20 in the panel,
  52 to 32 on the web, in rem), and the next action muted under it: "Then", or "Then step 5" when
  it starts a new step. In the panel the preview drops for an action over 30 words. Next is the
  biggest thing on the screen; Back and Say it again sit above it. Next becomes Finish on the last
  action.
- **The voice (150i, 150j).** It reads the action's own line of the recipe's narration and stops,
  using the same stop as Read aloud, so the mode needs no render of its own. One line says what it
  is doing: Reading step 4, Waiting for you, the voice on its way while the audio renders (the reader
  can go on and it joins them where they are), text only (said once, on the first screen, when
  there is no narration), or stopped, in the warning ink with Try again. Say it again goes when there
  is nothing to repeat. No auto-advance.
- **Swiping (OV-158, owner 4 Nov 2026).** Swipe up for Next and down for Back, on the action
  area, not the controls. The next action rises from where it was previewed and the last one comes
  back down from above, and Next by button, key or headphones moves the same way, so the motion
  means one thing. The action follows the finger while dragging; a drag under 56px, or one that is
  mostly sideways, springs back. Up and down rather than left and right because the next action is
  already shown beneath. Under reduced motion it simply changes. The action moves inside a frame
  that clips at its edges and fades over its own padding, so text on its way up dissolves before
  the progress dots and never shows under the top bar (OV-160).
- **Progress and jumping (150k–150m).** A dot per step up to 20 steps, a 3px line by action past
  that. The step being cooked fills a little with each of its actions and is full on its last, so
  moving through a step shows (OV-162, owner 4 Nov 2026). The count opens the steps, each by its first action; choosing one reads it.
- **Ingredients (150ah–150aj, OV-190 190a–190k).** In the top bar on every screen, opening the
  note's list as it is shown, adjusted amounts and their line included. On a phone and in the panel
  it is a modal sheet. On the web it is a second column on the right, 24rem wide, and the step
  narrows to make room rather than going under it: nothing dims, no key stops working, and it stays
  open across Next and Back, because a reader who opened it is reading ahead (owner's question,
  answered in 190k). It opens in 280ms and shuts in 200ms on the app's ease, the list sitting at
  its left edge and uncovered as it widens; under reduced motion it just appears. Focus moves into
  it on open and back to the Ingredients button on close; it is a plain `aside`, so Tab runs on
  through it and Esc shuts it before it leaves the mode. The cooking screen is the window's
  height, so a list longer than it scrolls inside the drawer and the step and its controls never
  move; the `aside` itself is the scroller, being what focus lands on, so the keys read the rest
  of the list (OV-200). The cooking column is measured, not the window: under 720px the action
  takes a scale one step down (44 to 28px), the controls stack as on a phone, the title in the bar
  hides and an action over 30 words drops its "Then" preview as the panel does; under 480px it
  takes the phone's sizes. Between 768 and 943px the drawer is 20rem and the side margins 2rem, so
  the step keeps a phone's width beside a full list (190l–190o). The size changes once each way,
  at the start of opening and the end of closing, never mid-slide (190i). The voice carries on.
  While servings or units are adjusted, every action carries "Amounts as written, for 4 servings".
- **Labels, conditions and checks (150p–150au).** See "A step's actions". A label is a small
  heading over each of its step's actions; a condition is in Bold 700 in the label colour, the
  action at 400. Checks read as actions.
- **The end (150n, 150o).** "That's the method." with Back to the recipe, Last step and Start again.
  Nothing about serving. Finish forgets the place and lets the screen sleep.
- **Screen and hands-free (150t–150v).** "Screen stays on while you cook" only while the browser
  holds a wake lock. While the mode is open the media session's track buttons are Next and Back, and
  play/pause is Next while the voice waits and pause or resume while it reads (owner). A dismissible
  line says so on the first two entries where there is a voice. Keys: Space or → Next, ← Back,
  R Say it again, I Ingredients, Esc Done, shown on the web's buttons.
- **Leaving (150w).** Done or Esc, no confirm. The place is kept on this device for 24 hours (owner)
  and cleared by Finish; the method says "You stopped at step 8 of 16.", tints that step, and offers
  "Carry on from step 8" and "Start from step 1".
- **Analytics.** `reader.cooking.started` with where from and the step, and `reader.cooking.left`
  with Done or Finish, the actions reached, and whether the last step was.

## Oven temperatures in US units

Decided by the owner on 3 Nov 2026 (150ak), closing 144x's question. US units turn the method's
Celsius into Fahrenheit, fan figures included, on the note, in cooking step by step and in what is
read aloud, marked on the stone tint like a changed amount. Oven figures land on a dial's 25° marks,
as the usual tables do (180°C is 350°F, 220°C is 425°F); anything under 120°C converts exactly.
Gas marks, Fahrenheit and the method's amounts stay as written, and the method's note says
"…with oven temperatures in °F". Copy and Print still give the method as the page wrote it.

## Sharing

Decided by the owner on 4 Nov 2026 (OV-159, https://trello.com/c/qDVVDm4z): a shared copy is the
whole recipe, method included, so the person it was sent to can read it, hear it and cook from it
step by step. That reverses the first build, which took design 144u's recommendation and left the
method on the page because it is in the author's own words. "Open the recipe on {site}" stays at
the top of the shared page, so the site is still one tap away.

- **The shared page is the reader's recipe, read-only.** The method with Read aloud, Cook step by
  step and Cook from here in the bar, through the same `useRecipeVoice` and `useCookingMode`.
  Servings and units are not adjustable there, so cooking shows the amounts as written. Its
  analytics are `sharedPage.cooking.*`, and the kept place is on the visitor's device.
- **The narration is the sharer's,** as for any share (`sharing.md`): the as-written render, which
  has always read the method, so the voice now has lines on the page to follow all the way through.
- **Copies shared before OV-159 have no method.** `RecipeNote` still lets `steps` be empty with
  `stepCount` kept, and such a copy still says "Method · 6 steps" beside "See the method on
  {site}", with nothing to cook. The sharer sees "Edited since sharing" on it, because the hash of
  what they would share now includes the method, and Replace updates the copy behind the same
  link. A copy saved from one of those keeps no method either.

Like `article`, `recipe` is absent rather than null on anything else, so a share's hash doesn't
move.

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
- The voice saying "That's the method." at the end of cooking step by step (150o): every spoken
  word comes from a line of the narration, and the method has no such line.
- Oven temperatures converted in Copy and Print.
- Copy and Print from a shared page.

## Testing

`pageRecipe.test.ts` runs handwritten pages, for the same reason as `readArticle.test.ts`: others'
text stays out of the repo. `recipeNote.test.ts` and `adjustIngredient.test.ts` cover the record and
the arithmetic, `recipeActions.test.ts` the splitting on steps taken from real pages,
`usOvenTemperatures.test.ts` the conversion, `cookingPlaceStorage.test.ts` the kept place, and
`cookingMode.iwft.ts` the mode, `generateRecipeOverview.test.ts` the prompt and routing with a simulated model, and
`recipes.iwft.ts` with the shared page scenario cover the screens. Nothing has been run against real
recipe sites or a real model yet.
