# The stone theme

What was implemented from `The Overview - Stone.dc.html` (Claude Design project
`ae308669-1ef4-42d3-8085-8e2c69a928f9`), what was deliberately left out, and where the
implementation departs from the file. It replaces the visual layer that
`overview-redesign.md` describes; that doc's structural decisions — the dialog, the
background run, the sticky rails, the measured receipts — all still stand and are not
repeated here.

## The visual argument

The editorial theme separated things with hairline rules and set every control as an
outline on the bare ground. Stone inverts that: **surfaces carry the structure, and there
are no lines.** A library row sits on a raised tile; a control is a filled pill; a section
of the rail, a form or a note is a box one step off the ground. The design's own note:

> Warm neutrals only, with orange reserved for actions, progress, search hits and the
> mark. The mark has no background: the ring and bar sit directly on whatever is behind
> them. Action orange is #CF4718 so white labels pass contrast; the brand orange #E2511E
> stays on the mark and progress.

Two oranges, then, and they are not interchangeable:

- **Action** (`--action`, `#cf4718`) is the fill under a white label, and it is spent only
  on the one action that makes something: `+ New`, `Generate`, `Create overview`, the
  hero's `Generate overview`, `Read overview` when a run has landed, `Save keys` and the
  sync panel's own submits. Everything else is a surface pill.
- **Brand** (`--brand`, `#e2511e`) is the mark, the favourite's fill, every progress bar,
  the focus ring, the reading mark and a transcript search hit. It is never a fill under
  text.

Verdicts keep the earlier rule that they are never coloured: every verdict is the same
stone-tint chip, `Novel` included. What now varies between rows is whether they have been
read — a read row's title and channel recede to `--muted` and its thumbnail dims to half —
so the unread rows are what the eye lands on in a library that is three-quarters recycled.

Gloock carries every heading at a single weight; Figtree carries everything else. The
uppercase letterspaced kicker the editorial theme used to label every section is gone:
what labels a section now is Figtree 13 semibold in the stone ink (`--label`), sentence
case, through `controls.section-label`.

## What was built

The spec draws four sections and the app has more screens than that. Where the file
draws a screen it was followed; where it does not, the same tokens and pills were applied
and the structure left alone.

| Design | Where it landed |
|---|---|
| 1a tokens, type and components | `theme/tokens.scss`, `theme/global.scss`, `theme/controls.scss` |
| 1a's stroked icons | `components/shared/StrokeIcon`, replacing every typed glyph (`⚠ ⋯ × ✓ ◀◀ ▶▶ ← →`) |
| 2a library, top bar | `AppShell` — mark, nav pills, `+ New` at the far edge, no rule |
| 2a rail: Show, Topic, Verdict | `FilterPanel` — labelled groups of pill rows, a box that fills in for Show |
| 2a search over the list | `LibraryPage` — moved out of the rail, which is why its test id moved with it |
| 10a/11c/12c thumbnail-first row on a raised tile | `LibraryOverviewCard`, `LibraryUnreadableCard`, `controls.tile` |
| 2b/2c first run, with and without keys | `HomePage`'s hero, with its own field |
| 2d first run, phone | the same hero, one column |
| 3a new overview dialog | `NewOverviewDialog`, `GenerateOverviewForm` |
| 3b generating, with the reason field | `GenerationSteps` in its surface box, `CaptureReasonField` as a stone-tint note |
| Dark mode | the dark block in `theme/tokens.scss`, still on `prefers-color-scheme` and `[data-theme]` |

