# The dead-end screen

Design turn 19. One screen for every place the app cannot show you what you asked for,
replacing five inconsistent treatments — an unstyled paragraph on the router's error
boundary, a raw error message on two pages, a bespoke not-found on the reader, and, in one
case, nothing at all.

## Why one screen, and where the variation actually is

The six cases differ far less than they appear to. All of them are: a title, sometimes a
sentence, and a way out. What genuinely varies is **which way out**, and that is not
cosmetic — offering the wrong one is the harm this screen exists to avoid.

A generic "reloading usually fixes it" is correct for a crash and actively damaging for a
record that fails to parse: the reader reloads, gets the same screen, reloads again,
concludes the app is broken, and clears site data — destroying a record that a later
migration would have recovered (`docs/features/record-migrations.md`). So the actions are
the caller's to name, and the component has no default pair.

| Case | Title | Body | Way out |
|---|---|---|---|
| Another window upgraded the database, closing this tab's connection | This tab is out of date | yes | Reload |
| An overview cannot be read | This overview was saved in an older format | yes | Back |
| The library read failed | Couldn't load your library | yes | Try again |
| The topics read failed | Couldn't load your topics | — | Try again |
| Unknown URL | There's nothing at this address | — | Back |
| Unexpected render error | Something went wrong | yes | Reload + Back |

Two shapes carry the two kinds of way out, and they are deliberately not the same control.
A **recovery action** (Reload, Try again) is an accent-outline pill; **navigation** (Back)
is the small underlined link the rest of the app already uses, and it keeps the
surface-dependent wording the settings page established — "← All overviews" on the web,
"← Back" in the side panel. Because the two read differently, a one-action screen doesn't
look like it lost its pair.

The body is optional, and when it is absent the column simply has one fewer row. Nothing is
centred or padded to compensate.

## What the design settles that isn't obvious

**There is no error colour, and none was added.** The palette has no red, and the system's
rule is that judgements are set as type rather than as coloured fills
(`docs/features/overview-redesign.md`). The whole screen's only mark is a 3rem hairline
above the title, in the accent, and the accent is otherwise spent on the actions alone.
Tone comes from the wording and the hierarchy.

**It is left-aligned on the existing empty-state grid**, not a centred hero: 2.5rem padding,
0.75rem gap, capped at `--measure`. That is the same column the reader's skeleton and the
library's empty state already use, which is why the screen reads as part of the app rather
than as an interstitial.

**Focus lands on the screen, and the way out is one Tab away.** The design asked for focus
to land on the first action itself, and that was built first and then changed after looking
at it: `global.scss` draws focus as a 2px rectangle, and Chromium matches `:focus-visible`
on script-moved focus however the reader arrived — mouse, keyboard or a fresh load, all
three checked. So focusing the back link directly drew a box around it and turned
navigation into something shaped like the pill it must never be mistaken for, undoing the
distinction the rest of this screen is built on. The container takes focus instead, with
its own outline suppressed, which keeps what the design was after — a keyboard lands in the
dead end rather than at the top of the page — without dressing a link as a button. Tabbing
once reaches the action and rings it properly, because then the reader asked.

The container announces as an alert and the hairline is decorative.

## Two rendering contexts, and the narrow treatment

The screen renders both inside the app shell, below the masthead, and as the entire viewport
— React Router replaces the shell's own element with the error boundary, so a crash has no
masthead above it. It has to hold up either way, which is why it owns no chrome of its own.

The compact metrics — 1.75rem/1.5rem padding, a 1.6rem title, a 2.5rem rule — are applied on
two axes rather than one. `useIsPanel()` drives them because the side panel is 400px and the
design's second axis is literally the panel; the existing 47.9375rem breakpoint applies the
same treatment, because a web window that narrow wants it for the same reason.

## The two startup failures use it too

The database is opened before the app is rendered, so a failure there leaves no stores to
give it. That was first described as a tier this screen could not serve, on the grounds
that it happens "before React" — which is wrong, and worth correcting rather than quietly
fixing. React is loaded and `createRoot` works; it is only the *stores* that are missing.
The screen needs neither.

