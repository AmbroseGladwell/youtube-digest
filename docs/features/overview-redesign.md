# The Overview redesign

What was implemented from `Overview Redesign.dc.html` (Claude Design project
`ae308669-1ef4-42d3-8085-8e2c69a928f9`, "Podcast screenshots design iteration"), what was
deliberately left out, and where the implementation departs from the file.

## The visual argument

The design replaces the prototype's card-and-badge look with an editorial one, and the
whole thing rests on a single rule: **verdicts are set as type, never as coloured fills.**
The design's own note puts it plainly — "Recycled recedes to the lightest ink so a library
that is three-quarters recycled reads calm; the accent field is kept for the player alone."

That matters here more than it looks. `docs/prototype/open-questions.md` records that 77%
of the real library lands in one verdict bucket. A palette that gives every verdict its
own coloured chip turns that distribution into noise; type that recedes turns it into
texture. The accent (`#E2511E`, `#F0794A` in dark) is spent only on the primary action,
the active filter, `⚠ Dubious claim`, and the rule under `Novel`.

Concretely:

- Headings in Cormorant Garamond, body in Lora, both loaded from Google Fonts in
  `apps/web/index.html` with serif fallbacks. The one network dependency the app now has.
- Ground `#f3f2f2`, ink `#201f1d`, hairline dividers, no card shadows, no panel radii
  beyond 4px. Rules separate things; boxes don't.
- Uppercase letterspaced kickers (`IN ONE LINE`, `VERDICT`, `KEY POINTS`) label every
  section of a note, which is the design's structure for the reader body.
- Dark mode is the design's own 2e palette, and now responds to `prefers-color-scheme`
  as well as an explicit `[data-theme]`. Nothing sets `data-theme` yet.

## What was built

| Design screen | Where it landed |
|---|---|
| 2a library desktop, top bar | `AppShell` — brand, `+ New` and the nav in one bar |
| 2a rail: search, Show, Topic, Verdict | `FilterPanel` |
| 2b first run, mobile and desktop | `HomePage` hero |
| Keys, and the bar's `Settings` nav item | `SettingsPage` at `/settings`, with `ApiKeysPanel` |
| 2c library mobile, filter sheet | `LibraryPage` — one `FilterPanel`, styled as a column on desktop and a slide-over under 992px |
| 2c/3a reader, mobile and desktop | `ReaderPage` at `/overviews/:overviewId`, with `ReaderMasthead`, `ReaderTabs`, `ReadAlongNote`, `ReaderRail` and `ReaderPlayerBar` |
| 2a/2c row meta, `4 min read · 6 min listen · 11:38 video` | `overviewMetaParts`, shared by the row and the reader |
| 2e dark mode | `theme/tokens.scss` |
| 2f favicon | `apps/web/index.html` |
| 4a modal → bottom sheet | `NewOverviewDialog`, with `GenerateOverviewForm` as its idle body |
| 5a progress in place | the same dialog's run view, from `generationRunSteps` |
| 6a status strip | `GenerationStatusStrip`, inside the sticky masthead |
| 7a rule first | `LibraryOverviewCard`'s `.entering`, driven by `useEnteringOverviewIds` |
| 9a buttons & pills | `theme/controls.scss`, included by every control's own module |
| 9b tabs | `ReaderTabs` and `useTabIndicator`, with the panel's ink-in on `ReaderPage` |
| 9c list → overview → back | `util/viewTransitions.ts` and `AppShell/paneTransitions.scss` |
| 9d icons | `FavouriteIcon`, and `PlayPauseIcon` replacing the ▶/❚❚ glyphs |

The rail and the mobile sheet are deliberately **one** `FilterPanel` instance rather than
two, repositioned by CSS. Two instances would mean two copies of every control in the DOM
at once — ambiguous for tests, and worse for screen readers. For the same reason the
applied-filter chips and their ☰ button are a phone-only row: on desktop the rail is
already on screen, so a second row restating the same filters is noise.

**The generate form lives behind `+ New`, in the design's 4a dialog** — a centred modal on
a desktop, the same panel as a bottom sheet under 768px — and there is one instance for the
whole app rather than a copy per page. A paste field and its Generate button standing open
at all times is more furniture than one control is worth, so the bar keeps the brand,
`+ New` and the nav. Turn 4 carries no `Chosen` badge, but turns 5 and 6 are both drawn on
4a — "the modal and bottom sheet stay in place and become a numbered progress list", then
"after Run in background the sheet closes" — so the modal is the option the rest of the
design depends on, and the earlier inline drawer (4c) is gone.

It is a native `<dialog>` opened with `showModal()`, not a hand-rolled overlay: that is
what makes the page behind it inert, keeps focus inside it, and delivers Escape as a
cancel event. Escape and a click on the backdrop mean the same thing as the control they
stand in for — close the dialog, and if a generation is running, leave it running.

