# The Overview button, in YouTube's own action row

`docs/architecture/architecture-options.md` Idea 16 asked for this on day one — "they
also inject a digest button into the youtube page which we should do" — and design turns
17 and 18 settle what it looks like. Turn 17 puts it in the action row beside Share and
Save, at the native geometry. Turn 18 picks the treatment: **18a**, the native pill with
the mark as the only thing that is ours, and **18c**'s state set on top of it.

## The quietest of the three, on purpose

17a is an accent outline, 17b a solid accent fill, 17c a native pill with a branded mark
— and 17b's own label calls it "loudest, competes with Subscribe". The row already has
one thing shouting in it. 18a is 17c refined: the pill is YouTube's, down to the faint
top-to-bottom lift and the hairline edge, and the orange appears only in the ring mark.

The pill is transcribed from the design rather than approximated, including the two
schemes — with two corrections made against the live site, both on the same principle:
matching the row is the entire argument for this treatment, so where the drawing and
the row disagree, the row wins.

**Height.** The row is **40px** now, where 17 and 18 both draw 36. The radius goes to 20
with it, or a 40px pill reads flatter at the ends than the ones either side of it.

**The two inset lines.** Drawn as given — a 1px top highlight at 90% white over a
hairline edge — the pill was the brightest thing in the action row, which is the
opposite of what the quietest of the three treatments is for. Both are at half the
drawn opacity, the highlight also at half the thickness, in both schemes so they stay
siblings. On dark that leaves the edge at 2% white, which is close to no edge at all;
that is the value to raise if the pill ever needs its boundary back there.

The accent hairline on the **ready** pill is deliberately not reduced with them. There
it is carrying a state rather than describing an edge, and the tinted ground and the
accent label are the only other things saying so. YouTube puts `dark` on `<html>`, so the scheme is `html[dark]` versus
`html:not([dark])` in the stylesheet and there is no theme detection to get wrong or to
keep in sync.

One value in the set is not drawn: the hover on the **ready** pill. 18c draws ready at
rest and 18a draws hover on the default pill, so the ready hover is taken from 18b's
hover on the same accent pill rather than invented.

## Four states, and where each one's facts come from

| State | What it says | Where the fact comes from |
|---|---|---|
| Default | `Overview` | nothing is running and nothing is held |
| Hover | the lifted pill | CSS, not script |
| Generating | `Creating · 0:12`, spinner, a 2px bar | the panel's own run |
| Ready | `Overview ready`, accent pill | the finished run, or the library |

**Hover is CSS.** The reference extension wires `mouseenter`/`mouseleave` to restyle its
button; a `:hover` rule does the same thing without script and keeps working when the
script is busy.

**The clock ticks from the run's own `startedAt`**, which the run measured, rather than
counting up from the moment the button happened to hear about it. A panel opened halfway
through a run therefore shows how long it has really been going
(`docs/prototype/constraints.md`).

It follows that **the press itself starts no clock.** A press shows the spinner at once,
so it does not read as a miss, but with no time against it: nothing has started yet, and
a press can be declined — no keys — or answered by nothing at all. A button counting up
in either case is timing a run that does not exist. Three things end that wait: the
first report, which brings the real `startedAt`; an explicit "no run" from a panel that
declined; and, if neither arrives within ten seconds, the button asking the worker what
is actually true.

**Ready is also what the library knows, not only what a run just did.** 18c draws ready
as the end of a generation, and that alone would leave the button saying `Overview` on a
video already written up — making it a one-press way to buy the same video twice, which
is the exact hazard `docs/features/extension-panel.md` added the capture screen's
"already in your library" for. So the worker answers the button by reading the store as
well as the last run.