**The hero has its own field.** Design 2b's whole point is "one job: paste a link", and a
field that sent you to `+ New` would be a job and a half. It hands the URL to the shell's
own run controller and opens the dialog on the progress it makes, so there is still one
pipeline and one place a run lives (`overview-redesign.md`, "Generating in the
background"). It carries its own test ids because the dialog's form is always in the
document, closed, and two forms with one id would be ambiguous. `homeEmptyState.iwft.ts`
holds both paths.

**The search moved out of the rail.** Design 2a puts it over the list, which is also
where a phone can reach it without opening the filter sheet. It is now `LibraryPage`'s
element and test id, and `LibraryPageObject.search` drives it.

**Three pills, with their paint in the mixin.** `overview-redesign.md` kept paint at each
call site because treatment was what varied between a primary and a secondary. In stone
nothing varies but the size, so `controls.action-pill`, `controls.surface-pill` and
`controls.ghost-pill` carry shape, paint and states together, and a call site adds one of
`pill-sm`, `pill-md` or `pill-lg`. An active state (`Read`, `Favourited`, `Listening`, an
applied filter) is the ink with the ground for a label, never an accent border.

Because the mixins now carry paint, **the include goes first in a rule and the call
site's own declarations come after it.** Sass emits an `@include` where it stands, so a
`color` or `justify-content` written above one is overwritten by the mixin's — which is
exactly how the rail's labels came out centred and the dialog's field white-on-white the
first time round. The screenshots caught it; nothing in the suite would have.

**Fields are pills too.** `controls.field-pill` (a wrapper with an icon) and
`controls.field-solo` (the input on its own) draw the design's card-coloured track with a
2px border that lights in the brand orange while it has focus. A field on a card takes the
surface instead, one step down from whatever it sits on.

## The tile

Design 11c/12c: "on dark the tile is lighter than the page and the shadow is deeper; on
hover it lightens a step and the shadow deepens, with no movement." So a row rests on
`--card` with `--shadow-tile` and never carries a transform. Under the pointer and under
keyboard focus it takes `--shadow-tile-hover` and, on the dark ground only, `--card-hover`
one step up — on the light ground the tile is already white and only the shadow answers.
`libraryActions.iwft.ts` reads the resting shadow off the laid-out row and asserts that
hover changes it, that the neighbour's does not, and that the title's left edge never moves.

The editorial theme's "rule first" entrance drew a hairline along the top of a new row.
There are no rules on a tile, so a new row fades up in place instead.

## What was not built, and why

- **Depth: Standard / Deep.** 3a draws it; nothing in `packages/generation` has a depth to
  set, so the segmented control is left out rather than shipped with one working value.

## Placed but not wired

Some of the design's controls are in place ahead of the feature behind them, by
decision, so the screens read complete while the work is scoped. Each is honest about it
in the way CLAUDE.md's degrade-visibly rule allows: a disabled pill with a title saying
why, or a jump to where the thing lives today.

- **`Get the extension`** (`HomePage`, design 2b, web surface only). A disabled ghost pill.
  **To wire in:** an `href` to the Web Store listing once it is published
  (`chrome-web-store-account` in the project notes), and the button becomes a link.

## The single overview

Design 4 (`4 Single Overview.dc.html`: 4a–4d on the desktop, 5c on a phone, 6d–6i in the
panel) replaces the editorial reader's two-column page with **one 760px reading column
and nothing beside it**. What the old rail carried has moved rather than gone: `Watch on
YouTube` is in the ⋯ menu, the section list is retired (the tabs and the page itself do
that job), and the watch-anyway range still prints under the note. The breadcrumb, the
stepper in the top bar and the thumbnail are gone; where the library's order takes you
next is a `Previous · 2 of 4 · Next` foot under the note, since the next note is a thing
to want once this one is read.

**One head, three arrangements.** `ReaderMasthead` lays its four parts — the back link,
the actions, the ⋯ menu and the title block — out by grid area, so the desktop's top bar
(4a), the phone's action row under the title with Listen full width beside a 42px
favourite (5c) and the panel's Listen beside ⋯ under the meta line (6d) are one DOM
order. The head reads channel and verdict chip, then the Gloock title, then the topics
as surface chips, then the meta line; `panelChrome.iwft.ts` measures the verdict and the
warnings against the channel's row.

**The favourite moved from the player bar to the head**, where 4a draws it, and keeps the
row's 34px circle. **Mark read moved into the ⋯ menu** as `Mark as read` / `Mark as
unread` (4b), so `ReaderPageObject` reads the state off what the menu offers next. The
menu also carries `Watch on YouTube`, `Copy link` (the video's link, on either surface)
`Delete overview` on the web, and `Open in web app` in the panel, which opens the note in
the web app once it has synced (`docs/features/extension-panel.md`, "Open in web app").

**Deleting asks once.** `Delete overview` opens `DeleteOverviewDialog`, the New topic
dialog cut down to a question, with focus on `Cancel`. There is no undo: the store's delete
journals a tombstone that sync carries to every device, so the dialog carries that weight.
Confirming drops the note from the library's cache straight away
(`useDeleteOverviewMutation`) and replaces the reader with the library, so Back does not
return to a note that is gone. The panel's menu leaves it out. `deleteOverview.iwft.ts`
holds all of it, including a delete pulled in from another device.

**The note.** Key points are numbered rather than bulleted, counted per section by
`ReadAlongNote` and never spoken. The reason reads back as a stone-tint note above the
premise (4a) and edits in place inside the same note with `Save`, `Cancel` and `Remove
reason` (4c). Topics edit in place too: the chips take the stone ink with an × each and
`Add` is a surface chip ringed in the brand orange (4d), with the picker on the dialog
surface at 340px. The body is 16px on the desktop, 15.5px on a phone and 14.5px in the
panel through one `--note-size` variable on the page.

**The tabs** keep the segmented control and take the whole width on a phone and in the
panel (5c, 6d). The panel's bar names the note (`Overview`) rather than the app.

## The status strip

Design 3c (`3c Status Strip.dc.html`, split out of the main file because that one is
larger than the 256 KiB the design tool will hand back) draws the strip as one line on a
rounded surface card under the bar, inset 20px where the bar is inset 28px, with 20px
beneath it: a pulsing brand dot, the label in semibold, then step, clock and title in the
muted ink on one ellipsised span, and ghost `Details` and `Cancel` at the right. A 3px
brand bar runs along the card's foot. Ready, the card steps to the stone tint, the dot
becomes a check in the label ink, and the actions are `Read overview` in action orange
and a 32px dismiss circle; the bar goes.

Two departures. The design's ready line drops the step; the app keeps `Done · 0:32`
before the title, since how long a run took is the receipt the wait was for
(`overview-redesign.md`, "The receipts"). And 3c draws no failed state: the app gives it
the ready card's tint with an accent cross for a mark, `Details` and the dismiss circle,
and leaves the bar in place in the accent colour at the step it stopped on.
`newOverviewRun.iwft.ts` holds every state's behaviour; the look was checked by
screenshot against 3c in both schemes.
- **The reader, Settings, the side panel, the error screen.** None is in this file. Each
  took the tokens, the pills, the section labels and the icons, and kept its structure.
  The reader's tabs became the segmented control 3a draws for Depth, with the travelling
  indicator now the ink pill sliding behind the labels; the player bar became a card at the
  foot with an action-orange play circle; Settings' panels became card tiles.

## Highlighting

Design `Highlighting.dc.html` (1a/1b the overview being listened to, 2a/2b the
transcript in the panel, 2c the transcript opened from a chapter on the web, 3a the
chapters) settles how the three tabs say *where you are* — and the rule it settles on is
that **the raised card means the video, and a tint means the voice**.

- **The overview being read aloud** (1a). The sentence being spoken takes an inline stone
  tint on its own words — `--stone-tint` behind `--on-stone-tint`, 6px radius, 2px/4px of
  padding, bled back by the same 4px so the text does not shift. The row rule and the
  wash the old reader used are gone. The tint clones across a wrapped line rather than
  boxing the paragraph. The page scrolls to keep that line in its top third, and leaves a
  line already resting there alone, so a listener sees the tint walk down the page rather
  than the page jump per sentence. `prefers-reduced-motion` gets the same scroll without
  the animation.
- **The player bar** (1a/1b). The web's bar is a floating card: transport at the left, the
  section and the clock over a 4px brand track in the middle, the rate pill at the right.
  The panel's is the same parts as grid areas — track, clocks, then rate, transport and
  favourite on one row, with what is being read centred beneath. **The favourite is in the
  panel's bar and in the web's head**, never both: the panel's head has no room for it.
- **The transcript** (2a–2c). The head row carries the transcript's relationship to the
  video on the left and Copy/Export on the right: `Following the video` with a pulsing
  brand dot, `Not following · you scrolled away` in the muted ink, `← Back to chapters`
  when a chapter opened it, and the `Full transcript` label only where there is no player
  to follow. Rows sit on the ground until one matters: the block the player is inside
  takes `--card` with a `Playing on YouTube` badge above its text and an accent time, the
  block a chapter opened at takes the same card with a `Chapter 02 · …` chip instead, and
  every block the video has already passed drops to the muted ink. The cards bleed into
  the column's gutter by their own padding, so the text stays on the column's edge — which
  is why the sticky head's background runs the whole width of the gutter while its
  contents keep to the text, or a card sliding under it would show its corners either side.
- **Back to the time, not "follow playback"** (2b). The offer to re-join the video is a pill
  in the ink over the foot of the list, with the same brand dot, reading `Back to 1:05` —
  the time it would take you to. It is sticky rather than fixed, so it belongs to the
  transcript and cannot outlive the tab.
- **The chapters** (3a). The same following note heads the list when a player is reporting,
  and the count labels it when none is. Each row reads `01 · 0:00–1:05` in the muted ink
  over a semibold title and its summary; the chapter the video is inside takes the card,
  the accent range, the `Playing on YouTube` badge and a 4px brand bar showing how far
  through it the player is — measured from the player's own position against the
  chapter's own bounds, never estimated. Chapters already passed drop to the muted ink.

## Transcript search

`Transcript Search.dc.html` redraws the field both searches now share. It is one 44px
pill on the card fill, ringed 2px in the brand when it is focused **or** carries a query,
with a 16px search mark that is not a button, the query, then a rule and the count with
its steppers. The three round controls inside it — clear, previous, next — are one 30px
circle, one colour and one hover, and the browser's own blue cancel glyph is hidden in
favour of `ClearFieldButton`, which the library's search box uses too. The count is 12.5px
tabular in the muted ink; `No matches` takes its place in `--accent`, and the steppers
stay put and disabled rather than vanishing, so the field does not change width as you
type. Enter walks to the next hit, Shift+Enter the previous, and Escape empties the field
before it gives the keyboard back.

One departure from the design: its "first match" frame disables the previous stepper, and
the app does not. The steppers wrap round rather than stopping at either end, which
`transcriptTools.iwft.ts` holds as a decision of its own.

## The filter sheet

On the wide layout the filter rail is part of the page. Under 992px it is a bottom sheet
that rises over it, opened from the filter button beside the search ("OV-84 2 Library
Filter" 84i), with "Clear all" and "Show N overviews" at its foot. Two things follow from
that. It is never taller than the space under the bar — its max-height leaves the measured
`--masthead-height` clear — so its head never slides underneath a bar that is fixed over the
page. And while it is open it holds the
keyboard: `useFocusTrap` wraps Tab and Shift+Tab inside the sheet, Escape closes it, and
closing hands focus back to the button that opened it. Without the trap, tabbing past the
last filter walks into a library the reader cannot see.

## Fonts

The web app loads Gloock and Figtree from Google Fonts, as it did the previous pair. The
extension self-hosts both under `apps/extension/public/fonts/` so the side panel makes no
third-party request when it opens. Figtree is a variable font, so one file per subset
serves every weight; `fonts.css` declares `font-weight: 400 700` for it.

## The mark

The design's mark has no ground: the ring and bar sit on whatever is behind them. Both
apps now follow it, from one source — the design project's `Logo Pack.dc.html`, whose
files are all transparent.

The web app serves the pack's favicon set from `apps/web/public/`: an SVG for browsers
that take one, a three-size `.ico` for the rest, PNGs at 16, 32 and 48, and the 180px
Apple touch icon, which is the one file with a ground, because iOS fills transparency with
black. `icon-192.png` and `icon-512.png` are there for a web app manifest that does not
exist yet, and nothing references them.

The extension's toolbar icon **lost the dark square it used to carry**. The reason that
square existed was that a thin orange stroke scaled down to 16px goes to nothing against
Chrome's own chrome; the pack solves the same problem by thickening the stroke at 16 and
32 rather than by painting a ground, so the icon can be transparent and still hold up. The
128px icon carries the Web Store's 16px of padding. Each size is tuned on its own, so
there is no render script any more: new icons come from the pack, not from scaling one
file down (`apps/extension/public/icons/README.md`).

Every PNG had its C2PA content credentials stripped on the way in — several kilobytes on a
16px icon. The signed originals stay in the design project.