### Opening it

The scrim fades over 260ms and the panel arrives *behind* it, 80ms in, over 480ms on one
decelerating curve — so the dim reads as the cause and the dialog as the consequence
rather than the two landing together.

On a desktop that panel travels 10px and is mostly a fade: a centred dialog is not coming
from anywhere, so distance would be invention. **The phone sheet travels its own full
height from the bottom edge and does not fade at all** — it *is* coming from somewhere,
and that is the one place in this design where real travel is the honest gesture. Both are
animations on the `<dialog>` element itself, which is why the sheet's travel can be
`translateY(100%)`: a percentage of the thing that is actually moving, not a hardcoded
height that would be wrong for every panel but one.

Only the opening is animated; closing is immediate. That is
`frontend-architecture-guide.md` 2.4's "leave should be faster than enter" taken to its
end, and it keeps a dismissal from ever feeling like lag. Under
`prefers-reduced-motion` both animations drop through the blanket rule in
`theme/global.scss`, leaving the dialog in its end state with nothing stuck at zero
opacity.

Living in the masthead did put the keys in two places at once — the dialog's form and the
settings page — so `useApiKeys` reads a single shared snapshot through
`useSyncExternalStore` instead of each caller holding its own `useState` copy. Without
that, saving keys on `/settings` left the form disabled until a reload;
`settingsKeys.iwft.ts` is the test that holds it.

**Two button treatments, both from the design.** *Outlined* is accent border and accent
text on the bare ground; the *soft tint* is the same border over a 16% wash. The tint marks
the one action that takes you somewhere — a row's `Listen`, the reader's `Read aloud`, and
the masthead's `+ New` — while the masthead's own `Generate overview` stays outlined, since
by then `+ New` has already made the claim on attention. Secondary controls are neutral
outlined pills, and the favourite is a 32px circle matching the reader's player bar.
Treatment is the only thing that varies between a primary and a secondary pill: `Mark read`
and `Read aloud` sit on one padding and one type size, so the pair reads as a pair.

**Two spacing values, `--gap-control` and `--gap-group`.** 10px between adjacent controls
in one group — a row's actions, the reader's masthead buttons, the player's transport — and
16px between separate groups in a bar, which is `+ New` to the nav and one nav item to the
next. These had drifted to four different values, and the 4x difference between a library
row's 6px and the masthead's 24px was visible at a glance.

**The masthead's text sits on one line, centred in its band.** Two things were off. The nav
links reserve space below the text for the active underline, so centring that lopsided box
lifted their text 2px above the brand's and the button's. And the rule at the foot is part
of the band the eye reads, so equal padding left the whole row sitting high against it —
the top padding carries the rule's width to compensate. Both are measured, not guessed:
the three texts' midpoints agree within 0.2px and sit within 0.7px of the band's centre,
the remainder being where Lora's glyphs fall inside their own line box.

`+ New` takes the design's 44px touch target on a phone as a `min-height`, which makes its
own `align-items: center` load-bearing rather than decorative: a flex container's default
`stretch` leaves the anonymous text item at the top of a pill that is taller than its line
box, and the label sat 7.2px above centre. Centred, it lands on the same 0.67px Lora
offset the rest of the bar carries.

Two filters in the design's rail did not exist in the app and were added with it:
`favourite` (Only favourites) and `dubious` (⚠ Dubious only), both carried in the URL
alongside the existing ones. The rail's counts are computed in `libraryFilterCounts.ts`
from the entries themselves — `docs/prototype/constraints.md`'s rule about never letting a
model count anything applies just as much to a number rendered in a filter list.

## What was not built, and why

Each of these needs data or a surface the app doesn't have. None is a styling gap.

- **Real transcript and chapter content.** The two tabs are built to the design, but
  nothing stores a transcript against an overview and chapters are not generated at all
  (titled summaries of each stretch of audio would be new work in `packages/generation`).
  Both panels render `PLACEHOLDER_TRANSCRIPT` / `PLACEHOLDER_CHAPTERS` and say so on
  screen, in the design's own accent slot beside the section kicker, so the rows are never
  mistaken for the real thing. Replacing those two constants with stored data is the whole
  of the remaining work on those tabs.
- **Narrated audio.** `docs/features/tts-pre-rendered-speech.md` is the designed-and-measured
  version and was not built. The player bar is therefore a *reading pacer*, not an audio
  transport — see "The player bar without audio" below, and 5a's missing third step under
  "Generating".
- **Depth: Standard / Deep.** 4a's desktop panel offers it; nothing in
  `packages/generation` has a depth to set, so the row is left out rather than shipped as a
  control with one working value.
