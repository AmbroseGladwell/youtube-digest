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
| 2e dark mode | `theme/tokens.scss` |
| 2f favicon | `apps/web/index.html` |
| 4a modal → bottom sheet | `NewOverviewDialog`, with `GenerateOverviewForm` as its idle body |
| 5a progress in place | the same dialog's run view, from `generationRunSteps` |
| 6a status strip | `GenerationStatusStrip`, inside the sticky masthead |
| 7a rule first | `LibraryOverviewCard`'s `.entering`, driven by `useEnteringOverviewIds` |

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
  favouriting appeared to shrink the control. `FavouriteIcon` is one path that either takes
  a fill or doesn't, identical in both states.
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
