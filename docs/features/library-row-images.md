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

## Still to come in OV-407

Icon-only Favourite, Mark read and Listen on the timing line, the read circle, their motion
and the saved chip's place are the card's second slice. Until then the phone keeps its three
pills under the text.
