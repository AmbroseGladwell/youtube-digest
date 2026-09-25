# The transcript follows the video

`docs/features/transcript-storage.md` parked three things: jumping to the video from a
block, following playback, and highlighting the watch-it-anyway range. This does the
second, and the reason it was parked is the reason it took a new permission to build:
until now nothing in this extension read the page.

## The position is measured, or it is missing

`docs/prototype/constraints.md` produced the project's worst bug by letting something
estimate a number. A transcript that scrolls itself is a claim about where the video is,
so there is exactly one acceptable source for that claim: the `<video>` element's own
`currentTime`. Nothing here interpolates, extrapolates, or keeps a clock running between
reports. When the player has not reported, no block is marked and the transcript is the
same list of paragraphs it was before.

## A second capability the shell injects

Structurally identical to `ActiveVideoSource`, and for the same reason — `app-core`
cannot reach the tab:

```ts
interface PlaybackPosition { videoId: string; positionMs: number; playing: boolean }

interface PlaybackSource {
  subscribe: (onChange: () => void) => () => void;
  getPosition: () => PlaybackPosition | null;
}
```

The side panel passes `chromePlaybackSource`; the web app and the extension's full page
pass nothing, and `useCanFollowPlayback()` is false there, so the indicator, the mark and
the `↓ Follow playback` button are all simply absent. That is `CLAUDE.md`'s
degrade-visibly rule, and it is why the web reader needed no flag and no branch.

`usePlaybackPosition(videoId)` returns null for a report about a *different* video as
well as for no report at all. The panel can be beside one video while the reader shows a
note about another — following someone else's timings would be a measurement that is
quietly wrong rather than visibly missing.

## What now touches the page, and how little

`docs/features/watching-detection.md` used to say "there is no content script and no host
permission for youtube.com — nothing here reads or touches the page itself." That is no
longer true, and the change is worth stating plainly.

The manifest now carries `scripting` and host permissions for `www.youtube.com` and
`m.youtube.com`. There is no declared content script: the panel calls
`chrome.scripting.executeScript` against the active tab when it opens and whenever that
tab changes, so nothing is injected into a YouTube page that is not currently in front of
an open panel.

The injected function is deliberately the smallest thing that works. It finds the page's
main `<video>`, reads `currentTime`, reads the video id out of `location.search`, and
posts those back over `chrome.runtime.sendMessage`. It sets nothing, clicks nothing and
reads no other part of the DOM.

`video.html5-main-video`, not the first `video` on the page. A watch page holds more than
one — an ad, a hovered preview — and the first is not reliably the one being watched.
That class is YouTube's own, so there is a fallback to the first `video` for the day it
is renamed.

`timeupdate` fires about four times a second, which is more re-renders than a scrolling
paragraph needs, so ordinary ticks are throttled to 400ms. `play`, `pause` and `seeked`
are sent immediately — those are the moments where a stale position is visible.

**One report is always sent the moment the function runs**, before any of that, and it is
the one thing a push-based reporter cannot do without. A paused video emits no
`timeupdate`, so a panel opened on a video the reader had stopped — or returning to a tab
it had already instrumented — would show nothing at all until somebody pressed play. The
`window` flag that stops a second injection stacking a second set of listeners guards
only the listeners, never that first report.

**The reporter takes itself down** when nobody is listening any more, which is what
happens when the panel closes or leaves the Transcript tab. Without that it would post
into nothing every 400ms for the remaining life of the page. A later injection puts it
back, which is why the flag it clears is the teardown function itself.

That it has stopped being listened to is *counted*, not inferred from the send failing.
Whether an unanswered `sendMessage` rejects or resolves depends on which of the
extension's listeners happen to be alive, and the worker grew one when the injected
button arrived (`docs/features/injected-button.md`) — which would have silently kept the
reporter running forever. The reader acknowledges each report explicitly instead, and
five unanswered sends in a row, about two seconds, is the reporter's cue to stop.

A declared content script was the alternative and was rejected on build shape as much as
on permissions: MV3 content scripts are classic scripts, the rest of this extension is
ES modules, and adding a second Rollup pass to emit one file in a different format is a
lot of machinery for something `executeScript` does in a function.

## Following, and stopping following

Two states, and the transition between them is the whole design (15e).

**Following.** The block containing the reported position carries an accent edge and the
faintest wash — not a fill, because the words have to stay the same weight as every other
block for the page to still read as prose. The panel says `● Following the video` above
the list, and the current block is scrolled to the middle of the viewport.

**Scrolled away.** Reading ahead, or back, is the reader taking the scroll position over,
so the following stands down and `↓ Follow playback` appears at the foot to hand it back.

That is detected with an `IntersectionObserver` on the current row rather than by
watching scroll events: a scroll listener cannot tell our own scrolling from the
reader's, and every way of marking one as programmatic races the other. The observer
only has to answer "is the marked block still on screen", which is the actual question.

For that to work the follow scroll has to be **instant, not smooth**. A smooth scroll is
still in flight when the observer first reports, and the row it is travelling towards is
off screen while it travels — which the observer would read as the reader taking over,
one frame after the video moved. This is the one place in the app where a movement is
deliberately not eased.

