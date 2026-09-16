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
| 2a library desktop, top bar | `AppShell` (brand bar) + `GenerateOverviewForm` compact variant |
| 2a rail: search, Show, Topic, Verdict | `FilterPanel` |
| 2b first run, mobile and desktop | `HomePage` hero + `ApiKeysPanel` |
| 2c library mobile, filter sheet | `LibraryPage` — one `FilterPanel`, styled as a column on desktop and a slide-over under 992px |
| 2c/3a reader body | `OverviewResultCard` |
| 2e dark mode | `theme/tokens.scss` |
| Favicon | `apps/web/index.html` |

The rail and the mobile sheet are deliberately **one** `FilterPanel` instance rather than
two, repositioned by CSS. Two instances would mean two copies of every control in the DOM
at once — ambiguous for tests, and worse for screen readers.

Two filters in the design's rail did not exist in the app and were added with it:
`favourite` (Only favourites) and `dubious` (⚠ Dubious only), both carried in the URL
alongside the existing ones. The rail's counts are computed in `libraryFilterCounts.ts`
from the entries themselves — `docs/prototype/constraints.md`'s rule about never letting a
model count anything applies just as much to a number rendered in a filter list.

## What was not built, and why

Each of these needs data or a surface the app doesn't have. None is a styling gap.

- **Transcript tab.** `@overview/transcripts` fetches a transcript during generation, but
  nothing stores it against the overview, so there is nothing to render or to time-align.
- **Chapters tab.** Not generated at all. Titled summaries of each stretch of audio would
  be a new section in `packages/generation`, not a UI change.
- **The audio player and read-along.** The design's player bar, rate control, progress and
  line-by-line marking assume narrated audio and per-line timings. `docs/features/tts-pre-rendered-speech.md`
  is the designed-and-measured version of that feature, and it was not built.
- **The extension side panel and capture toast.** There is no extension.
- **`4 min read · 6 min listen · 11:38 video`.** Read time is derivable from the note, but
  listen time needs the audio above and video duration is `durationMs`, which the
  prototype's transcript source never returned. A partial version of this line would be
  three numbers where two are invented; `constraints.md` says don't.

## Where the implementation departs from the file

- **Verdict labels.** The design shows the prototype's old scale (`Solid but familiar`).
  The app's scale is `Novel / Established / Recycled` (`overview-generation-decisions.md`),
  and the app's labels won. The design's *treatment* of them is what was taken.
- **The `Listen` action** on a library row is `Read overview`, which expands the note in
  place — the existing behaviour, since there is no audio to start.
- **The `Settings` nav item** is not rendered. There is no settings route; keys are edited
  from the generate form. A visible control that goes nowhere is the thing `CLAUDE.md`'s
  "degrade visibly" habit exists to prevent.
- **Topic pills** render only for topics an overview actually belongs to, and `+ New topic`
  is absent — topic creation has no UI yet.
