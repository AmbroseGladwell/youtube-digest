# Recipe notes

A recipe web page gets a note built around the page's own recipe instead of an argument-shaped
note. Trello OV-144, decided 2026-11-03. The designs are 144a–144ab in Claude Design (OV-144 1–3).
A recipe video gets the same note with the video's tabs (OV-122, "Recipe videos" below).

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
| Timers while cooking | `methodTimes.ts` and `TimerSound.ts` (domain), `useCookingTimers`, `cookingTimers.ts`, `timerSounds.ts`, `TimerSoundPicker`, `CookingTimerPills`, `CookingTimerStrip`, `CookingTimerBanner`, `CookingTimerSheet`, `CookingLeaveSheet` |
| Oven temperatures in US units | `usOvenTemperatures.ts`, `OvenText` |
| Units said in full | `spokenMeasures.ts` |
| A recipe video's recipe | `recipeSection.ts`, `videoRecipe.ts`, `statedAmounts.ts` in `packages/generation` |
| A video's whole description | `VideoSource.fullDescription`, `mapPlayerResponseToVideoSource` |
| A step's moment, the step playing, chapters' steps | `RecipeStep.range`, `LineRangeTag`, `usePlayingStep`, `chapterStepsLabel` |
| Watching a step while cooking | `CookingStepVideoSheet` |

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
  The row leads with the kind chip "Recipe · 4 servings", or "Recipe" when the page gives no
  yield, and never "Thin · no clear claim" (OV-179; moved from the verdict's pill into the kind
  chip by OV-232, design 232f; the yield is the one figure the row didn't already give). Recipes
  are their own kind in the source filter. See `library-view.md`, "What kind each row is".
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
  scales by how many packs instead (OV-231): "400g can chopped tomatoes" doubled is "2 × 400g cans
  chopped tomatoes", and halved is "½ × 400g can", read aloud as "half a 400 gram can". Changing
  units alone leaves it the same, since the size is what's sold.
- A pack size in brackets straight after the pack ("1 small tub (200g) crème fraîche") is the
  pack's size, not a second amount: the count scales and the bracket stays.
- One amount given in both systems ("200ml/7fl oz chicken stock", "500g/1lb 2oz rice") is not a
  second amount either (OV-241, owner 11–12 Nov 2026). As written scales both halves and keeps the
  slash ("400ml/14fl oz"), and Metric keeps the metric half, even at 1×. US keeps the page's other
  half where it is already the unit US would choose ("14oz") or a spoon, and otherwise converts the
  metric half like any metric line: British fl oz become cups ("1⅔ cups"), and ounces past a pound
  become pounds ("1¾ lb").
  Both halves must be the same kind, one of them metric. A length ("2cm/¾in") has no unit to read,
  so it stays as written.
- One becoming several takes the plural of its noun: "1 small garlic clove" doubled is "2 small
  garlic cloves". The noun is the last word before a comma or bracket, or before how it's
  prepared where there's no comma ("1 onion finely chopped" is "2 onions finely chopped", OV-242).
  A noun that can't be found stays singular rather than a word being guessed at.
- "1-1/2 cups", the US way of writing 1½, is one amount, not a range, on screen and aloud (OV-242).
  "Heaped" or "level" before a spoon leaves it a spoon.
- The method keeps the author's words, and its amounts follow the ingredients only where they
  repeat an ingredient line (OV-231, designs 231a–231m, owner 8 Nov 2026, reversing 144y–144ab):
  the same amount as written, followed by a word of that line's name. "Put 100g plain flour, 2
  large eggs" doubled is "Put 200g plain flour, 4 large eggs", marked as a changed ingredient
  amount is, and "1 onion" takes its plural as the line does. **A share stays as written**: "1
  tbsp of the oil" may be part of the batch and "about 3 tbsp of the batter" is per pancake, so
  doubling it would make bigger pancakes, and code can't tell the two apart. A share left alone is
  still cookable; a wrongly doubled one isn't. Times, sizes, counts of pieces and proportions
  never match. Above step 1: "Amounts the method repeats from the ingredients are adjusted for 16
  pancakes, and marked. Everything else is as the recipe gives it." Oven temperatures convert in
  US units (OV-150, see "Oven temperatures in US units"). In `methodAmounts.ts`.

Copy and Print take the lines and the method as shown, with a line saying what they were
adjusted from. On paper a changed amount is in bold, since ink may not carry the tint (231l).

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
so an adjusted amount is what is heard, and adjusting servings or units makes a fresh render. The
method's adjusted amounts (OV-231) are read as shown too, inside that same render, so they cost no
extra one.

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
  action. The page behind doesn't scroll while the mode is open (OV-287).
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
  While servings or units are adjusted, every action carries "Adjusted for 16 pancakes" (231f,
  replacing 150af's "Amounts as written"), with the method's adjusted amounts marked in the action;
  the Ingredients sheet says "Adjusted for 16 pancakes, and so is the method." (231j).
- **Labels, conditions and checks (150p–150au).** See "A step's actions". A label is a small
  heading over each of its step's actions; a condition is in Bold 700 in the label colour, the
  action at 400. Checks read as actions.
- **The end (150n, 150o).** "That's the method." with Back to the recipe, Last step and Start again.
  Nothing about serving. Finish forgets the place and lets the screen sleep.
- **Screen and hands-free (150t–150v).** "Screen stays on while you cook" only while the browser
  holds a wake lock. While the mode is open the media session's track buttons are Next and Back, and
  play/pause is Next while the voice waits and pause or resume while it reads (owner). A dismissible
  line says so on the first two entries where there is a voice. Keys: Space or → Next, ← Back,
  R Say it again, I Ingredients, M Mute, Esc Done, shown on the web's buttons.
- **Leaving (150w).** Done or Esc, no confirm unless a timer is running (see "Timers"). The place is kept on this device for 24 hours (owner)
  and cleared by Finish; the method says "You stopped at step 8 of 16.", tints that step, and offers
  "Carry on from step 8" and "Start from step 1".
- **Analytics.** `reader.cooking.started` with where from and the step, and `reader.cooking.left`
  with Done or Finish, the actions reached, and whether the last step was. Timers add
  `reader.cooking.timerStarted` (seconds, step, whether it was one end of a range) and
  `reader.cooking.timerEnded` (dismissed, cancelled or left, and whether it rang). Settings sends
  `settings.cooking.timerSoundChosen`, `timerSoundPlayed` and `timerSoundStopped`, each with the sound.
  Muting sends `reader.cooking.voiceMuted` (muted or not, by the button or M), and the Settings
  switch `settings.cooking.readStepsAloudChosen`.

### Muting the voice

Trello OV-289, designs 289a–289n (OV-289 in Claude Design), 12 Nov 2026. One synced setting,
`Settings.readStepsAloud`, on by default, read two ways round:

- **In the mode (289b–289g).** A 44px speaker in the top bar, between Ingredients and the step count,
  named "Mute voice" with `aria-pressed`. Pressed, it takes the stone tint and ring and the speaker is
  crossed out. The voice stops at once, mid-sentence if it was reading, and the voice line says "Voice
  muted. The steps are text only". Say it again goes, as with no narration, and R does nothing. The
  headphones' play/pause is Next. Muted, the mode only holds the narration at the action and never
  plays it, so no audio is asked for or paid for. Unmuting reads the current action from its start,
  except on the end screen or while a timer rings.
- **No narration.** A recipe with none has nothing to mute: no button, and the line stays "No
  narration on this recipe". The setting is kept for the next recipe.
- **Timers (289h).** They ring as before. Under the banner, the line keeps saying the voice is muted
  rather than "the voice waits".
- **Settings › Cooking (289i–289l).** A "Read steps aloud" switch above Timer sound, with one line on
  what off means. The Cooking row reads "Voice on · Ready" or "Voice off · Ready". Both the switch
  and the button save at once and sync, so muting on the phone opens the mode muted on the web.

### Timers

Trello OV-284, designs 284a–284ah (OV-284 1–3 in Claude Design), with the owner's choices of
12 Nov 2026. Prompted by Apple Home's cooking timers.

- **Reading the times.** `methodTimes` in the domain finds each time in an action's own text:
  digits, fractions, words up to twelve and a few tens, "half an hour", "1 hr 15", "1h15", "5 more
  minutes", and a range ("8–10", "1 to 1½ hours", "10 or 12", "45 minutes to 1 hour") as both ends.
  Code reads them, never the model (`docs/prototype/constraints.md`), so every recipe already saved
  has them. Left alone: "within", "every" and "each" before a time, vague ones ("a few minutes",
  "overnight") and anything over a day. Measured on the owner's 22 recipes on 12 Nov 2026: 83 times
  in 68 of 121 steps, no false hits, the only misses the vague ones.
- **The name (284g).** The nearest cooking verb before the time in its sentence, said as a command
  ("…and rest it for 5 minutes"), else that verb in any form, from a short list in `methodTimes.ts`;
  else the timer is "Step 2 timer". 4 of the 83 fell back.
- **Starting (284a–284f).** A "Start a timer" row under the action and above "Then", one pill per
  time; two times in an action are named by their verb ("Simmer · 10 min"), and a range is its two
  ends with "or" between, under "Start a timer, either end". The time in the action is dotted and
  underlined in orange, and tapping it does what its pill does (a range's words move focus to its
  first pill). The stone tint stays the mark for changed numbers. A started pill reads "15 min ·
  running" and opens its timer; the other end of a range still starts a second one.
- **Running (284g–284o).** A strip under the step dots on every screen of the mode, the end screen
  included, soonest first. One timer reads "Boil · step 2" with its time; two or more drop the step.
  The ring empties as it runs. Past three the strip scrolls sideways. A timer is an end time read
  from the clock, so a hidden or throttled tab shows the right time when it comes back, and a timer
  that ran out meanwhile rings at once, at the time it ran out.
- **A timer's sheet (284q, 284r).** Tapping a running timer opens Pause or Resume, −1 min and +1 min
  in a row, and Cancel timer in warning ink. Paused keeps what was left, not an end time, reads
  "· paused" with a muted ring, and still counts as running for leaving. −1 min past zero rings.
- **Ringing (284s–284w).** A banner in the strip's place on whatever step the reader is on, its
  edge pulsing (still and heavier under reduced motion): "Boil timer is done", the step, its length
  and how long ago, with Dismiss and +1 min, which runs it again. Two or more get a row each, oldest
  first. The reader's timer sound, made with Web Audio and unlocked by the tap that started the
  timer, repeats until dismissed with a vibration where there is one; the voice pauses ("Timer ringing · the voice
  waits") and carries on once nothing rings. Focus moves to Dismiss, so Space dismisses, and Next's
  Space label hides meanwhile. Once one is answered, focus goes to the next Dismiss, and with none
  left to the cooking screen itself, so Space and the arrows move on again without a click (OV-287). In the panel "Then" gives way to the banner. While a timer rings the
  headphones' play and pause dismiss it (owner's question; the design's recommendation); the track
  buttons stay Back and Next.
- **Leaving (284x–284ac, rewritten by OV-288 as 288a–288f).** With this recipe's timer running or
  ringing, Done, Esc and Back to the recipe ask whether to keep it: see "Outside the mode" below.
  Closing the tab or going back while one runs gets the browser's own prompt. Finish doesn't stop
  timers, since the last step is often the bake; it still forgets the place.
- **Where sound can't be counted on (284ad, 284ae).** While a timer runs the wake line changes
  rather than adding one: on iOS "Screen stays on. Keep it open to hear your timer", on the web
  "… Keep this tab in front to hear your timer", and with no wake lock "Keep this screen on to hear
  your timer". Elsewhere it is unchanged. Nothing claims a timer will ring when it might not.
- **The sound (284ai–284al).** Settings › Cooking, right after Narration voice, its row reading
  "Timer sound: Ready". Ten sounds, all made in `timerSounds.ts` with Web Audio so none needs a
  file, chosen by the owner on 12 Nov 2026 from a listening page that went past the design's four.
  **Ready** is the signature and the default: a rising marimba call with a glass sparkle, over a
  soft swell of low strings. Then Chime (two glass-like notes), Low tone, Rise, Marimba and Pulse
  (the three for a loud kitchen), Crystal, Music box, Vibraphone and Harp. Each layers tones in
  the ratios a real instrument makes, with soft attacks, a little room echo made in code and a
  gentle limiter, so they stay full on a phone speaker. The design's Bell and Beeps were dropped
  (owner: a nicer alarm instead of beeps). The rows are the voice picker's, each with a sample that
  plays once with a ring for its length, one at a time. Choosing saves at once as `timerSound` in
  the settings record, so it syncs. It isn't chosen in the mode itself: it's set once, and wet
  hands shouldn't be choosing sounds. A ringing timer repeats its sound with 1.5 s of quiet between
  rings (Ready about every 4.7 s), and however many ring at once, one sound plays. Every sound has
  the iOS limits above.
- **Keys (284af, 284ag).** T starts the action's one timer, or with two times or a range moves focus
  to the first pill, where Space or Enter starts the focused one. T is shown on the first pill.
- **Not done.** No spoken "your timer is done": the narration is pre-made audio, so it is the timer
  sound only (the design's recommendation). Timers live only in this tab: never kept with the place,
  never synced, gone on a reload (owner, OV-288).

#### Outside the mode

Trello OV-288, designs 288a–288ah (OV-288 1–3 in Claude Design), with the owner's choices of 12 Nov
2026. Timers carry on outside cooking mode and outside the recipe.

- **One runtime for the tab.** `CookingTimersRuntime` holds the timers above the router, beside
  `PlayerRuntime`; `useCookingTimers()` reads it. The shared page provides its own, scoped to that
  page. A timer knows its recipe (an overview's id), the recipe's title and its action's words, so
  matching a time in a step checks the recipe too (`isSameSource`), and the way back can tell whether
  the method has changed. The runtime holds the one ring, the wake lock while any timer runs, and the
  browser's "Leave site?" prompt.
- **Leaving asks keep or stop (288a–288d).** Only for this recipe's timers: "Keep the bake timer
  running?" ("Keep both / all three timers running?", listed soonest first), with Keep running filled
  and focused, Stop timer(s), and a quiet Keep cooking that Esc means. With only a ringing timer: "The
  simmer timer is ringing", Dismiss and leave (filled), Keep it ringing, Keep cooking. With nothing of
  this recipe's running or ringing, leaving doesn't ask.
- **A second recipe (288e, 288f).** The strip shows every running timer, soonest first; another
  recipe's read "Bake · Lemon drizzle loaf". Tapping one opens its controls with the way back, which
  leaves this mode first. Leaving asks about this recipe's timers only, and says the other carries on
  either way.
- **The dock (288g–288r).** `CookingTimerDock` sits at the foot of every page, centred at the floating
  player's width, holding the timers above `MiniPlayer`; with no player they take its place. One timer
  is a full tile, "Bake · Lemon drizzle loaf" and its time; two or three sit side by side by verb; four
  or more fold into "Timers +3", which lists them all (288p). The dock publishes how much of the foot
  it covers (`--mini-player-clearance`), as the player alone did, and steps aside while a cooking mode
  is open, since the mode shows the timers itself.
- **Controls (288s–288v).** OV-284's sheet with the recipe under the title, and above Cancel timer a
  way back: "Back to step 4", which opens that recipe's cooking mode at the timer's action (the action
  is carried with the timer, not read from the saved place). If the action's words have changed since
  (a regenerated note), "Open the recipe's cooking mode, at the start: the method has changed since";
  if the note is gone, a line says the timer carries on, with no link. The recipe is looked up afresh
  each time the controls open.
- **Ringing (288w–288z).** The banner in the timers' place, the recipe named under "Bake timer is
  done". A ring pauses the narration and the floating player says "Paused for the timer"; the last
  dismiss carries it on only if the ring paused it and the same note is still at the same place. Focus
  moves to Dismiss (Space on the web) and goes back where it was.
- **Where sound can't be counted on (288aa, 288ab).** The screen is kept on while any timer runs. Where
  it can't be, a quiet line above the timers: "Keep this screen on to hear your timer", on iOS "Keep
  this screen open…". In the panel, which has no "Leave site?" prompt: "Closing the panel stops
  timers".
- **The shared page (288ac–288af, owner's option C).** It has its own runtime, scoped to the page. A
  kept timer sits in the same dock at the page's foot, and "Back to step" opens the shared copy's
  cooking mode. Going into the app while one runs warns first ("Your bake timer will stop"): Save to
  my overviews in its own words ("Save and stop the timer"), and every other way in through the
  router's blocker ("Go on and stop the timer"). Stay on this page is filled and Esc means it.
- **Signing out (288ag).** The account menu's and Settings' Sign out warn the same way, "Signing out
  stops your timers, since they belong to this account's recipes", with Stay signed in filled;
  going on stops them (`by: "signedOut"`).
- **Two contexts.** `useCookingTimers()` ticks four times a second for what shows a countdown;
  `useCookingTimerList()` changes only when a timer starts, rings or ends, for what only needs to
  know which there are (the warnings, the player's "Paused for the timer").
- **Analytics.** `reader.cooking.timersKept` (how many, and whether ringing), `timerOpenedOutside`,
  and `backToStep` (landed at the step or the start), each on the timer's own recipe; `started` gains
  `from: "timer"`.

## Oven temperatures in US units

Decided by the owner on 3 Nov 2026 (150ak), closing 144x's question. US units turn the method's
Celsius into Fahrenheit, fan figures included, on the note, in cooking step by step and in what is
read aloud, marked on the stone tint like a changed amount. Oven figures land on a dial's 25° marks,
as the usual tables do (180°C is 350°F, 220°C is 425°F); anything under 120°C converts exactly.
Gas marks and Fahrenheit stay as written, and the method's note says "Oven temperatures are in
°F." Copy and Print still give the temperatures as the page wrote them.

## Sharing

Decided by the owner on 4 Nov 2026 (OV-159, https://trello.com/c/qDVVDm4z): a shared copy is the
whole recipe, method included, so the person it was sent to can read it, hear it and cook from it
step by step. That reverses the first build, which took design 144u's recommendation and left the
method on the page because it is in the author's own words. "Open the recipe on {site}" stays at
the top of the shared page, so the site is still one tap away.

- **The shared page is the reader's recipe, read-only.** The method with Read aloud, Cook step by
  step and Cook from here in the bar, through the same `useRecipeVoice` and `useCookingMode`.
  Its analytics are `sharedPage.cooking.*`, and the kept place is on the visitor's device.
- **Servings and units adjust there as on the reader's own copy** (OV-244, owner 8 Nov 2026,
  reversing OV-159's "not adjustable"): the ingredients, the method's repeated amounts, US oven
  temperatures and cooking mode. The adjustment is the visitor's, on their device; the copy never
  changes. Servings start again on each visit and the units are remembered, as on the reader page.
- **The sharer's narration plays only for the recipe as written.** Adjusted and signed out, the
  voice is the read-along without audio, and under the ingredients the page says "Read aloud
  plays the recipe as it was shared. To hear it read aloud as adjusted, create an account.",
  whose link starts onboarding around the copy, as Save does. Adjusted and signed in, it renders
  afresh on the visitor's own account in their own voice. Back to the recipe as written brings
  the sharer's audio back.
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

## Recipe videos

Trello OV-122. The owner's call on 2026-11-09: what recipe pages have, for recipe videos, plus the
Transcript and Chapters tabs every video has. No verdict, key points or Watch it anyway. Designs
122a–122u in Claude Design (OV-122 1–3).

**A model finds the recipe, and code checks it.** A video has no structured data, so this is the
one recipe a model reads. Since OV-275 a small kind check decides first whether the video
teaches one dish start to finish, from its title, channel, description and the opening of its
transcript (`checkNoteKind.ts`; `overview-generation-decisions.md`, "The kind check"). A
recipe video's note is then asked for with only the recipe's sections: In one line as the dish,
chapters, filing and the recipe (`recipeSection.ts`, `recipeVideoCoreSection.ts`). Every other
video's schema carries no recipe at all. The recipe call may still return null when the whole
video turns out not to be one dish (a talk, a review, food history, a vlog that cooks without
teaching, several recipes), and the video then gets its ordinary note. When the recipe comes
back, `assembleRecipeVideoOverview` builds the recipe note with the video's chapters.

Before OV-275 this was one call carrying a nullable recipe section, so a recipe video paid for
argument fields it never showed and every other video's schema carried the recipe block, which
is what filled Claude's grammar.
Then code, never the model (`docs/prototype/constraints.md`):

- **Every amount is checked** against the numbers the description and the transcript state, in
  digits or in words, so "two and a half cups" states 2½ (`statedAmounts.ts`). A line whose
  number nobody stated keeps its name and loses the amount, the bracket or the comma part that
  held it: "1 tsp salt" becomes "salt". A line left with nothing is dropped, and a recipe left
  with no ingredients falls back to the ordinary note. The check is generous by design: any number
  the source states passes, so it catches invented amounts, not misattributed ones.
- **Which lines the video said** rather than the description listed is found by comparing each
  line with the description's words (`ingredientsSaid`, design 122c).
- **Times and yield are read only from labelled description lines** ("Serves 6", "Prep: 10
  mins"), by the same reader recipe pages' markup uses (`recipeFactsInLines`). The video's length
  is never a cook time.
- **Each step's moment** is its segment range, as a key point's is. A step only the description
  gives has none and keeps its place (122g, step 9).

**The whole description.** `VideoSource.description` is cut to 400 characters, which cuts off most
ingredient lists. `fullDescription` carries the whole of it beside, to generation only: optional,
so older devices strip it unread, and `youTubeSource` leaves it off an overview's source, so
records and shares don't grow. A transcript held from before it existed has none, and the prompt
falls back to the cut one.

**The record.** `RecipeStep.range` and `Recipe.ingredientsSaid` are optional and absent on a page's
recipe, so a shared page recipe's hash doesn't move. Schema version 13 alters nothing; it holds
the records back from older clients, which would treat a recipe as a page's (client version 14).

**On screen (122a–122v).**

- The masthead says "{Channel} · Recipe video", with the video's thumbnail at its head as a
  recipe page keeps its image (147s), where 122a drew none. The tab row is a video's, Overview · Transcript ·
  Chapters, with the recipe inside Overview in 144a's order; a recipe video with no chapters has
  no Chapters tab (122k). The Summary ends "Open the video on YouTube · 14:32".
- The time row's caption is "As the video's description gives them." Nothing labelled, no row.
- The Ingredients card says where the list came from: "From the video's description", "As said
  in the video. Where no amount is said, the line has none.", or "…, with 2 said in the video",
  and marks each line from the other source "· said in the video". Adjusted, a line with nothing
  to adjust reads "· no amount said", or "· as said" for an amount in words.
- A step ends with its time, which opens a key point's menu: Watch from (in the panel, Play
  from, which moves the video beside it) and Read in transcript, which opens the line it starts
  at labelled "Step 4 starts here".
- In the panel the step whose stretch holds the playhead takes the stone tint, its time reads
  "4:12 · Playing", and it is `aria-current="step"`. The list never scrolls to follow (122i).
- Each chapter names the steps that start inside it, "Steps 1–3"; one with none says nothing
  about steps (122j).
- Cooking step by step offers "Watch this step · 4:12" on a step with a moment. On a phone and
  the web it opens a sheet with YouTube's player in privacy-enhanced mode, from the step's start
  to its end, rounded outwards to whole seconds; in the panel it moves the video beside it (122l,
  122m). The privacy policy says so.
- Library: "14:32 recipe video" as the length; the row keeps OV-179's "Recipe · 6 servings"
  chip, as recipe pages do.
- Creating: a video's steps, then "Recipe · 16 ingredients, 9 steps" once written (122q).
- Copy and Print name "{Channel} on YouTube" with the link, and end each step with "(4:12)"
  (122r, 122s). The markdown export, which MCP returns, links each step's time and keeps the
  chapters. The shared page is the whole note with its tabs and step times (122t).

## Not built

- The voice saying "That's the method." at the end of cooking step by step (150o): every spoken
  word comes from a line of the narration, and the method has no such line.
- Oven temperatures converted in Copy and Print.
- Copy and Print from a shared page.

## Testing

`pageRecipe.test.ts` runs handwritten pages, for the same reason as `readArticle.test.ts`: others'
text stays out of the repo. `recipeNote.test.ts` and `adjustIngredient.test.ts` cover the record and
the arithmetic, `recipeActions.test.ts` the splitting on steps taken from real pages,
`usOvenTemperatures.test.ts` the conversion, `cookingPlaceStorage.test.ts` the kept place, and
`cookingMode.iwft.ts` the mode, `cookingTimers.iwft.ts` its timers (with `methodTimes.test.ts` and `cookingTimers.test.ts` for the reading and the clock), `generateRecipeOverview.test.ts` the prompt and routing with a simulated model, and
`recipes.iwft.ts` with the shared page scenario cover the screens. For videos, `statedAmounts.test.ts`
and `assembleOverview.test.ts` cover the check and the assembly, and `recipeVideos.iwft.ts` the
screens. Nothing has been run against real
recipe sites or a real model yet.
