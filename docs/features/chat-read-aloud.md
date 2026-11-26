# Chat read aloud

OV-418 (raised 25 Nov 2026). Any chat answer can be read aloud in the reader's narration voice
(`NarrationVoice`, `narration-voice.md`), with pause, resume, replay and stop, sentence by
sentence so the first plays while the rest render. It reuses the Kokoro pool that narrates
overviews (`tts-pre-rendered-speech.md`), and no chat audio is kept on the server.

Three PRs on the one card:

1. **The speech version** of an answer (built).
2. **The live lane** in the API: an in-memory queue beside `AudioRenderQueue` with one pool
   slot reserved for it, and the endpoint that streams each sentence's audio (built).
3. **The player and the controls**, built to the design round's hand-off
   (`design_handoff_ov418_read_aloud/`, pages 418a to 418t).

## Decided (owner, 25 Nov 2026)

- **Listening spends chat usage**, at what each play really cost, on every plan, Free
  included. Replays too: nothing is stored, so each play is a new render. There is no
  allowance of its own, no daily play cap and no replay limit, because the chat allowance
  already bounds all of it: a reader's most expensive month stays their chat allowance.
- **Free keeps read aloud.** Free has every feature (OV-78); listening uses its usage faster,
  and running out meets the usual upgrade prompt.
- **Allowances are unchanged** until real plays show whether "about N typical questions" still
  holds for readers who listen.
- **Warm the voice only on intent**: when the reader focuses or hovers a Read aloud control,
  never on opening a chat, because an unused warm-up still spends usage.
