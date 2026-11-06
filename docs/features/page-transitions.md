# Moving between pages

What OV-170 built for every navigation that isn't the library and the reader, and which
navigations were deliberately left plain.

## What was already there

Design 9c's pane transition has been in the app since the redesign: forward, the pane
arrives 10px from the right over `--motion-arrive` and the old one leaves 6px left over
180ms; back, it returns 6px from the left over `--motion-travel` and leaves over 160ms.
The masthead is captured and held still. All of it lives in
`shell/AppShell/paneTransitions.scss`, keyed off `data-nav-direction` on the root, which
`AppShell` writes from `navigationDirection()`.

It reached only the links that happened to ask for it. `viewTransition` is a per-link
opt-in, and the library's cards, the reader's chrome and the mini player were the only
places that passed it. Settings and its sections, the queue, sign-in, the legal pages and
every "go and fix this in Settings" link swapped with no transition — not because anyone
decided they shouldn't have one, but because each new link had to remember a flag.

## What was built

**`PageLink` replaces the flag.** `components/shared/PageLink/PageLink.tsx` wraps
react-router's `Link` and supplies `viewTransition` from `useShouldAnimateNavigation()`.
Every link that leaves one page for another goes through it, so the gate answers for all
of them in one place, which is what `frontend-architecture-guide.md` 2.2 asks for and what
a per-call-site flag could never hold. A link that stays on the page keeps the plain
`Link`. The app's one `NavLink` — the masthead's `Overviews` — still passes the flag by
hand, because `PageLink` can't stand in for NavLink's active styling.

**The programmatic journeys pass the gate too**, where a reader asked for them by
clicking: the account menu's items, the panel's `Read overview`, `Sign in` from the panel's
Start, and the two "make it again" paths that return to the library.

## A pop is animated by replay, not by a flag

`navigate(delta)` takes no options, so `useBackTo` — which pops history whenever the
destination is the entry behind, so its scroll position comes back with it — cannot opt in.
It doesn't need to. React Router records each animated navigation as a from-to pair and
replays it, reversed, on a `POP` between the same two paths
(`react-router@8.4.0`, `lib/router/router.js:361-381`).

Two consequences. The flag on the **forward** link is what turns both directions on, so
there is nothing to add to a back link. And a reader who lands somewhere directly — a deep
link, or the panel reopening where it was — gets no transition on the way back out, because
there was no journey to reverse.

## What was left plain, and why

- **Redirects.** Every `<Navigate>` corrects an address rather than making a journey, and
  a correction should be instant.
- **Navigations that follow an outcome rather than a click:** a run finishing, signing out,
  the extension bridge handing over, the sign-in landing. The page changing under the
  reader is already the event; animating it dresses up an upheaval as a journey.
- **Onboarding's screens.** They are `progress.step` state on the one `/start` route, and
  `AppShell` returns early for it, so there is no masthead and no pane name to move. A
  transition there would be `startViewTransition` around a state change — the
  `useLibraryGlide` shape — not a route transition. Anything in or out of `/start` is left
  plain for the same reason: one side of the capture has no pane at all.
- **Tabs on an overview.** Also state, not a route, and they already have a sliding
  indicator on `--motion-travel` (`useTabIndicator`).
- **The shared page.** It sits outside `AppShell` on purpose, because a visitor has no
  library behind them, so there is no page it moves from.

## The name budget

`frontend-architecture-guide.md` 2.3 budgets under ten `view-transition-name`s for a whole
app. Five stand: `masthead` and `pane` (`AppShell.module.scss`), `library-filter-sheet` and
`library-filter-scrim` (`LibraryPage.module.scss`), and `overview-image`
(`useOverviewImageMorph.ts`). The library's filter glide adds one per
row for the length of a transition and takes them away again, and drops `pane`'s name while
it runs so a route transition still sees one pane. `PageLink` adds none of its own: it
changes who opens a transition, not what is captured.

## The row becomes the head

Built to designs 170a–170h and the motion prototype (`OV-170 1 The Row Becomes the
Head.dc.html`, `OV-170 2 Phone Panel and the Way Back.dc.html`, `OV-170 3 Motion
Prototype.dc.html`).

**The thumbnail alone carries.** It is the one thing that looks the same on both pages:
the same picture, the same 16:9 crop, and at Small the same size. The title is the
ambitious reading and the design turned it down — it changes size by 2.4×, wraps
differently, and a view transition moves a *picture* of the text, so it would blur and
re-break in flight. The title, byline and verdict fade with the pane and are legible again
within 300ms.

**One name, `overview-image`,** set on the opened row's thumbnail and on the head's image
and nowhere else, which takes the app to five standing names. `useOverviewImageMorph` owns
it. The library's filter glide names whole rows, but only while a filter glides, so the two
never overlap.

**Where it lands.** At Small the head's tile is the row's own size — both are `11rem`,
which design 147s already keeps in step — so the image only travels. Full width grows it to
the reading column at the same crop. The radius goes 12 → 12px at Small, 12 → 18px at full
width, 10 → 14px on a phone; those are each element's own CSS and the stylesheets already
had them.

