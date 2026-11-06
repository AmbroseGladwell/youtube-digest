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
app. Four stand: `masthead` and `pane` (`AppShell.module.scss`), `library-filter-sheet` and
`library-filter-scrim` (`LibraryPage.module.scss`). The library's filter glide adds one per
row for the length of a transition and takes them away again, and drops `pane`'s name while
it runs so a route transition still sees one pane. `PageLink` adds none: it changes who opens
a transition, not what is captured.

## How it's tested

`pageTransitions.iwft.ts`. A view transition paints into the browser's top layer, so nothing
in the page's own tree records that one ran; `AppShellPageObject.verifyNavigationAnimates`
watches `document.getAnimations()` for a `::view-transition` pseudo-element, starting the
watch before the navigation because the animation is often over by the time a page object can
see the new page. `verifyNavigationDoesNotAnimate` is the same watch over a shorter window,
and covers reduced motion. `verifyNavigationDirection` continues to hold which journey the
stylesheet was told to play.

## Still open

The library row morphing into the overview's head is the rest of OV-170, and is waiting on
a motion pass in Claude Design. The brief is on the card.