- **The extension side panel and capture toast.** There is no extension.

## Generating: the dialog, the steps and the strip

### The receipts

The design's point about 5a is that "each step reports what it produced rather than that
it is thinking, so the wait doubles as a receipt". So the rows print numbers that came
from somewhere real:

- **`Transcript fetched · 1,412 words`** — `countWords` over the fetched segments, in
  `runOverviewGeneration` itself. Code counts them.
- **`Overview written · 4 min read`** — `overviewReadMinutes`, which is deliberately the
  reader's own `noteTiming(overviewNoteLines(...))` rather than a second estimate. The
  receipt and the "4 min read" on the note it opens are then the same number by
  construction.

**The design's third step, `Rendering audio`, is absent.** There is no narrated audio to
render (`tts-pre-rendered-speech.md` is designed and not built), and `CLAUDE.md`'s
degrade-visibly rule says a step that cannot happen should not be drawn as though it
might. Two steps, and `Step 1 of 2` / `Step 2 of 2` on the strip counts the steps there
actually are. `generationRunSteps.test.ts`'s first case is the one that fails if an audio
row is ever added back without the audio.

Inside a running step the bar **sweeps** rather than filling to a percentage: nothing here
knows how far through a Supadata fetch or an Anthropic call it is, and a bar that claimed
to would be inventing the number (`docs/prototype/constraints.md`). The strip's own rule
is a fraction, but only of steps that have actually finished — the running step is credited
with half of its own, and nothing else.

**`0:19 elapsed` is measured, not estimated.** `useElapsedSeconds` ticks off the clock from
the run's `startedAt` and freezes at its `finishedAt`. It lives in the two components that
print it rather than in the run, so a generation ticking once a second re-renders those two
and not the whole shell.

### Generating in the background

The run is owned by `useNewOverviewRun`, and the hook is held by `AppShell` — the one
component that survives every navigation. That is the whole mechanism: `Run in background`
closes the dialog and changes nothing else, so the generation outlives both the dialog it
was started from and the page it was started on, without needing a second app-wide context
(`frontend-architecture-guide.md` 4.1 budgets one or two for an entire app, and the audio
player is the one it earmarks).

`GenerationStatusStrip` then renders the same run as the design's 6a strip, inside the
sticky masthead and under its rule, so `useMastheadHeight` measures the band including the
strip and the reader's tab strip still comes to rest on its lower edge. `readAlong.iwft.ts`
asserts exactly that, before and after the strip appears.

Only one run exists at a time, so `+ New` while one is going shows that run rather than
starting another — the same thing the strip's `Details` does.

**Cancel abandons the run rather than aborting a request.** Neither the Supadata client nor
`GenerationClient` takes an `AbortSignal`, so cancelling bumps the run id, which the
pipeline reads through `isCancelled` between phases: a cancel during the transcript fetch
means the Anthropic call is never made, and a cancel during generation means nothing is
saved. The in-flight HTTP response is discarded when it arrives.
`newOverviewRun.iwft.ts` holds that by cancelling, then releasing the held call and
asserting the store is still empty. Real abort plumbing is a change to
`@overview/generation`'s client signature and is not in this change.

### How a new row arrives

Design 7a offers three entrances and marks **rule first** as `Chosen`: the hairline draws
left to right, then the kicker, title and meta fade up behind it in turn. That is in
`LibraryOverviewCard`'s `.entering`, and the row's own divider is what the accent rule
fades off onto at the end — a permanent accent rule on one row would be a mark the design
never takes off again.

`useEnteringOverviewIds` decides which rows are new, and it reads the **unfiltered**
library rather than the visible list: an entrance is for a row that arrived, so changing a
filter must not animate every row it reveals, and neither must the first render.

Under `prefers-reduced-motion` all four animations collapse to their end state through the
blanket rule in `theme/global.scss` — which is also why the entrance is written as bare
`animation` rather than through a mixin: the repo has no animation mixins and adding a pair
for four call sites while ten existing transitions don't use them would be two conventions
instead of one. `frontend-architecture-guide.md` 2.3 is the standing intent; the global
kill-switch is how this repo currently meets it.

## The reader

### Read and listen times

`4 min read · 6 min listen · 11:38 video` is three numbers, and each one has to come from
somewhere real (`docs/prototype/constraints.md`: never let a model count, measure or time
anything). So:

- **Read** and **listen** are arithmetic over the note's own words, done in
  `noteTiming.ts` — 220 words per minute read, 150 spoken. Code counts the words; nothing
  estimates them.
- **Video** is `video.durationMs`, which Supadata does return. When it is null — notes
  generated before that field existed — the term is dropped rather than guessed, and the
  line reads `4 min read · 6 min listen`. `readerMetaParts.test.ts` holds that.