**The two ends have to agree.** The leaving page decides whether the image carries, and the
arriving page follows: React Router renders the tree being left with the transition already
live and only then captures the old snapshot, so the end that was already mounted is the one
being left. It names itself only if it is on screen, and marks the decision on the root;
the end that appears during the transition names itself only if it finds that mark. Without
the handshake, coming back from a scrolled note would name the row with nothing to pair it
with, and the pane would hold still for a journey that is really 9c's.

Two things about that mark are easy to get wrong, and both were. "Did I appear during this
transition?" has to be asked afresh each time rather than remembered from the first render:
the head arrives during the journey in and is the one being left on the journey back, so a
ref captured at mount makes it follow a decision nobody made and the way back never morphs.
And only the end that wrote the mark may clear it — every other row on the library runs the
same effect as it mounts, and a blanket clear there wipes what the one opened row had just
written.

**The pane holds still while the image travels** and only crossfades. The 10px slide is
dropped for this one journey, because two movements in different directions read as a
stutter. Every other navigation keeps 9c as built — including this one whenever the image
doesn't carry. The timings, from 170h's table:

| | |
|---|---|
| Image, forward | 300ms on `--motion-ease` |
| Overview in | 300ms crossfade, no slide |
| Library out | 180ms crossfade |
| Image, back | 260ms on `--motion-ease` |
| Library in | 260ms crossfade, no slide |
| Overview out | 150ms crossfade |
| No morph | 9c unchanged |
| Reduced motion | Nothing animates |

**The snapshots are not crossfaded.** The old one is hidden and the new one painted at its
own radius for the whole flight, with `height: 100%` and `object-fit: cover` holding the
crop while the box changes. That is what keeps a read row's half-opacity tile from showing
through, and why the image comes up to full on the way. It also makes a mismatch harmless:
an unpaired snapshot is either invisible or simply sits still.

**The way back** morphs only when both ends are on screen — the head's image in view when
Back is pressed, and the row in view once the library's scroll is restored. After a long
note the head has scrolled away, so the common case is plain 9c.

## Where it doesn't carry

Three cases set no name at all, and the journey is 9c as built. The first two are the
design's own (170d, 170e, 170f); the third is a limit of the build.

**No image.** A note without a picture, or one whose picture failed, has nothing for the
row to land on. Both ends read the same `sourceImage`, so they always agree.

**Under 768px — the phone and the panel.** `LibraryOverviewCard` hides its thumbnail below
768px on purpose, because at that width it cannot tell one video from another and it costs
the title its column, so there is no source to carry. This falls out of the row's layout
rather than a viewport gate in `shouldAnimateNavigation()`: the name is set only where the
row has a thumbnail with a box, and a hidden element measures zero. The panel is under 768px
and its head has no image either (147g). In practice the morph runs from 768px up.

**A note that isn't loaded yet.** `ReaderPage` shows a pending state while the record is
read, so on a cold open the transition captures a new page with no head image in it and the
row's name has nothing to pair with. The snapshot recipe makes that harmless — an unpaired
old snapshot is hidden and does not animate — but the image does not visibly travel, and the
pane still crossfades because the row opened the journey. Opening the same note again, with
the record in hand, morphs as designed. Making the reader start from the library's own copy
would fix it, but that is a change to how the note loads rather than how it moves, so it is
left for its own card.

## How it's tested

`pageTransitions.iwft.ts`. A view transition paints into the browser's top layer, so nothing
in the page's own tree records that one ran. `AppShellPageObject` watches
`document.startViewTransition` itself, and keeps two questions apart:

- **Was one asked for at all?** Counted from the calls. That is the whole question for a
  link that was missing the flag, and it is the one assertion that survives a transition the
  next navigation skips.
- **What did it paint?** Read at the transition's `ready`, which settles once the
  pseudo-element tree exists and its animations are built. `verifyImageCarriesAcross` looks
  for the `overview-image` group, and `verifyThePaneKeyframesAre` reads which keyframes the
  pane is playing, which is the only place the dropped slide exists.

Each assertion waits for any running transition to finish first, because React Router skips
one that is still going when the next navigation starts, and a skipped transition never
reaches `ready`.

Sampling `document.getAnimations()` on a `requestAnimationFrame` loop was tried first and is
the wrong tool: the browser throttles rAF to nothing in a backgrounded window, which is most
of them when the suite runs in parallel, so a real transition reads as none at all.
`animationstart` is no use either — it does not fire for view-transition pseudo-elements.

Two of the scenarios need care about what they are really asking:

- The scrolled-note test uses the bar's lent back link (OV-167) rather than the head's own,
  because Playwright scrolls an element into view before clicking it, which would bring the
  head's image back on screen and the morph would run after all.
- The forward-morph test opens the note once before asserting, so that the head is there to
  land on rather than ReaderPage's pending state.
