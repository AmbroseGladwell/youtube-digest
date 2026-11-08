# The fade under the bar

What OV-166 built from designs 166a–166h (`OV-166 1 The Library.dc.html`, `OV-166 2 The
Overview.dc.html`, `OV-166 3 Arriving Settings and Prototype.dc.html` in the Claude Design
project), and where the build departs from them.

## The problem

The app's chrome is sticky and painted in `--ground`, with no rule under it, because the
stone theme separates with surfaces rather than lines (`stone-theme.md`). That leaves
content meeting a hard edge as it scrolls under: a library row's title is simply cut in
half. A rule or a shadow would fix the edge and lose the theme, so what was wanted was the
band's own colour thinning out.

## What was built

**Sixteen pixels of `--ground` fading to nothing, hanging from the foot of the sticky
chrome.** The stops are the onboarding teaser's — ground, 85% at a third, 45% at 62%, 15%
at 84%, then transparent — so most of the ground sits in the first third and the band's
edge softens rather than moves, and the long tail leaves no second edge where the fade
ends. It is mixed from `--ground` with `color-mix`, so light, dark and every accent follow
with no token of their own. The design settled on one height for every surface: 24px starts
to wash the top line of a library row's title, and 16px is the most a settings section's
heading allows when it is arrived at by its own route.

**It hangs below the band rather than sitting inside it**, as a pseudo-element at
`top: 100%` that catches no clicks, so nothing in any band changed size and no layout moved.

**Only the lowest band in a stack carries it.** This is the whole of the mechanism, and it
is worth being plain about why. On an overview the bar, the tab strip and — on the
Transcript tab — the transcript's tools all stick, each one over the next, and every one of
them is `--ground`. A fade hung under the bar would therefore do nothing visible for the
12px of ground above the tab strip's track and then land its faint last pixels on the track
itself: invisible at best, a smudge on the track's top edge at worst, and never once
softening the content it is for.

So every band that can come to sit over content carries `data-sticky-fade`, and one rule in
`theme/global.scss` draws the fade on the last of them:

```scss
[data-sticky-fade]:has(~ [data-sticky-fade], ~ * [data-sticky-fade])::after { content: none; }
```

A band gives the fade up to any band that follows it, whether that band is its own next
sibling (a band handing over to the one after it) or sits inside one (the tab strip handing
over to the transcript's tools, which are in the tab panel below it). Nothing
measures anything and no component tells another what it is doing: the document order is
the answer, and it is already correct. Which band is lowest changes with the tab, the
layout and the surface, and none of that needs saying twice.

Where that lands, surface by surface:

| Surface | The bands, in order | What carries the fade |
|---|---|---|
| Library, settings, anything else in the shell | the app's bar | the bar |
| Overview, Note tab | the bar, the tab strip | the tab strip |
| Overview, Transcript tab | the bar, the tab strip, the tools | the tools |
| Panel | the bar, the note's head, the tab strip, the tools | the lowest of them |
| Shared page | its own header, the tab strip, the tools | the lowest of them |

On the library the fade runs the full width, so the filter rail — whose body sticks beside
the list and scrolls on its own — dissolves at its top edge too.

**The player bar gets no mirrored fade, in any layout.** Docked on a phone and in the panel
it is a raised tile with rounded top corners and `--shadow-float`, so its edge is already
drawn and a ground fade above it would only muddy that shadow. On the web it floats inset
from every edge, so a band of fade above it would span the page and not read as the bar's
at all. Its shadow is its edge.

**Onboarding's stepper carries it** since OV-210, when the step began to scroll under it, and
the onboarding foot carries the same curve mirrored, rising from its top edge while content
runs under it (`onboarding-foot.md`).

## Arriving, and the two paths that draw it

The fade is a scroll state, not a part of the bar: at the top of the page nothing shows and
the bar ends where it always did. It arrives **tied to the scroll itself**, growing from
nothing over the first 24px, as a scroll-driven animation on `animation-timeline: scroll()`.
Design 166g weighed that against a 120ms fade-in triggered once the page has scrolled at
all, and the scroll-driven one wins on the way back: scroll restoration lands part-way down
a page, and a value set from script arrives a frame after the view transition has
snapshotted the masthead, so a timed fade would pop in after the transition ended. A
scroll-driven value is already right in the snapshot. Going forward the new page starts at
the top, so neither direction flashes.

The second path is an `IntersectionObserver` on a 1px sentinel at the top of the page
(`usePageScrolled`, `PageScrolledSentinel`), which puts `data-page-scrolled` on the document
root once the page has scrolled at all and turns the fade on instantly. It is the fallback
where scroll timelines are missing, and it is **also the reduced-motion path, without an
exception being written for it**: `theme/global.scss`'s blanket rule switches every
animation off under reduced motion, which leaves the scroll-driven rule at its first
keyframe — zero — for the attribute to answer. The two paths cannot fight, because an
animation beats a plain declaration wherever both apply.

The sentinel is published on the document root rather than returned, because what reads it
is one global rule over bands that sit in trees the hook knows nothing about: the shell's,
the reader's and the shared page's.

## What capped the height at 16px

Settings is the plain case the design draws: since PR #218 took the stickiness off
`← Settings`, nothing sticks there but the bar. A section's heading carries
`scroll-margin-top: calc(var(--masthead-height) + 1rem)`, so scrolled to its own anchor it
comes to rest 16px below the bar — exactly where the fade ends, which is why the design
chose 16px over 24px rather than pushing that margin down to make room. Nothing in the app
scrolls a settings heading today (arriving on a section focuses it with `preventScroll`),
but the browser does for a fragment or for sequential focus, which is what the margin is
for. `fadeUnderTheBar.iwft.ts` holds the two numbers to each other rather than simulating a
scroll the app never makes.

## Departures from the design

- **No frame was drawn for a note whose head is the lowest band.** That was a panel note
  with only one tab, and OV-205's 205b has since stopped the panel sticking its head at
  all, so the case no longer arises. `fadeUnderTheBar.iwft.ts` pins the bands each layout
  has.

## What the tests hold

`fadeUnderTheBar.iwft.ts` reads the generated box rather than the attribute, since every
band carries the attribute and a stylesheet picks between them. It checks the library shows
nothing until it has scrolled and the full fade after, that an overview hands the fade from
the tab strip to the transcript's tools when that tab opens, that the panel's three-deep
stack still ends on the right band, that a shared page behaves as the reader does, and that
settings fades under the bar alone with its headings clear of it. It also pins which
elements are bands at all, which is what holds a note's own head — it scrolls away with the
note in every layout — out of the stack.