The spoken rate is not decoration: it is also what paces the reading mark, so the clock in
the player bar and the "6 min listen" claim are the same number by construction rather than
two estimates that can drift apart.

**A library row prints the same line, under its text**, which is where design 2a and 2c put
it. Both callers go through `overviewMetaParts`, so a row and the note it opens cannot give
different answers about the same overview — `libraryActions.iwft.ts` opens one from the
other and compares. It sits outside the row's title link rather than inside it, so it stays
out of that link's accessible name, and it drops the video term on an overview with no
stored duration exactly as the reader does.

### The player bar without audio

There is no narrated audio, so the bar does what the design file's own prototype does: it
holds each line for as long as that line would take to say, divided by the chosen rate,
and moves the reading mark on. Play/pause, ◀◀/▶▶, the four rates and the progress bar are
all real controls over that, which is why the bar is present rather than hidden under
`CLAUDE.md`'s degrade-visibly rule — nothing here is a control that cannot work. What it
does not have is a waveform, a scrubber or per-line audio timings; those arrive with the
TTS feature.

## Shared utilities

`src/util/` holds the three things more than one feature needs. `countWords` and
`formatClock` moved out of `features/reader/util/`: both are about words and clocks rather
than about the reader, and the generation pipeline needs the first for its transcript
receipt — reaching into another feature's `util/` for it would have been the coupling
`frontend-architecture-guide.md` 3.3 warns about. `useMeasuredHeight` is there for the same
reason, being used by the shell and the reader alike; it is a hook rather than a pure
function, which is the one stretch in that folder's remit.

`overviewReadMinutes` deliberately does reach into the reader — see "The receipts" above
for why that one is the point rather than the problem.

## Chrome that stays put

Both rails are chrome, not content: on a desktop they come to rest against the sticky
chrome above them and hold there while the list or the note scrolls past. The library's
rail rests on the masthead's lower edge; the reader's rests one band lower, under its tab
strip. `stickyRails.iwft.ts` holds both, and asserts the page actually scrolled so the
comparison can't pass vacuously.

**Only the rail's contents stick — the column itself keeps stretching**, which is what
keeps its divider running the full height of the window rather than stopping where its own
content ends. In the library that sticky element is the existing `.railBody`; the reader's
rail grew one wrapper for the same job. The reader's foot is the player bar rather than the
window, so that is what its divider has to reach.

Neither offset is a hardcoded number. `useMeasuredHeight` publishes the masthead's height
as `--masthead-height` and the reader's tab strip as `--reader-tabs-height`, and the rails
sit at the sum. That is the same argument as the tab strip's own `top`: the masthead wraps
on a phone and grows with the generation status strip, so any constant would be wrong half
the time. It is one hook rather than two because the reader needed the second measurement —
and it takes callback refs rather than `useRef`, because the reader renders a skeleton
first and its elements arrive after the first render, which a mount-only effect would miss.

Below 992px none of this applies: the library's rail is a slide-over sheet and the reader's
falls under the note, so the sticky rules live in `min-width` blocks and the phone layouts
are untouched.

## The small movements

Design turn 9 ("The small movements") is the motion pass, and it rests on one rule:
**state changes take 80–160ms, arrivals 240–300ms, and nothing scales except a round
target or an icon marking itself.** The ease is `cubic-bezier(.2,.7,.2,1)` unless the
animation says otherwise. Those five numbers are `--motion-press`, `--motion-state`,
`--motion-ink`, `--motion-travel`, `--motion-arrive` and `--motion-ease` in
`theme/tokens.scss`, and everything below reads them rather than restating a duration.

The two entrances that predate this pass — the dialog's and a new row's — keep their own
`cubic-bezier(0.33, 0, 0.15, 1)`. They are arrivals of a whole surface rather than a
control changing state, they were drawn and timed in turns 4 and 7 rather than 9, and
retiming them would be a change to a design decision that was already made.

### 9a — buttons and pills

The app paints four control treatments and, before this, none of them answered the
pointer at all. `theme/controls.scss` gives each one its states, and only its states: the
base paint stays at the call site, because *treatment is the only thing that varies
between a primary and a secondary pill* and a mixin that owned the paint would have to
know about all of it.

- **`tinted-control`** — the soft-tint primary (`+ New`, a row's `Listen`, `Read aloud`,
  `Generate overview`, `Save keys`). Hover deepens the tint from 16% to 26% and steps the
  border to `--accent-strong`; press takes it to 34% and 1px down.
