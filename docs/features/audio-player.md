# The audio player

What was built from `Player.dc.html` (Claude Design project, OV-40): the reader's bar plays
a note's narration, the highlight follows the renderer's measured timings, and the pacer
remains for every case where there is no narration, marked as the pacer. The narration
itself — Kokoro, the queue, R2 — is `tts-pre-rendered-speech.md`.

## The calls the design made first

The card left five questions open, and the design answered them before drawing any state:

- **The player lives in the app shell.** Leaving a note keeps it playing, and a mini-player
  docks at the foot of every other page (3a). Listen on another note replaces what is
  playing; × stops.
- **◀◀ and ▶▶ are ±15 s**, matching the lock screen and headphones. Line stepping moved to
  the text: tap a line, or press `[` and `]`.
- **Listen plays in place everywhere.** The library row plays and brings up the
  mini-player; the reader's Listen and the panel's Listen play without navigating.
- **Signed out, Listen still does something:** it starts the pacer, tagged, with a
  "Sign in for audio" link. Nothing is blocked.
- **The Plus prompt on the panel's Listen (16a) is retired.** Audio needs an account, not a
  plan. See "What changed about Plus" below.

## Where it lives

`packages/app-core/src/features/player/`:

- **`PlayerEngine`** is one plain class for the whole app: the `<audio>` element, the pacer's
  clock, asking for and polling a render, and every fallback. It has no React in it, which
  is what lets `PlayerEngine.test.ts` drive every state with a fake element and fake timers.
- **`PlayerRuntime`** builds it once, above the router and inside the sync runtime, because
  narration needs the account's session and a note has to outlive navigation. It hands the
  engine a new narration client when the reader signs in or out.
- **Two subscriptions, split by frequency** (`frontend-architecture-guide.md` 4.2): the
  snapshot changes a few times a note, the clock several times a second. `usePlayerLine`
  subscribes to both but only re-renders when the line changes, so the note's tint does not
  repaint on every tick.
- **`playerBarView`** is a pure function from the snapshot and the clock to what the bar
  says: the label, the clocks, the middle button, the track, the ways out. Every state in
  the design is one branch of it, and each has a unit test.

The bar itself is still `ReaderPlayerBar`, rewritten to draw that view. The web reader's
floating card and the panel and phone layout are one DOM order with two sets of grid areas,
as before.

## Which note the bar is about

The reader's bar is always about the note on screen, while the player holds at most one
note. `useNotePlayer` reconciles the two:

- **Nothing is playing:** opening a note loads it straight away, idle. That is what lets the
  bar say whether its audio exists before anybody presses play (1a against 1b).
- **Another note is playing, preparing or paused:** opening a note does not take the
  player over, and the other note stays in the mini-player. This note's bar shows a preview
  ("Listen · Heart voice", with an estimated length), and keeps its own reading mark.
  Pressing play here loads this note from that mark, replacing the other.

The mini-player is absent on the playing note's own reader, whose bar says all of it. It
publishes how much of the window's foot it covers as `--mini-player-clearance`, and the
reader's bar and the shell's pane sit above that, so neither is hidden under it.

## Asking whether narration exists without making any

The key a render is stored under is SHA-256 over `[renderVersion, voice, lines]`. That
recipe moved into `@overview/domain` (`narrationKeySource`, `narrationKey`) so the client
can compute it with WebCrypto and ask `GET /api/audio/:key`. A 404 means nobody has asked
for it, and nothing is queued by asking. `apps/api`'s `audioKey` hashes the same source with
`node:crypto`, and `audioKey.test.ts` fails if the two ever disagree.

Pressing play on a note with no narration posts the script with `interactive` priority,
then polls every 1.5 s. The server's only two facts while it waits are `queued` and
`rendering`, so that is all the bar says (1c). There is no percentage, because nothing
measures one (`docs/prototype/constraints.md`).

## A note just made

A note generated while signed in asks for its narration as soon as it is saved, so that by
the time anybody opens it the audio is usually there (1a rather than 1b). Generation runs in
the browser on the reader's own key, so "proactively" can only mean the client asking.

- **The player asks, not the pipeline.** `useGenerateOverviewMutation` hands the saved note to
  `PlayerEngine.prepare`, which posts the same script and voice the reader will later play,
  with `background` priority. The engine is the one place that holds the account's narration
  client and the voice, so the key it asks under is the key the reader will peek at.
- **Nobody waits on it.** It is not polled, it changes nothing the bar shows, and the run's
  steps have no audio step. A refusal of any kind — 429, 503, no connection, a session that
  ended — is dropped: the note is already saved, and a first play will ask again.
- **Signed out, nothing is asked.** The note renders lazily on its first play after signing in.
- **Pressing play overtakes it.** An interactive request for the same key promotes the
  waiting background render rather than queueing a second one
  (`tts-pre-rendered-speech.md`, "The API side").

## A note opened before its audio lands