**And pressing ready reads that note rather than writing another.** Painting the state
was only half of it: the panel asks the same question again before it starts anything,
because the button is not the only thing that can be out of date — the note may have
been written since the state was painted, in this window or another. Design 17d calls
this "Ready · opens popup", and `overviewForVideoUrl` is the one answer both the capture
screen and this path use. A press on a held video therefore spends nothing at all, which
`injectedButton.iwft.ts` holds by comparing the spend either side of the press rather
than expecting zero: the panel's own caption prefetch for the video in front of it is
not the press's doing (`docs/features/watching-detection.md`).

**Failure is not a state here.** A failed run puts the button back to `Overview`,
inviting another go; the error itself is in the panel, where there is room to read it.
Design 17d draws a fifth state for missing keys and 18c does not, so the button does not
claim to know about keys — pressing it without them lands on Settings, which is what 17d
says should happen.

## Three documents, one conversation

The page, the worker and the panel each hold a piece, and none of them can hold all
three: the content script cannot reach the store or the run, the panel does not exist
until something opens it, and the worker is killed between messages.

```
content script  --request-->  service worker  --opens + queues-->  side panel
     ^                              |                                   |
     `------ button state ----------'  <----------- run report ---------'
```

`app-core` gets one seam for this rather than two, because it is one relationship: the
page asks for a run and then watches the run it asked for. `RunBridge` carries both
directions and the web app supplies none of it, so both halves are absent there — the
same shape as `ActiveVideoSource` and `PlaybackSource` before it. `useRunBridgeExchange`
sits beside the run in `AppShell` rather than on the page a request lands on, because the
panel can be anywhere when the button is pressed.

The request survives in `chrome.storage.session`, not in a worker variable. It is written
before there is a panel to read it, and a worker that is killed in between must not lose
it. A press while the panel is *already* open opens nothing, so the worker also says so
out loud rather than leaving the request until the panel's next mount.

**Opening the panel happens before any of that is awaited.** `chrome.sidePanel.open()`
is only allowed inside the user gesture that produced the message, and the first `await`
in the handler spends it — so the open is started synchronously and the request is
written behind it. That inverts the obvious order, and the nudge above is what covers
the panel mounting before the write lands.

A panel that declines the request — because the note is already held, or because there
are no keys — restates what is true rather than simply not starting anything. Nothing
else would tell the page: the panel may already have been open, in which case no run
changed and no report would otherwise be sent, and the button would keep showing the
press. It restates the *current* run rather than reporting null, because another video's
run may be going at the time and that button should not lose its state to this one's
press.

## What the page gets told, and what it does not

`RunReport` is deliberately narrow: the video, when the run started, its status, the
fraction done, and the id of the note if there is one. Enough to paint 18c. The note
itself never crosses into the page.

## Placing it in a row that keeps moving

The host is `#top-level-buttons-computed` inside the **visible** `#actions-inner`, and
the visibility check is the whole trick: YouTube keeps hidden copies of its responsive
action toolbar in the DOM, so a plain `querySelector` hands back a 0×0 one and the button
lands somewhere nobody can see. That, and the fallback selector list, are taken from the
reference extension, which carries the scar in its own comments.

Three things trigger a reconcile: YouTube's own `yt-navigate-finish`, a `resize` (the
visible row changes at its breakpoints, which can strand the button in a copy that is no
longer on screen), and a `MutationObserver` as the safety net for the row arriving later
than the navigation event. The observer bails immediately while the button is connected
and the video has not changed — the reference reschedules a timer on every mutation of a
page that mutates constantly, which is work for nothing once the button is placed.

## Two builds, because a content script cannot be a module

The rest of this extension is ES modules, and MV3 content scripts are classic scripts.
Rather than make everything classic, `vite.content.config.ts` is a second build in IIFE
form with the content script as its only entry, and the page build keeps owning
`dist/`. The bundle is around 7 kB and imports nothing at runtime.

That boundary is also why `elapsedLabel` exists here instead of app-core's `formatClock`:
everything in that package reaches the page through an index that starts at React, and
four lines on this side beats pulling React into every YouTube page — or a shared package
for one clock.

## A correctness fix this pulled in