- **`outlined-control`** — the neutral pill (`Mark read`, a filter toggle, an applied
  chip, `Paste`, `Cancel`). **Hover moves the ground under it and nothing else.** An
  outlined pill's border and ink are how it reports being *on* — `Read`, `Favourited`, an
  active filter — so a hover that recoloured them would read as the state it is offering
  to set. The wash is `--ink-wash`, not the accent, which keeps the accent on the
  primaries where the design spends it.
- **`quiet-control`** — the ghost (`Cancel` on a running run, `Clear all`, `↑ Previous`).
  No fill ever appears: the underline arrives and the ink darkens, and a press only
  darkens further.
- **`icon-control`** — the round targets (favourite, play, the transport steps, the phone
  filter button). They scale to `.94` on press rather than shifting down, because a 1px
  nudge on a circle reads as a wobble. Their wash is `currentColor`, so one mixin serves a
  neutral circle on the bare ground and an accent one inside the player bar.

Disabled drops to 45% and loses every transition, so a dead control never answers the
pointer at all.

Two geometry changes came with this, both because a wash needs somewhere to land: the
player bar's `◀◀`/`▶▶` and the dialog's `✕` take a real padded target and give the space
straight back with an equal negative margin. The laid-out rhythm is unchanged and only the
hit area grows.

Keyboard focus is untouched — it is the 2px ring in `theme/global.scss`, it appears
instantly with no transition, and it was already on every control here.

### 9b — tabs

The reader's three tabs used to switch a `border-bottom` on and off. They now share **one
indicator that travels**, so the eye follows the rule to the new label rather than losing
it and finding it again. It takes 260ms regardless of distance: skipping two tabs at once
is the same journey, which keeps the far tab feeling quick rather than laboured.

`useTabIndicator` measures where it goes. `Overview`, `Transcript` and `Chapters` are
words of different widths, so the offset is read off the laid-out buttons in a layout
effect rather than divided out of the strip — `docs/prototype/constraints.md`'s rule about
never letting anything estimate a number it could read, applied to a position.
`readAlong.iwft.ts` compares the indicator's box to the active tab's, which is the test
that fails if the measurement ever stops happening.

The labels cross-fade their ink over 160ms, and the panel below inks in over 180ms after a
60ms hold, with no travel — the tab strip has already said where you are. The `key` on the
panel element is what re-runs that: a tab change swaps the panel's contents, not the
element.

### A row's chrome, and when it exists

**At rest a library row carries no chrome at all — not even a rule.** The tile exists only
under the pointer, on keyboard focus and under a press, so the list stays quiet to read and
becomes a set of targets when you go hunting. Three things arrive together on 140ms
ease-out: a transparent 1px border becomes `--line`, the background paints `--ground` over
the list, and `--shadow-sm` appears.

`--shadow-sm` is the design system's own smallest step — `0 1px 2px`, no spread — and
nothing custom: the system ink (`#2d2b2b`) at 14% on the light ground, where the warm grey
keeps it from going cold against `#f3f2f2`, and black at 50% on the dark one. **The row
never translates.** The frame the list sits in carries `--shadow` (the system's
`--shadow-md`, three times the offset), so a row never competes with its container.

**What reads as raised is `--raised`, not the shadow**, and the two themes need different
amounts of it. On the light ground `--raised` *is* the ground: the border and the shadow
carry the tile between them, and a lighter fill would read as a second paper stock. On the
dark one a shadow at half opacity over near-black is nearly invisible, so the lift has to
be the surface itself — `#232120`, one step up from `#1b1a19`. The shadow is then only
there to soften the corners. That is why the tile's test asserts the background alongside
the border and the shadow: a dark row that painted the ground back onto itself would pass a
border-and-shadow check and still look like no tile at all.

Two things about the implementation are worth knowing before touching it:

- **The inline padding is given straight back as a negative margin.** The tile is
  `1rem 0.875rem` on a `--radius-panel` corner, and the inline half of that is returned as
  `margin-inline`. A bordered tile whose
  edge sits on the text would be unreadable, but indenting the text at rest would mean the
  resting layout changes — and the point is chrome that isn't there yet. So the tile bleeds
  outwards into the list's own padding and the text never moves. `libraryActions.iwft.ts`
  measures the title's left edge before and after the tile appears.
- **Hover is gated behind `@media (hover: hover)`**, or a tap would leave the last row you
  touched lit until you touched another. Touch is served by `:has(:active)` instead: the
  press lands on one of the row's own controls, which is the element a touch reliably gives
  `:active` to. Keyboard focus goes through `:has(:focus-visible)` for the same structural
  reason — focus is always on a control *inside* the row, never on the row itself, so
  `:focus-visible` on the row would never match.

`--ground` is the faithful mapping of the design system's `--color-bg`, and on today's list
that paint is invisible: the list sits on `--ground` too. It is there so the row is its own
opaque surface rather than a hole onto whatever is behind it. If the tile should actually
lighten against the page, `--surface` is the one-token change.