- **The controls**: a play control at the top and the bottom of each answer, since a
  frequent listener starts from the beginning. The design round settled where (26 Nov, "The
  controls" below).
- **The chat allowance is never mentioned in the conversation** (design 418m-2): Settings'
  chat row says "Listening to an answer uses some too", and the meter moves after a play.
- **/terms and /privacy changed with PR 3** (legal-pages.md, 26 Nov).

## The speech version

`spokenAnswer(answer)` in `@overview/domain` turns a stored answer into the sentences that are
spoken, in reading order. It is code, never a model, and the API and the app both call it, so
the sentence the app highlights is the one the voice is saying.

**What is read.** An answer in sections reads its intro, then each section's heading,
paragraphs, numbered items and bullets, then the takeaway. Sources and their chips are not
read. An answer without sections reads its `text`.

**One sentence per line.** Each field is split into `answerBlocks`, and each paragraph into
sentences by `sentenceSpans`, the splitter recipes already use for a step's actions: a full
stop, question or exclamation mark followed by a capital, a digit or inline code, ignoring
"e.g.", "approx." and decimals, with an aside in brackets kept with the sentence before it.
A sentence may open or close inside bold or italic marks.

**Read as speech, not as shown.**

- A fenced code block is "There's a code example on screen."
- A table, however many rows, is "There's a table on screen." The prompt allows no tables, but
  a model may still write one.
- A link reads its words; a bare address is dropped, and a sentence that was only an address is
  not read.
- Bold, italic and inline-code marks go; their words stay.
- A heading, a list item and a line that once held a list or heading marker (`## `, `- `,
  `1. `, `> `) is a sentence of its own, without the marker, and ends in a full stop if it had
  no pause of its own, so the voice stops there.
- Citation ids are already taken out of stored text by the server (`withoutCitationMarks`);
  one left as a bracketed aside is dropped by `speakable`.
- Last, each sentence goes through `speakable` for currencies, abbreviations, fractions and
  decimals (`tts-pre-rendered-speech.md`, "Numbers and symbols"). Decimals are said as
  words there since OV-417: before that, Kokoro's phonemiser cut a sentence at the point of `1.5`.

**Where each sentence is shown.** Each `SpokenSentence` carries its `place` (intro, a section's
heading, paragraph, numbered or bulleted item, the takeaway, or the plain `text`), the index of
its block within that field's `answerBlocks`, and `start` and `end` offsets into that block's
text. A code block or table points at the whole block.

## The live lane

`POST /api/chat-records/:id/messages/:index/speech` reads the answer at `index` from the chat
the server stored, never text the client sends, turns it into sentences with `spokenAnswer`,
and answers with NDJSON, one `ChatSpeechEvent` a line:

1. `sentences`: every sentence's place on screen, so the app can highlight from the start.
2. `audio` for each chunk as it is ready: the sentences it covers (`first`, `count`), when each
   starts in it, its length and the audio (m4a, base64). A chunk that failed is `skipped`
   instead.
3. `done`, after the last chunk.

**Chunks.** The first sentence goes to the voice alone, so it plays soonest; the rest go in
threes (`speechChunks`), each one request to the pool, the answer's lines as the request's
lines.

**Scheduling** (`LiveSpeechLane`). In memory, in the API process, beside the render queue:

- It has `TTS_LIVE_SLOTS` slots (1), taken from the pool, so narration renders
  `TTS_CONCURRENCY - TTS_LIVE_SLOTS` at once (4) and the pool's size stays `TTS_CONCURRENCY`.
  Narration never uses the live slot, so a reader never waits behind an overview's render.
- A play's first chunk goes ahead of every later chunk; after that readers take turns chunk by
  chunk, so one long answer can't hold the slot.
- When the reader stops, or the connection closes, their waiting chunks are dropped before
  they reach the voice; one already being spoken finishes and is thrown away.
- A failed chunk is skipped, never retried: a sentence 30 seconds late is no use.
- The caveat on the card stands: with more than one API machine, each would count its own
  slots, and the lane would need shared state.

**Warming.** `POST /api/speech/warm` asks the pool's `/health` when the lane is idle and its
machine has stopped, which starts a machine and loads Kokoro in the background. The proxy may
still send the next play to another machine when narration is busy; the `played` log line's
`cold` shows how often that happens.

## What a play costs

The live lane keeps one timeline of its machine (`MachineTime`): the machine runs from the
first call until `IDLE_EXIT_SECONDS` (15) after the last, plus `MACHINE_START_SECONDS` (2) to
boot when it had stopped. Each call pays what it adds to that timeline:

- a call on a stopped machine pays the boot, its own time (a cold one includes loading the
  model) and the idle after it;
- a call while the machine idles pays only how much later the machine now stops;
- a warm-up pays the boot, `MODEL_LOAD_SECONDS` (5) of loading and the idle.

So two plays back to back don't both pay the idle, and an answer's later chunks pay only their
own speaking time. Seconds become dollars at `TTS_DOLLARS_PER_MACHINE_HOUR`, a Fly secret
because the repository is public, and dollars become chat usage at the usual unit, a
millionth of a dollar. Each play or warm-up adds its units to that day's `chat_usage.units`
without counting a question, and a row to `account_costs` (area `speech`, detail `chat` or
`chat-warm`, quantity in machine seconds). With no price set, plays still work, spend no usage
and record no cost, and the `played` line says `priced: false`.

Before speaking, the endpoint refuses with the chat refusals, `chat-month` or `chat-day`, when
the month's or day's usage is spent; the last play may go a little over, as the last answer
can.

## The controls (design round, 26 Nov 2026)

- **Bottom, on every answer:** a play icon in the action row, between Copy and Sources. The
  row now shows under every answer, not only the latest.
- **Top, on long answers only:** the same control above the answer, when the answer is taller
  than the chat's visible area at the current width and zoom (`useTallerThanView`). Top and
  bottom are one control in two places and always show the same state.
- **States:** idle (play, "Read response aloud"); starting (pressed at once, a spinner only
  after 400 ms, "Starting to read. Press to cancel"); playing (pause, "Pause reading");
  paused (play on the fill, "Resume reading", with ↺ "Start again from the beginning"). Pause
  is the stop: another answer, narration, signing out or leaving the page drops the place.
- **The highlight:** the stone tint behind the sentence being read, moving instantly, so
  reduced motion changes nothing. A code block or table, spoken as one line, is marked whole
  with a ring. Each place in an answer passes its `SpokenAnswerPlace` down, and
  `placedMarks` keeps each marked piece's place in the text, so a sentence's offsets cut the
  rendered words without parsing the Markdown again.
- **Scrolling:** the chat follows the sentence until the reader scrolls (wheel, touch or a
  scrolling key); then "Back to where it's reading" floats above the field.
- **Going wrong:** a skipped sentence shows nothing. Nothing read: "Couldn't read this aloud.
  Try again". A refused play: when the field already shows the month spent, "Listening is
  back on {date}, with your chat."; otherwise a card, "Not enough chat left to read this
  aloud" / "More on {date}.", with See plans on any plan but Plus. A server without a voice
  (the warm-up answers 503) shows no control.

## The player

`ReadAloudEngine` (app-core, `features/chats/readAloud/`) is one player for every chat,
mounted by `ReadAloudRuntime` inside the narration player, so one answer plays at a time
app-wide.

- **Starting** happens inside the tap: the element plays a silent clip first, which mobile
  browsers need, then each chunk's m4a clip as it arrives. The sentence comes from the clip's
  `sentenceStartsSeconds` at the element's time.
- **A chunk still on its way** is waited for; the answer finishes once the stream is done and
  its last clip has played.
- **The device's copy:** a finished answer's clips stay in memory (the last five answers), so
  replaying one asks the server for nothing.
- **Narration:** starting an answer pauses an overview's narration, and the mini player says
  "Paused for the chat answer"; an answer that plays to its end gives the narration back.
  Narration starting stops the answer.
- **Lock screen:** while it reads, the answer owns the media session (`overrideMediaSession`
  with `own`): title "Chat answer", the overview's title, the project's name or "Your
  library" as artist, the overview's image as artwork; play, pause, and previous and next
  track step a sentence. No scrubber.
- **Warming:** hovering or focusing a control warms the voice, at most every 20 seconds.
- **The meter** is fetched again after a play ends, so it moves as it does after a question.
- **Analytics:** `chat.readAloud.started`, `.paused`, `.resumed`, `.completed`, `.stopped`,
  `.failed` and `.refused`, each with plan, scope and (but `refused`) voice and sentences;
  `started` adds the control and whether it replayed the device's copy. Never the words.