So both shells catch the failed open and render `StartupFailure` instead of the app. Two
cases, split on whether the reader can act:

- **A blocked open** — another window holds an older version, so the upgrade cannot start.
  Closing that window fixes it, and the copy says so, because reloading alone will not.
- **Anything else** — a storage failure. Quota, blocked site data, some private modes. Only
  a retry to offer.

Before this, both were a permanently blank page with nothing logged: `apps/web` called
`main()` with no `.catch()`, and both extension entries `void mountApp(...)`, which
discards the rejection outright.

The third startup failure, a missing `#root`, stays unhandled on purpose. There is nowhere
to render a screen that reports it, so it logs and stops.

## Where the build departs from the design file

Four small deviations, all of them the token set winning over a literal colour in the
design, and one judgement call:

- **Motion.** The file animates the arrival at 280ms; the build uses `--motion-arrive`
  (300ms). There is no 280ms token, and the design system's own rule is arrivals in
  240–300ms, so the token is inside the rule the file was drawn to.
- **The action's ink.** `#a83a12` in the file, `--accent-strong` (`#b03c12`) in the build —
  the token is the contrast-checked one at 5.6:1.
- **Body text on dark.** `#c9c3c1` in the file, `--muted` (`#bab6b6`) in the build. This one
  matters more than it looks: `tokens.scss` records that dark `--muted` was deliberately
  darkened from `#d7d3d3` because the dark body was reading heavier than the light one it
  mirrors. Taking the file's lighter value would undo a measurement.
- **The hover wash** is `--accent-wash` rather than the file's literal 8%/14%.

The largest departure is the recovery action itself. **The file draws it as a transparent
pill with an accent border; the build fills it with `--accent-tint` and takes
`tinted-control`, which is the same paint as `+ New` and Listen** — identical fill, ink and
border, at this screen's own larger size because it is a page-level action rather than
masthead furniture.

That was not the first answer. Built to the file, the transparent-accent pill was a
treatment `controls.scss` does not have: the system's accent control is filled and its
transparent control is neutral, so an accent-bordered transparent one needed a hover wash
of its own, and then a press state the file never specified — reaching for
`--accent-tint-press`, a token built to sit on a filled control. That is two inventions to
support one, in a system that documents exactly three treatments and explains each. Taking
the existing one removes both, and costs a fill the file did not draw.

The general rule this leaves: where the design file and `controls.scss` disagree about a
*control*, the system wins, because a control that behaves like the others is worth more
than one that looks exactly like its drawing. Type, colour, spacing and copy still follow
the file.

## What is not wired

Five of the six cases are live. One is not:

- **This overview was saved in an older format** needs record migrations, which are
  designed and not built (`docs/features/record-migrations.md`).

**The out-of-date tab replaces the whole tree, and does so from the shell.** Both shells
now make the React root *before* opening the database, so `onSuperseded` has somewhere to
render into when it fires — which is long after mount, whenever another tab or the
extension's worker upgrades. It replaces the app rather than rendering inside it because
there is no working app left to render into: the connection closed itself so that upgrade
could proceed, and every store call from that point throws.

One consequence worth knowing before editing `OutOfDateTab`: it renders **outside the
router**, so it must never be given `back`. A back link is a `<Link>`, and a `<Link>` with
no router around it throws. The case wants only a reload anyway — that is the one thing
that fixes it — so the constraint and the content model agree, but they agree by luck
rather than by construction.

The reader's generic load failure is wired, with copy that is not in the design's six —
the design's reader case is the older-format one, so a title and sentence were written for
the transient case rather than reusing copy that would be false.

Two cases were deliberately kept off this screen. **Settings falling back to defaults** is a
dismissible notice on a page that still works, and replacing that page with a dead end would
stop the reader fixing the thing it is reporting. **A transcript that fails to load** is
inline inside a reader tab; a full-page replacement would throw away the overview being read
to report a failure in one of its tabs.