### 9c — list → overview → back

This is the one piece of motion the architecture guide has a prescribed answer for, and
the persistent shell it asks for in 1.1 was already here, so it is built its way: the
native View Transitions API through React Router's `viewTransition`, with the choreography
in `shell/AppShell/paneTransitions.scss` beside the region that swaps.

Forward, the pane arrives from 10px right over 300ms. Back, the library returns from 6px
left over 260ms — shorter and shallower, because *return journeys are always faster; the
list is a place you already know*. Leaves are shorter again and ease in, which is guide
2.4's asymmetry.

`viewTransitions.ts` is the single gate, and its reduced-motion check has to live there
rather than in `theme/global.scss`: `::view-transition-*` pseudo-elements sit outside the
document tree that stylesheet's `*` rule reaches, so nothing else would turn them off.
**It carries no viewport check**, where guide 2.2 asks for one. That check exists to keep
full-screen push transitions off phones, and 9c's travel is 10px — the design draws the
frame at 430px, so the phone case is the designed case, not the unhandled one.

Direction is the thing the API has no opinion about, so `navigationDirection` decides and
`AppShell` publishes it on the root element as `data-nav-direction`, in a layout effect
that lands inside the router's own DOM update — the moment the browser takes the "after"
snapshot. The rule is one line: **the library is the only place you come back to**, so
everywhere else is somewhere you go. `libraryActions.iwft.ts` holds it in both directions.

`<ScrollRestoration />` is in the shell for the design's last note on this screen: the
list's scroll position is restored before the animation starts, so the row you tapped is
under your thumb when you land.

### 9d — icons

*Only icons that record a choice are allowed to move on their own. Icons that merely label
a control never animate; they change colour with the button around them.*

- **Favourite** pops from .72 to 1.12 to 1 over 220ms — the only overshoot in the system,
  and it earns it by confirming a deliberate mark. Un-favouriting just fades the fill out,
  no bounce. The pop is on a *second path over the same `d`*, for the same reason
  `FavouriteIcon` exists at all: the outline underneath must not move while the fill
  arrives. And because the pop confirms a mark that was just made, the component tracks
  whether one was — otherwise a library of favourited rows would pop every heart on
  arrival.
- **Play / pause** is a 120ms cross-fade, no morph and no rotation: this control gets
  pressed constantly and any flourish becomes a tic. It is now `PlayPauseIcon` rather than
  `▶` and `❚❚`, which are unrelated glyphs of different widths — the same problem, and the
  same fix, as the heart.
- **Refresh** and **save for later** are in the design and have no control in the app to
  attach to. Nothing was added to carry an animation.

### Key points, as bullets

The README's note format calls Key points "three to five bullets", and the design sets
them as a list everywhere it draws a note. `NoteLine` carries `bullet`, set by the section
that builds the lines rather than decided by the component, because it is a property of
the note format rather than of the rendering.

**The mark stays out of `line.text`.** The spoken pacing and both word counts read that
string, and `noteTiming` counting "•" as a word would put the bullet into "4 min read".
So it is a separate `aria-hidden` element, and the line's own words carry their own test
id — which is why `verifyActiveLineReads` asserts on that rather than on the button.

## A row is a strip, not a block

Design 12d's row geometry, and the reason it is worth having: **the thumbnail column is
132px, not the 264px the app had drifted to.** That is not really a change to the image. The
thumbnail was what set the row's height, so halving it hands that job to the text and the
row goes from **149px to 86px** — 42% shorter, nearly twice as many overviews on a screen.
For a tool whose whole point is triage, the row wants to be a strip you scan rather than a
block you read. The title gets ~130px back with it.

Two consequences worth knowing. The row's thumbnail is now *smaller* than the reader's
148px, inverting what it was — which is the right way round, since a row is an index and the
reader is the thing itself. And 132px is exactly half of the `16.5rem` both rails use, so
the arithmetic stays tidy.

**The favourite is 30px, on `--edge`.** Both halves of that fix a drift rather than
following a spec for its own sake. The circle was 32px next to a `Mark read` pill that is
30px, so the two controls in one row of actions disagreed by 2px; and its outline was
`currentColor`, derived from its own ink, so it moved every time that ink was retuned —
most recently landing on `#bab6b6` while the pill beside it stayed `#605d5d`. What the two
share is an edge, not an ink, so the heart now takes `--edge` as the pill does.

The reader's player-bar heart follows to 30px, because the row's circle and the note's are
deliberately one number — the control keeps its shape between a row and the note that row
opens. Its *border* does not follow: inside the accent field a neutral grey edge would be
the one cold line on it, so it stays `currentColor`. `libraryActions.iwft.ts` holds both the
row's agreement and the reader's match.