Searching stands the following down too, for the same reason and without waiting for a
scroll: a search jumps to its current hit, and two things moving the same list is a
fight. Pressing `↓ Follow playback` clears the search and resumes.

## Measured against the reference

`zarazhangrui/youtube-digest`, the extension `docs/architecture/architecture-options.md`
cites for this idea in the first place, has had this feature for longer. Four places
where the two differ, and which way each one falls:

**Push versus poll.** It polls `currentTime` every 500ms through two message hops — panel
to background to content script — for as long as the transcript is open, whether or not
anything is playing. We are pushed to on the player's own events. Ours is cheaper and
lands a seek immediately rather than up to half a second later; its advantage is that a
poll re-establishes itself after anything that could have broken the pipe. Two of the
things a poll would have papered over were real holes in ours and are fixed above: the
paused video that emits no events, and the tab returned to. What remains covered without
polling is YouTube's SPA navigation, because the listeners are on `document` rather than
on the element, so a swapped-out `<video>` changes nothing.

**How manual scrolling is detected.** It listens for `scroll` and ignores anything within
1000ms of its own programmatic scroll, timestamped before the call. That is a heuristic
with a failure on each side: a reader who scrolls inside that second is ignored, and a
smooth scroll that runs longer than it disengages the follow on its own animation. Its
code says as much — the constant exists because "smooth scroll animations can last longer
than a simple boolean flag". We ask the narrower question instead, with an
`IntersectionObserver` on the marked row: *is it still on screen*. No timer, and no way
for our own scroll to be mistaken for the reader's — which is what buys the instant
scroll described above.

**Whose clock it is.** Its content script answers `getCurrentTime` with a bare number and
no video id, so a panel showing one video's transcript beside a tab that has moved to
another will happily mark the first transcript with the second video's clock. Every
report of ours carries the video id it was measured from and
`usePlaybackPosition(videoId)` drops the ones that do not match.

**The one it does better.** It remembers where you had scrolled to per video, in
`chrome.storage.session`, capped at the twenty most recent, and when it restores that
position it starts with following *off* and the button already showing — so coming back
to a transcript you were reading ahead in does not yank you to the player. We have no
reading-position memory at all. That is a genuinely good idea and is not built; it is a
feature in its own right rather than a detail of this one.

It also has a bug we do not, worth recording because the shape of it is easy to
reintroduce: its highlight step early-returns when the row is already highlighted, to
avoid DOM thrashing, which meant pressing `Follow playback` while the current line was
already marked — nearly always — scrolled nowhere and looked broken. Ours scrolls off an
effect that takes `following` in its dependencies, so re-engaging always scrolls whether
or not the marked row changed.

## One thing that writes to the player

Following is otherwise one-way — the panel reads the player and never touches it — and
seeking is the single exception, first for the watch-it-anyway range and since for a
transcript block's time and a chapter's range (`docs/features/chapters.md`).
`PlaybackSource` grew `seekTo`, which injects a function that sets `currentTime` on the
main `<video>` and reads nothing.

The distinction that makes it safe is not the size of the write but who asked for it:
this only ever runs from a press on a control the reader can see, pointed at a moment
the model was given rather than one it invented. `startMs` comes from the same caption
timings everything else here is built on (`docs/features/overview-redesign.md`).

Where it appears is deliberately narrow. The button is drawn only when a player is
reporting **and** it is playing the video being read, which is `useSeekPlayback`'s whole
job — the web app has no player to move, and a panel whose tab has wandered to another
video would otherwise offer to skip the wrong one. The range beside it is printed
regardless, because reading it is how someone gets to the moment on their own, and that
is the half of this that works everywhere.

It sits under the watch-it-anyway paragraph by sitting after the note, which holds only
because that is the last section `overviewNoteLines` builds. A unit test pins that
ordering rather than leaving the placement to depend on something nothing checks.

The transcript's times are the second place that writes, and the same rules hold: only
the time is a control, never the paragraph around it, and only where a player is playing
this video. Clicking one does exactly one thing — it moves the video. Whether the
transcript then follows is a separate question with its own control, so a time pressed
while the following is stood down leaves it stood down; `followPlayback.iwft.ts` holds
that, because quietly re-engaging would yank a reader who was deliberately reading
ahead.

## What this does not do

- **Open YouTube in a new tab from a block.** The transcript's times move the video that
  is already there instead. These rows were links to `youtubeTimestampUrl` for one commit
  and that is what `docs/features/transcript-storage.md` reverted.
- **Work on a YouTube tab that is not the active one.** The panel belongs to a window and
  follows that window's front tab, which is the same rule `chromeActiveVideoSource`
  already follows.
- **Move the read-along.** That still paces the *note* at a spoken-word rate; the
  transcript now paces the *video*. They are two different clocks and neither is
  pretending to be the other.
- **Remember where you were reading.** See the reference comparison above — it does, we
  do not, and it is the one thing there worth taking.