Adding an `onMessage` listener to the worker changed what happens to a message nobody
answers, and the playback reporter was using exactly that as its signal to stop
(`docs/features/following-playback.md`). It now counts unanswered sends and gives up
after five, with the panel acknowledging each one explicitly — a signal that does not
depend on which of the extension's listeners happen to be alive.

## Measured against the reference

`zarazhangrui/youtube-digest` injects the same kind of button and opens the same kind of
panel, so it is worth saying what it settles and where the two differ on purpose.

**The gesture rule is real, and this is the fix.** Its background script carries the
warning in as many words — "we call setOptions + open synchronously (no await between
them) to preserve the user gesture context. Chrome requires sidePanel.open() to be
called within a user gesture — awaiting anything first can expire it." That is exactly
the fault that was here, and exactly the shape of the correction. Nothing about the open
should be moved behind an `await` again.

**It opens the panel per tab; this one opens it per window.** `open({ tabId })` gives a
panel scoped to one tab, which is what that extension wants — it enables the panel on
YouTube tabs and disables it everywhere else, so the panel is a YouTube-only tool and
its own `setOptions({ enabled: true })` before each open exists to undo that disabling.
Ours is `open({ windowId })` and is meant to be: the panel belongs to a window and
follows the tab in front of it, which is the whole of
`docs/features/watching-detection.md`. A tab-scoped panel would give each tab its own
instance and there would be nothing left for the active-tab source to follow. Neither of
us needs `setOptions`, for opposite reasons.

**How the press reaches a panel that did not exist yet.** Theirs broadcasts
`startDigestFromButton` 300ms after the open resolves, which is a race with the panel
mounting and its listener attaching. Ours writes the request to `chrome.storage.session`
and the panel reads it as it mounts, so there is no window to miss; the broadcast is
kept only for the case their timeout cannot help with either — a panel that was already
open, where `open()` does nothing and no mount follows. Worth knowing before anyone
simplifies the persistence into a timer.

**One thing of theirs not worth copying.** When `sender.tab` is missing it falls back to
`chrome.tabs.query` and opens against the result — but that is an await, so the gesture
is gone by the time it calls `open()`. It would fail in exactly the case it exists for.

## Where this departs from the file

- **The button goes at the end of the native group**, where 17a–c draw it between Share
  and Save. Targeting a position relative to Share means matching a localised label or an
  element YouTube is free to rename; the end of the visible group is the same row, the
  same geometry, and does not break when they do. The reference prepends instead, which
  puts it ahead of Like — louder than 18a is trying to be.
- **No missing-keys state on the button.** 17d draws one with a tooltip; 18c, which is
  the set that was asked for, does not. The behaviour it describes is built — a press
  without keys opens Settings and spends nothing.
- **The failed run is not drawn** — see above.
- **40px tall, not 36** — see above. Worth knowing that this is a constant and will
  drift again the next time YouTube retunes the row; matching a native sibling's height
  at runtime is the alternative, and was not built because measuring the wrong sibling
  (a hidden copy, or the segmented like/dislike pair) fails in ways a constant does not.

## What this does not do

- **Tell the button anything while the panel is closed.** Nothing reports a run that is
  not happening; a run only exists while the panel is open, which the panel itself says
  (`docs/features/extension-panel.md`).
- **Inject anything on a page that is not a watch page**, or leave the button behind when
  you navigate off one.
- **Get tested end to end.** `docs/conventions/frontend-testing-guide.md` puts the
  extension's `chrome.*` surface outside the IWFT harness and that harness still does not
  exist. What is testable is tested: the state mapping and the clock are unit tests, and
  the whole `app-core` half of the bridge — the press starting a run, the keyless press
  landing on Settings and reporting no run, the reports going back — is an IWFT driven
  through a simulated bridge. The DOM placement, the worker's relaying and the
  gesture-sensitive `sidePanel.open()` are held up by reading alone; the last of those in
  particular has a history of Chrome-version-dependent behaviour and is the first thing
  to check by hand.