## Two weights of secondary text

Design 12d draws a line on a library row that the app's palette did not have: the summary
and the verdict at `#bab6b6`, the durations at `#9b9797`. One token, `--faint`, was doing
both jobs — and 57 others besides.

The split is **what the text is for, not how important it is**. `--muted` is prose you
read: a description, a verdict, a hint, a standfirst, the title of the video currently
generating. `--faint` is what you scan past: labels, counts, clocks, kickers, placeholders
and quiet controls. Fourteen call sites moved; the other forty-five stayed.

**No fourth token was added.** `--muted` already was the app's secondary-text step, and its
dark value is now 12d's `#bab6b6` rather than `#d7d3d3` — which turned out to fix an
asymmetry rather than introduce one. Measured against the ground each sits on, `--ink` and
`--faint` land within 1.2 and 0.2 contrast points of their light counterparts; `--muted` sat
**2.67 points brighter**, so the dark body read heavier than the light body it mirrors. At
`#bab6b6` that gap closes to 0.39 and the ramp is even.

This does reach past the library row, because `--muted` is also the read-along body, the
transcript, and the ink of neutral outlined controls. Those all dim by the same step in
dark, from 11.71:1 to 8.65:1 — still comfortably above AA, and closer to what the light
theme has always done. The light theme is untouched throughout.

## Where the implementation departs from the file

- **Verdict labels.** The design shows the prototype's old scale (`Solid but familiar`).
  The app's scale is `Novel / Established / Recycled` (`overview-generation-decisions.md`),
  and the app's labels won. The design's *treatment* of them is what was taken.
- **The `Listen` action** on a library row keeps the design's word, and navigates to
  `/overviews/:overviewId` rather than expanding the note in place. There is no audio
  behind it — it opens the reader, whose player paces the reading mark rather than playing
  anything (see "The player bar without audio"). The expand-in-place card body existed only
  because there was no reader page to send you to; there is one now, so it is gone, and so
  is the separate `OverviewResultCard`.
- **Generating no longer navigates for you.** It used to open the new note in the reader the
  moment it existed. 5a and 6a both end on a `Read overview` link instead, so the finished
  run offers the reader rather than taking you there — you stay where you were, which is
  the point of being able to run it in the background at all.
- **`Cancel` is on the dialog's running footer as well as the strip.** 5a draws only
  `Run in background`, which would mean backgrounding a run before you could stop it. It
  sits as quiet type beside the pill, the same treatment the strip gives it.
