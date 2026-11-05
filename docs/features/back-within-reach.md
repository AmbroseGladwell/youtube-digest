# Back within reach on a phone

What OV-167 built from designs 167a–167f and the motion prototype (`OV-167 1 Back Within
Reach.dc.html`, `OV-167 2 Listening Strip and Compared.dc.html`, `OV-167 3 Motion
Prototype.dc.html` in the Claude Design project), and where the build departs from them.

## The problem

On a phone the note's head scrolls away, and its `← All overviews` with it, so leaving a
long note meant scrolling back to the top. The tab strip and the player bar already stick,
and on a 390 × 844 phone they and the app's bar leave about 530px for the note while
listening, so nothing could be added to that stack permanently.

## What was built

**The bar's brand slot takes over the way back (167a–167c).** Once the head's own link
has scrolled under the sticky band, the slot that held the mark and the wordmark holds
`← All overviews` instead; scrolling back up past the same edge hands it back. The whole
slot swaps, mark included: keeping the mark beside the arrow would put two links in one
box, one going home and one going back, with no telling them apart by touch. Nothing
else in the bar moves, because the box is the same in both states. `+ New` stays as it
is. On a tablet, between 48rem and 62rem, the same happens and the `Overviews` nav
beside the slot is left alone. Wider than that the head keeps its own arrangement and
the bar keeps the brand; in the panel there is no back link to hand over.

**One link, one name.** Both the head's link and the bar's are `All overviews` with the
same arrow, both go to the library, and only the one showing is reachable: the other is
`inert` and `aria-hidden`. If the link that has focus is the one that leaves, focus moves
to the one that arrives, which has the same box. `backWithinReach.iwft.ts` counts the
reachable links named `All overviews` to say whose turn it is.

**The hand-off** runs in two overlapping beats on `--motion-arrive`: the mark turns a
third of a turn and shrinks away while the wordmark lifts and softens; from about a third
of the way through, the arrow draws itself and slides in with a small overshoot, and the
label settles a beat behind it. Scrolling back reverses the order, so the mark springs
back last. The timings are the prototype's fractions of one duration, in
`AppShell.module.scss`. Reduced motion gets an instant swap through `theme/global.scss`'s
rule.

**What triggers it** is one `IntersectionObserver` on the head's link with the sticky
band's height as a negative top margin (`useBackInBar`), so the change fires once per
crossing of the band's lower edge. The band is the whole masthead, status strip
included, which is why a strip under the bar moves the edge rather than hiding the link
behind it (167e). The read-along's follow scroll is instant (`following-playback.md`), so
it crosses the edge once rather than hovering on it; the IWFT watches the attribute for
a second while the note is paced to say so.

The reader lends its link to the shell through `BackLinkHandoffContext`: the masthead
registers the element and what following it does, from a mount effect rather than a
callback ref, because the router's `Link` merges refs into a new function on every render
and a callback ref would be detached and re-attached, and the shell's state set, on each
one.

## Back in history, or home

The design's definition of done is that the library comes back where the reader left it.
A push to `/` never does that: the router's `ScrollRestoration` scrolls a new location to
the top and restores a position only on a pop. So both links go **back in history when
the library is the entry behind this one**, which is also what makes a tap and the
edge-swipe gesture land in the same place; otherwise, after stepping to a neighbouring
note, or on a cold load or a shared link, the link is a plain link home. The router only
says where you are and how you got there, so `useHistoryTrail` keeps the session's
entries by location key (`historyTrail.ts`, unit-tested) and `useBackToLibrary` reads the
entry behind. A modified click (a new tab) is always the plain link.

## Analytics

`reader.page.backFollowed` gained `from: head | bar`, so the bar's link is counted on its
own.

## Departures from the design

- **The box is the brand's own, not a fixed 176 × 56px.** The brand stays in flow,
  unseen, and the back link lies over it, so the box is the same in both states as the
  design asks, but it is as wide as the wordmark needs: at 176px the 20px wordmark wrapped
  at 390px, and a fixed box would have overflowed a 360px phone.
- **`--motion-arrive` (300ms), not `--motion-state` (120ms), is the base duration.** The
  design names `--motion-state` for "about 320ms"; the token is 120ms, which would make
  the two beats unreadable, and the app's own rule puts arrivals at 240–300ms.
