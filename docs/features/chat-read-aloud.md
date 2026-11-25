# Chat read aloud

OV-418 (raised 25 Nov 2026). Any chat answer can be read aloud in the reader's narration voice
(`NarrationVoice`, `narration-voice.md`), with pause, resume, replay and stop, sentence by
sentence so the first plays while the rest render. It reuses the Kokoro pool that narrates
overviews (`tts-pre-rendered-speech.md`), and no chat audio is kept on the server.

Three PRs on the one card:

1. **The speech version** of an answer (this section, built).
2. **The live lane** in the API: an in-memory queue beside `AudioRenderQueue` with one pool
   slot reserved for it, and the endpoint that streams each sentence's audio.
3. **The player and the controls**, after a design round.

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
  decimals (`tts-pre-rendered-speech.md`, "Numbers and symbols"). Decimals were fixed there
  for this card: without it, Kokoro's phonemiser cut a sentence at the point of `1.5`.

**Where each sentence is shown.** Each `SpokenSentence` carries its `place` (intro, a section's
heading, paragraph, numbered or bulleted item, the takeaway, or the plain `text`), the index of
its block within that field's `answerBlocks`, and `start` and `end` offsets into that block's
text. A code block or table points at the whole block.