- **`Paste from clipboard` shows at both widths**, where 4a has it only on the phone sheet
  (the desktop panel spends that row on Depth, which isn't built). It renders only when
  `navigator.clipboard.readText` exists, so an insecure context gets no dead button.
- **The ready strip stands down on its own** after `READY_DISMISS_MS`. The design says the
  ready state "dismisses itself" without saying when; the note is in the library with 7a's
  entrance on it by then, so the strip has nothing left to say. A failed run never
  auto-dismisses — it has to be read.
- **2c's rail and 3a's tabs are on one screen.** The design draws them as two separate
  desktop readers — 2c with a `Sections`/`Source` rail and no tabs, 3a with
  `Overview / Transcript / Chapters` and no rail. The build carries both: the tab strip
  under the masthead, the rail beside the panel, with `Sections` showing only on the
  Overview tab because it has nothing to point at on the other two.
- **The favourite heart is drawn, not typed.** The design's `♡` / `♥` are two unrelated
  characters (U+2661 and U+2665) whose serif faces draw the filled one visibly smaller, so
  favouriting appeared to shrink the control. `FavouriteIcon` is one path with a second,
  identical path over it that takes the fill — see "9d — icons" for why the fill is its own
  element. `▶` / `❚❚` had the same problem and `PlayPauseIcon` is the same fix.
- **A library row is not tinted under the pointer.** Design 9c tints the whole row on
  hover, but there the row is a single button. This row carries a favourite, `Mark read`
  and `Listen`, and a wash behind all three swallows `Listen`'s own tint — so the mark goes
  on the title, which is the thing that is actually going to open. The design's own library
  screens (2a, 2c) draw no row tint either.
- **A phone row keeps the three pills**, where design 2c's phone card drops them to plain
  type. A row now reads the same at both widths: the round favourite, outlined `Mark read`
  and tinted `Listen`, on a 38px touch size — which is the size 9a draws its own icon
  button at. They sit under the text with their left edge on the title's.

  Note this is 38px where the rest of the phone layout — `+ New`, the filter toggles, the
  dialog's buttons — takes the design's 44px. 38px was asked for and 9a uses it for an icon
  button; if these should match the rest, it is one value in one media block.
- **A phone row has no thumbnail at all.** At the width a phone can spare it, the image is
  too small to tell one video from another and it costs the title the column it needs. The
  title is the same way in to the reader, with the same words, so nothing is lost with it —
  and it is `aria-hidden` and out of the tab order anyway, so hiding it takes nothing out
  of the accessibility tree. Two things follow from dropping it: the title gets the full
  width, and the three actions have room to sit under it on one line down to 320px.

  This is a CSS `display: none` rather than a component that stops rendering it, which is
  how the reader's breadcrumb and the library's rail already behave at this breakpoint. It
  has one consequence worth knowing: **a hidden thumbnail is out of the grid but still the
  first child in the tree.** The desktop rule that gives a thumbnail-less row its own
  narrower grid is `.row:has(> .body:first-child)`, which therefore does *not* fire for a
  row whose thumbnail is merely hidden — and *does* fire, and outranks a bare `.row`, for a
  row that never had one. Both selectors have to be restated in the media block or the two
  kinds of row lay out differently on the same screen. That is the shape of the bug the
  phone test in `libraryActions.iwft.ts` exists to catch, which is why it asserts on both
  rows rather than the first.

  The favourite's glyph grows with the circle, holding the ~47% ratio the 32px desktop pair
  has.
- **`prefers-reduced-motion` still goes through the blanket rule** in `theme/global.scss`
  rather than the animation mixins `frontend-architecture-guide.md` 2.3 asks for. This pass
  roughly triples the number of motion call sites, which is the argument for the mixins —
  but the blanket rule already delivers the outcome they exist to enforce, and converting
  every existing site is a change worth making on its own rather than buried here. The one
  place it genuinely cannot reach, `::view-transition-*`, is gated in JavaScript instead.
- **♡ is in the player bar at both widths**, which is where design 2c's phone reader puts
  it. The design's desktop bar has no favourite at all; hiding a real control on wide
  screens would be worse than carrying it across. `Mark read` sits in the masthead beside
  `Read aloud`, where the design's mobile header has its `⋯`.
- **The masthead is sticky, and the reader's tab strip sticks beneath it** — the tabs come
  to rest on the masthead's lower edge and never slide under it, so you can still change
  view part-way down a long note. The player bar sticks at the foot (`z-index` 3, 2 and 2;
  the phone filter sheet's 4/5 still covers all of them). The design draws static screens
  and says nothing either way.

  The masthead's height is not a constant — it wraps to two rows on a phone and grows again
  whenever 6a's generation status strip is up — so hardcoding the tabs' `top` per breakpoint
  would put them in the wrong place half the time. The sticky band is the `<header>` itself,
  holding the bar and the strip below its rule; `useMastheadHeight` measures that laid-out
  element with a `ResizeObserver` and publishes `--masthead-height`, which the tab strip and
  the read-along's `scroll-margin-top` both read. `readAlong.iwft.ts` asserts the two edges
  actually meet, before and after a backgrounded run puts the strip there.
- **Both rails are 16.5rem.** The design has the library rail at 236px and the reader rail
  at 200px; two near-but-not-equal columns read as a mistake when you move between the two
  screens, so they are one width.
- **The reader carries the video thumbnail** to the left of its title — above it on a
  phone, where a 96px image beside a 28px heading left the title in a column too narrow to
  read — and the library row's thumbnail is a second way in to the reader, as the title
  beside it is. The design's reader has no thumbnail at all — but arriving from a row that showed
  one and losing it breaks the sense that it's the same note. Both call sites share
  `OverviewThumbnail`, which renders nothing when there is no usable image rather than
  leaving an empty frame. Where it links, it is `aria-hidden` and out of the tab order:
  the title beside it already goes to the same place with the same words, and a second
  unlabelled link to it would be noise to anyone not using a mouse.
- **No 2px rule under the reader's title row.** The design closes the title block with the
  same heavy rule the library masthead uses. With the tab strip directly beneath it that
  reads as two heavy horizontals in a row, so the rule is dropped and the tabs' own hairline
  does the separating.
- **The phone reader keeps the position counter** (`1 of 2`) and drops `↑ Previous` /
  `Next ↓`, rather than the design's `Read along` / `⋯` header.
- **The nav reads `Overviews`, not `Library`**, and has no `Listen` item. The design file's
  own bar says `Overviews`; a later export says `Library · Listen · Settings`, and `Listen`
  would be a control with nothing behind it until the player exists.
- **Read rows are not dimmed.** The design carries read state in the row's `Read` button,
  not by fading the title, so nothing fades the title here either.
- **Topic pills** render only for topics an overview actually belongs to, and `+ New topic`
  is absent — topic creation has no UI yet.
