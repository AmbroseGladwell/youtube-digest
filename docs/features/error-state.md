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

**Focus lands on the way out** — the pill when there is one, the back link when that is all
there is. The container announces as an alert and the hairline is decorative.

## Two rendering contexts, and the narrow treatment

The screen renders both inside the app shell, below the masthead, and as the entire viewport
— React Router replaces the shell's own element with the error boundary, so a crash has no
masthead above it. It has to hold up either way, which is why it owns no chrome of its own.

The compact metrics — 1.75rem/1.5rem padding, a 1.6rem title, a 2.5rem rule — are applied on
two axes rather than one. `useIsPanel()` drives them because the side panel is 400px and the
design's second axis is literally the panel; the existing 47.9375rem breakpoint applies the
same treatment, because a web window that narrow wants it for the same reason.

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

The judgement call: this pill does **not** use the `outlined-control` mixin, whose hover is
`--ink-wash`. That mixin exists for controls whose border and ink report a state they are
offering to set — Read, Favourited, an applied filter — and its comment says so. A recovery
action is a one-shot, reports nothing, and the design draws an accent wash under it. So it
takes `control-motion` and an accent wash instead, which is a fourth treatment in a system
that documents three. If that is wrong, this is the paragraph to argue with.

## What is not wired

Four of the six cases are live. Two are not, and neither is blocked on this screen:

- **This tab is out of date** needs the `onSuperseded` callback that
  `openLocalDatabase` already takes and nothing yet consumes. The screen it will show is
  built and takes a Reload action.
- **This overview was saved in an older format** needs record migrations, which are
  designed and not built (`docs/features/record-migrations.md`).

The reader's generic load failure is wired, with copy that is not in the design's six —
the design's reader case is the older-format one, so a title and sentence were written for
the transient case rather than reusing copy that would be false.

Two cases were deliberately kept off this screen. **Settings falling back to defaults** is a
dismissible notice on a page that still works, and replacing that page with a dead end would
stop the reader fixing the thing it is reporting. **A transcript that fails to load** is
inline inside a reader tab; a full-page replacement would throw away the overview being read
to report a failure in one of its tabs.