From `OV-44 Preparing.dc.html` (OV-44). The peek on opening a note used to count only
`ready` as news, so a note opened while its background render was still going said "Audio
is made on first play", which was untrue. Now a peek that finds the render `queued` or
`rendering` sets availability `preparing` (44a, 44b). The status stays `ready`, because
nobody has asked to hear it.

- **The bar borrows 1c's label and sweep** ("Preparing audio · Queued" or "Rendering"), but
  the main button stays **Play**: there is nothing to cancel, because nobody asked. The
  right-hand figure is the estimated length ("~6 min"), as in 1b, not 1c's "Usually under
  20 s". Nobody is waiting yet, so a wait estimate would read as a promise.
- **The engine watches it slowly**, every `WATCH_INTERVAL_MS` (5 s) rather than the 1.5 s of
  an interactive wait, until the render is `ready` or `failed`, or the track changes. It
  gives up after two minutes (`WATCH_GIVES_UP_AFTER_MS`), because the player keeps its track
  when the reader leaves the note, and nobody should be polling on a render forever.
- **It lands quietly.** A `ready` render is adopted and the bar becomes 1a, "Narrated · Heart
  voice". Nothing plays by itself.
- **Play at any point is 1c exactly.** The request goes out `interactive`, which promotes the
  waiting render, the button becomes Cancel, and the audio plays when it lands.
- **Failure is quiet.** A `failed` render, three checks in a row that could not reach the
  server, or two minutes without it landing, drop back to 1b without a message, and a press then asks again. These checks never
  count towards 1i, which is for a wait somebody chose.
- **Cancelling a 1c wait peeks again.** The render carries on without anybody waiting for it,
  so the bar goes back to saying what the server has, usually 44a, rather than 1b. If that
  peek fails, the bar rests at 1b rather than declaring narration unavailable (1l); only a
  401 turns it into the signed-out pacer.

**A departure from `Player.dc.html`:** OV-40's design never pairs "Preparing" with Play as
the main button. OV-44's design does, on purpose, for the render nobody here asked for.

**Measuring it.** The API logs every `POST /api/audio` as "audio requested", with its
priority and what it found (`found`, `foundPriority`). A first play that caught a new note's
render unfinished is an `interactive` request that found a `background` render `queued` or
`rendering`; the new notes are the `background` requests that found nothing. A first play
that found the audio ready never posts, so it is read as the difference, which also counts
notes nobody has played yet as ready.

## The states

| Design | When | What the bar does |
|---|---|---|
| 1a | narration exists, nothing pressed | "Narrated · Heart voice", its real length, skip and seek off |
| 1b | narration not made yet | "Audio is made on first play · about 20 s", an estimated length |
| 44a/44b | a render nobody here asked for is under way | "Preparing audio · Queued/Rendering", a sweep, an estimated length; the main button plays |
| 1c | asked for, waiting | "Preparing audio · Queued/Rendering", a sweep; the main button cancels |
| 1d | still waiting after 45 s | "Still preparing", and "Read along meanwhile" |
| 1e/1f | playing, paused | the section, elapsed and time left, a thumb, notches at section starts |
| 1g | the network stalls mid-play | "Buffering", the clock holds, the main button still pauses |
| 1h | the end | "Finished", Play again, Mark read unless it already is |
| 1i | the render gave up | warning ink, Try again, Read along instead |
| 1j | 429: three renders already waiting | the reason, and Read along; nothing was queued |
| 1k | signed out | the pacer, tagged, "Sign in for audio" |
| 1l | 503, or no connection | the pacer, tagged, "narration is unavailable right now" |

"Read along meanwhile" (1d) starts the pacer and keeps polling. When the narration lands it
takes over at the line the pacer reached, playing if the pacer was playing and paused if it
was not.

The failed state is only declared when the server says `failed`, after its own three
attempts. Three polls in a row that fail to reach the server count as a failure too, rather
than preparing forever. A 401 at any point is signed out, not a failure.

## The pacer

It is the read-along that existed before, now built on the same clock: line starts
estimated from the words (`estimatedLineStarts`, the same arithmetic as the reader's
"6 min listen"), advanced four times a second at the chosen rate. It says so wherever it
shows: a stone-tint "Read-along · no audio" tag, a stone fill rather than orange, and every
time written with a ~. It has no thumb or notches, because its times are not somewhere a
listener can seek to.

## The note follows the voice

The page scrolls itself only while the note is being read aloud, and the three states of
that are the whole of it.

**Silent.** A note nobody is listening to is left exactly where it was opened. It was not:
the read-along scrolled the line it had marked into the top third on mount, so every open
of every note jumped the page down past the masthead to the premise before the reader had
asked for anything. Tapping a line, scrubbing while paused and stepping with `[` and `]`
move the reading mark and nothing else.

