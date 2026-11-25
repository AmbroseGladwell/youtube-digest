# The image on a library row, at every width

OV-407, decided 24 Nov 2026. Designs 407a–407x on the canvas linked from the card
(https://trello.com/c/PH7UUK4g).

Until OV-407 a library row hid its image below 768px: at the width a phone could spare, a
thumbnail beside the text was too small to tell one video from another and cost the title
its column. The phone list was text only, and the row-to-head morph (`page-transitions.md`)
had nothing to start from on a phone.

## Three widths, two layouts

| Width | Layout | Image |
|---|---|---|
| below 30rem (480px) | **the banner card** (407l, 407u) | across the top of the tile at 2:1, edge to edge |
| 30rem to 47.9375rem | **the row** (407v–x) | beside the text, `clamp(8rem, 30vw - 1rem, 11rem)`: 128px at 480, 176px by 640 |
| 48rem up | the row, as before | 176px (11rem) |

**Why 30rem.** Every phone held upright is narrower (the widest are about 430–440px), so
each keeps the banner at roughly 170–225px tall. Above it the banner grows too tall to scan
past (367px at 767), and landscape phones, foldables and the iPad mini are better served by
the denser row. Two columns of banner cards (407t) were drawn and dropped: the row already
does that job at those widths.

**Why the thumbnail scales.** At 480 the full 176px thumbnail would leave about 226px for the
text, which is the cramped column that ruled out an image beside the text on a phone
(407b, 407h). From 128px it leaves about 280px.

**Why rem.** At 200% text the switch moves to 960px, so a phone or a tablet with large text
keeps the single-column banner card, which takes large text best. `libraryRowImages.iwft.ts`
checks it.

## The banner

The image is the same `OverviewThumbnail` the row uses, given a 2:1 box that bleeds to the
tile's edges and takes its top corners. Everything `OverviewThumbnail` already does carries
over: a video or recipe cover-cropped from the centre, a podcast's square art and a reel's
portrait cover matted on `--stone-tint`, and a name tile for a non-YouTube source with no
image or a dead one. A YouTube video with no image has no slot, so the row reads as it did.

**Selecting.** While selecting, each row's tick sits on its image's top-left corner, as it does
on the wide row, so the topics and verdict keep their place. A row with no image puts its tick
at the start of that line instead.

## The length on the image

The source's length sits in the image's bottom-right corner, as a video site shows it
(`noteLengthBadge`: "22:14", "1 hr 56 min", "42 s", an article's "14 min", a recipe page's
total time). It shows at every width, the desktop row included, so the row is one design.
Code makes it from the source; a length that isn't known shows nothing.

The meta line keeps its length too, for a screen reader: the image is `aria-hidden`, so the
line's ` · 22:14 video` stays in the text and is only hidden from sight while a badge is on
the row (`.root:has([data-length-badge])`). With no image, or one that failed, there is no
badge and the line shows the length as before.

On a name tile the badge would sit on the site's name, so a tile with a badge sets its name
at the top.

## The actions below 48rem

Below 48rem (the phone and the narrow row) Favourite, Mark read and Listen are 40px icons on
the timing line, 4px apart, rather than three labelled pills on a line of their own. That
line was a whole row's height on every tile, and taking it back is what makes the banner
affordable (407j–o). From 48rem up the row keeps its labelled pills.

- **Names.** Each icon keeps the words the pill said, as hidden text: Favourite or
  Favourited, Mark read or Read, Listen or Playing, with `aria-pressed`. The same words show
  as a tip above the icon on hover, keyboard focus and a long press
  (`frontend-architecture-guide.md` 4.4), and only at the widths where the words are hidden.
- **Read is a circle with a tick** (`ReadIcon`), the heart's partner: an outline unread, and
  filled with `--ink` and a tick in `--card` once read. Ink rather than orange, because read
  means done and the row recedes; the heart and Playing are the two things to notice.

## Motion

| Action | On | Off |
|---|---|---|
| Favourite | the heart's fill pops, 72% → 112% → 100%, 220ms (as built) | fades, 120ms |
| Mark read | the circle fills with the same pop, then the tick draws in, 360ms from 140ms: the saved chip's own tick | fades, 120ms |
| Listen | `--action` spreads from the centre, 260ms, and the headphones turn white | drains, 160ms |

While it plays, Listen's orange moves like a liquid orb (407q): its edge breathes unevenly,
its outline wobbles a few percent off round and it turns slowly, on loops of 2.9s, 3.7s and
9s. A lighter layer behind it, `--action` mixed 62% into `--card` so dark mode gets its own,
does the same on loops of 3.4s, 4.6s and 12s, turning the other way, and shows as a soft rim
wherever the top layer pulls in. Because the loops differ, the pattern takes a long time to
repeat. A sound-wave version and a blinking dot were tried first and dropped.

Every icon dips to 92% while pressed. Under reduced motion `theme/global.scss` turns all of it
off: states change at once and the orb sits still and full.

## The saved chip

Marking read on a row brings in "Saved you N mins" (`time-saved.md`). Below 48rem it takes the
timing line's place for its three seconds, in the same grid cell, and the line comes back when
it leaves. The cell keeps the line's height, so the tile doesn't shrink and the icons don't
move. From 48rem up it sits beside the line as before.

## Analytics

The row's four events (`library.overviewCard.opened`, `readSwitched`, `favouriteSwitched`,
`listenPressed`) carry `rowLayout` (`banner` below 30rem, `narrowRow` to 48rem, `row` above,
from `useLibraryRowLayout`, on the stylesheet's breakpoints) and the reader's `plan`.
Not `layout`: the server stamps that on every event (`full`, `panel`) and it would overwrite
the row's, as it did for the first day; `analyticsEvents.test.ts` now refuses such a name.
`library.overviewCard.imageFailed` counts a row whose image failed to load, by the source's
kind, once per overview a session, so a list redrawn on scroll doesn't count it again.

They answer the card's questions on the validation dashboard:

- **Is the image used?** Opens from the image against the title, by layout and plan, before
  and after this change.
- **Did dropping the words cost the actions use?** Mark read and Listen presses per library
  visit on `banner` and `narrowRow`, against the weeks before.
- **Where does the image fail?** `imageFailed` by kind, against rows opened.

Nothing here calls a model or a paid service, so the dashboard has no cost tile. It is built
over the PostHog MCP once the events reach production, and checked against live data then.
