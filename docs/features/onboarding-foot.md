# The onboarding foot

What OV-210 built from designs 210a–210k (`OV-210 1`–`8` in the Claude Design project), and
where the build departs from them.

## The problem

Every onboarding step put its actions at the foot of its column with `margin-top: auto`. That
is the foot of the column, not of the screen, so once a step's content grew past the window
the whole page grew with it and Continue went below the fold. Topics (after OV-176's
suggestions) and voice (fifteen voices) were the two that showed it, on a phone and on the
web alike.

## What was built

**Below the brand row, one area scrolls.** `OnboardingPage` is the window's height
(`100dvh`), and `.layout` under the brand row is the scroll area, on every width. On a phone
it holds the step alone; from 64rem it holds the flow column and the preview beside it, so
the page still has one scroll, and the wheel, the scrollbar and keyboard paging work as they
did. Each new step starts at the top of it.

**The foot is pinned on every step.** The `foot` mixin in `_onboarding.scss` makes it
`position: sticky; bottom: 0`, on the ground, keeping `margin-top: auto`. Because it is
sticky and in flow, a step that fits looks as it did, and a step that runs on ends where the
foot begins, so nothing can sit behind it. That answers the card's open question: always
pinned, not only when the content overflows, so the flow keeps one shape. The fix is in the
mixin and the page rather than in the two screens that showed it, so the next step to grow
is covered too.

**Its top edge is OV-166's fade, mirrored**: 16px of ground rising from the foot, shown only
while there is content under it. It arrives the same two ways OV-166's does
(`fade-under-the-bar.md`): a scroll-driven animation that thins it to nothing over the last
24px of scroll, and, where scroll timelines are missing or motion is reduced, a sentinel at
the end of the step (`useContentBelow`) that puts `data-content-below` on the page while the
end is out of view.

**The stepper sticks at the top.** Back, the segments, Skip, and on a phone the progress line
above them, form one band at the top of the scroll area. It carries `data-sticky-fade`, so
OV-166's fade hangs under it once the step has scrolled, and the page renders its own
`PageScrolledSentinel` inside the scroll area for the fallback.

**Measures.** On a phone the foot is 12px above the button and `max(12px,
env(safe-area-inset-bottom))` below, so it clears the home indicator. It reaches the screen's
edges through `--onboarding-gutter` and cancels the column's bottom padding through
`--onboarding-end`, both set on `.main`. From 64rem it is 14px above and 24px below, 40px
wider than the column each side (the whole gap to the preview), and its ground and fade run
the full width of the window behind it, under the preview, so an open card's shadow never
meets a band's edge. The button keeps its 10rem minimum, left.

**The preview never moves.** Its `top` is its own starting offset (the layout's top padding
plus its drop to the heading), so it is held where it starts and only the flow column
scrolls beside it.

**Typing a topic.** On a touch screen (`pointer: coarse`) the foot is hidden while the
add-a-topic field has focus, since the keyboard already takes half the screen and on iOS a
pinned bar sits behind it or floats over the field. Pick, or return, is the action while
typing, and picking keeps the field focused for the next one. The foot is back on blur, with
no transition. With a mouse or a hardware keyboard nothing changes.

**Written for you.** On a wide screen an open section's card scrolls under the foot, and
opening one scrolls just enough to bring its Done above it (`scrollIntoView` with
`block: "nearest"`, against the scroll area's `scroll-padding-bottom`). On a phone the section
is a modal sheet over the whole screen, foot included, as in 141.

**Focus.** Order is unchanged and Continue stays last. The scroll area's `scroll-padding`
keeps anything focused clear of the stepper and the foot.

## Two things worth knowing

- **Chrome sticks an element inside its scroll container's padding.** The wide layout used to
  carry 0.5rem above and 3rem below as padding on `.layout`; as the scroll area, that held
  the foot 48px off the window's bottom with content showing beneath it. The spacing now
  lives on `.main` and the preview instead, and `verifyFootSitsOnTheWindowsEdge` holds it.
- **The page no longer scrolls; `.layout` does.** Anything that reads or sets
  `window.scrollY` on onboarding will see nothing move.

## Departures from the design

- **The panel takes the phone's measures**, 12px above and below, where 210e draws 10 and 14.
  Nothing in the stylesheet tells the panel from a phone, and the difference is 2px.
- **The brand row stays above the scroll area on a phone.** The phone frames draw no brand
  row; the page has always had one, and it does not scroll.
- **The phone's stepper carries OV-166's fade too.** The phone frames put the stepper outside
  the scroller and draw a plain edge; as a sticky band it follows the app's rule that every
  band over content carries the fade.
- **The scroll area's `scroll-padding-top` is 7rem on a phone**, enough for the stepper with
  the progress line above it, which at 200% zoom is 108px tall. Without the line it leaves
  more room than needed, which only means a focused element rests a little lower.

## Still open

Test the keyboard rule on a real iPhone and a real Android phone. Device emulation does not
reproduce how a pinned bar behaves above the on-screen keyboard.

## What the tests hold

`onboardingFoot.iwft.ts`: on a phone Continue is on screen on arrival at topics and at voice
without scrolling, the foot sits on the window's edge with its fade shown, the fade goes at
the end, and the count and the last voice come clear of the foot, which can then be chosen;
a step that fits shows no fade and doesn't scroll; on a touch screen the foot stands aside
while a topic is typed and Pick keeps the field; at 200% zoom Continue is on screen on
arrival; on a wide screen the preview stays put while the flow scrolls, the stepper carries
the fade, and nothing scrolls sideways; and opening a section of the sentence brings its
Done clear of the foot.