**Following.** From the first press, and from the first render of a note opened while it
is already being read — the one time the page is right to move on its own, since the voice
is somewhere the reader cannot see. The line being spoken is kept in the top third, and a
line already resting there is left alone (`docs/features/stone-theme.md`, "Highlighting").

**Scrolled away.** Reading ahead, or back, is the reader taking the scroll over: the
following stands down and a `● Back to Key points` pill rises above the player bar, naming
the section the voice is in rather than a time, which is what the transcript's way back
names. Pressing it follows again, and the same press scrolls back.

The detection is the transcript's, and so is the thing that buys it: an
`IntersectionObserver` on the spoken line, asking only whether it is still on screen,
which works because the follow scroll is **instant rather than smooth**. The read-along's
scroll used to be eased, and the ease is what had to go — a smooth scroll is still in
flight when the observer first reports, and the line it is travelling towards is off
screen while it travels, which reads as the reader taking over one frame after the voice
moved (`docs/features/following-playback.md`, "Following, and stopping following"). The
per-sentence calm the ease was for comes from the resting rule instead, which is what
keeps most lines from scrolling the page at all.

The follow belongs to the note, not to the reader: stepping to the next overview starts it
following again, because the component is keyed by the overview it is showing.

## iOS and the lock screen

- **Starting sound after a wait.** iOS only lets a page start audio inside a tap, and a
  render lands after the tap is over. On the first press the engine starts the element on a
  tenth of a second of generated silence (`silentWavDataUri`), and swaps in the narration
  when it arrives. If the browser refuses anyway, the bar rests as paused rather than
  claiming to play.
- **MediaSession** (`bindMediaSession`): title, channel, "The Overview" as album, and the
  video thumbnail as artwork. Play, pause, stop, seek to, and seek backward or forward by
  15 s. The previous and next track handlers are cleared on purpose: iOS shows skip buttons
  only when there are no track buttons to show instead. The position is reported on every
  state change and every five seconds while playing. The pacer has no media element, so it
  never appears on the lock screen.

**Not yet verified on a device.** Playing with an iPhone locked is the card's first line of
done, and nothing automated can show it.

## What changed about Plus

The panel's Listen made the case for Plus instead of playing (`plus-upsell.md`, 16a). The
design retires that prompt, and `PlusPrompt` is deleted. Audio now needs an account rather
than a plan, so two pieces of copy that sold it as Plus were corrected:

- `PLUS_FEATURES` no longer lists "Audio playback of any overview".
- The saved-locally note (16b) no longer says Plus "unlocks audio overviews".

OV-104 finished the same correction: sync and the MCP connection turned out to belong to
the account too, so Settings now sells the paid plans on how many overviews a month they
make (`docs/architecture/tiers.md`, `plus-upsell.md`), and `PLUS_FEATURES` is gone.

## Accessibility

- The label line is the bar's only live region. The clock beside it is deliberately
  outside it, or a screen reader would announce the time four times a second.
- The scrubber is a slider while something plays: arrows move five seconds, Home and End go
  to either end, and its value text names the time and the section. It is a progress bar
  when it cannot seek, and an unvalued one while preparing.
- The middle button's name follows its job: Play, Pause, "Pause, buffering",
  "Cancel preparing audio", Play again. It stays "Play" through 44a, whose change to 1a is
  heard through the label's live region.
- `[` and `]` are ignored while focus is in a field.
- Reduced motion stops the sweep where the design draws it, and stops the spinners.

## Testing

- **Unit:** `lineAtTime.test.ts` (time to line, and the drag's snap), `playerBarView.test.ts`
  (every state's words), and `PlayerEngine.test.ts` (every path between them, on fake
  timers). The timings in the first are shaped the way `services/tts` renders a note. They
  are not a capture of a real note from production, and swapping one in would be worth it.
- **IWFT:** `audioPlayback.iwft.ts`, against narration routes in `BackendSimulator`. Headless
  Chromium cannot decode the M4A the service makes, so the simulated file is silent 8-bit
  WAV of the render's length, served with byte ranges. Without ranges the element cannot
  seek, which the first run of these scenarios showed. `narration.finishRenders()`,
  `failRenders()` and `accountIsBusy()` move a render between states from the test.
  `followTheVoice.iwft.ts` holds the three states above: the open that must not scroll,
  the open while playing that must, and the read ahead that hands the scroll back. The
  first watches for a scroll rather than taking one reading afterwards, because the scroll
  it is about happened a frame after the note rendered.

## Left out, or not yet read

- **The design file was read only to 3a.** The design tool returns a file up to 256 KiB, and
  `Player.dc.html` is larger, so the rest of section 3 (the mini-player on other surfaces)
  and the lock-screen frame were not seen. The mini-player follows 3a and the decisions in
  the project's `DECISIONS.md`. On a narrow screen it keeps play and × and drops the skips.
- **The voice is named, not chosen.** The ready state says "Heart voice". It becomes a link
  when the voice setting exists.
- **Starting before the whole note is rendered** is OV-42.
