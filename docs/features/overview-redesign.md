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
| 2a library desktop, top bar | `AppShell` — brand, the generate form, and the nav in one bar |
| 2a rail: search, Show, Topic, Verdict | `FilterPanel` |
| 2b first run, mobile and desktop | `HomePage` hero |
| Keys, and the bar's `Settings` nav item | `SettingsPage` at `/settings`, with `ApiKeysPanel` |
| 2c library mobile, filter sheet | `LibraryPage` — one `FilterPanel`, styled as a column on desktop and a slide-over under 992px |
| 2c/3a reader, mobile and desktop | `ReaderPage` at `/overviews/:overviewId`, with `ReaderMasthead`, `ReaderTabs`, `ReadAlongNote`, `ReaderRail` and `ReaderPlayerBar` |
| 2e dark mode | `theme/tokens.scss` |
| Favicon | `apps/web/index.html` |

The rail and the mobile sheet are deliberately **one** `FilterPanel` instance rather than
two, repositioned by CSS. Two instances would mean two copies of every control in the DOM
at once — ambiguous for tests, and worse for screen readers. For the same reason the
applied-filter chips and their ☰ button are a phone-only row: on desktop the rail is
already on screen, so a second row restating the same filters is noise.

**The generate form lives in the masthead**, one instance for the whole app rather than a
copy per page, and it sits behind the design's `+ New` button **at every width** — not just
on a phone where the bar has no room for it. A paste field and its Generate button standing
open at all times is more furniture than one control is worth, so the bar keeps the brand,
`+ New` and the nav, and the field drops onto a row beneath when you ask for it
(`newOverviewComposer.iwft.ts` holds that at both widths). The same instance either way,
revealed rather than duplicated. What it generates opens straight in the reader, so nothing
has to be handed down to the library. Living in the masthead did put the keys in two places
at once — the masthead form and the settings page — so `useApiKeys` now reads a single shared snapshot through
`useSyncExternalStore` instead of each caller holding its own `useState` copy. Without
that, saving keys on `/settings` left the masthead's form disabled until a reload;
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
  transport — see "The player bar without audio" below.
- **The extension side panel and capture toast.** There is no extension.

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

## Where the implementation departs from the file

- **Verdict labels.** The design shows the prototype's old scale (`Solid but familiar`).
  The app's scale is `Novel / Established / Recycled` (`overview-generation-decisions.md`),
  and the app's labels won. The design's *treatment* of them is what was taken.
- **The `Listen` action** on a library row keeps the design's word, and navigates to
  `/overviews/:overviewId` rather than expanding the note in place. There is no audio
  behind it — it opens the reader, whose player paces the reading mark rather than playing
  anything (see "The player bar without audio"). The expand-in-place
  The expand-in-place card body existed only because there was no reader page to send you
  to; there is one now, so it is gone, and so is the separate `OverviewResultCard`. Generating from the masthead
  opens the new note in the reader for the same reason.
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

  The masthead's height is not a constant — it wraps to two rows on a phone and grows a row
  again whenever the paste field is open — so hardcoding the tabs' `top` per breakpoint
  would put them in the wrong place half the time. `useMastheadHeight` measures the
  laid-out element with a `ResizeObserver` and publishes `--masthead-height`, which the tab
  strip and the read-along's `scroll-margin-top` both read.
  `readAlong.iwft.ts`'s last scenario asserts the two edges actually meet, before and after
  the masthead grows.
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
