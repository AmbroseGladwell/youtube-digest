# Narration voice

Built for OV-43. A reader hears a sample of the same passage in each voice, picks one in
Settings, and every note narrated from then on, on every device, is in that voice. The
design is `OV-43 Narration Voice.dc.html` in the design project, frames 43a to 43j.

## The shortlist

`NarrationVoice` offers 15 of Kokoro v1.0's 28 English voices: those Kokoro's own grading
puts at C or better, less the novelty ones (`am_santa`). That is 11 American and 4 British.

| American | British |
|---|---|
| Alloy, Aoede, Bella, Fenrir, Heart, Kore, Michael, Nicole, Nova, Puck, Sarah | Emma, Fable, George, Isabella |

- **Friendly names on screen, Kokoro's ids everywhere else.** `NARRATION_VOICES` maps
  `af_heart` to `{ name: "Heart", accent: "american" }`. The accent picks the phonemiser's
  language, so the service never guesses it from the prefix.
- **Nicole was kept on purpose.** Her sample runs about 28 s where the others run 15 to 20,
  because she is slow and soft. She is the design's voice and the reader's choice.
- **Heart stays the default.**
- **`test_kokoro_model.py` checks the list against the model file**, so a voice the model
  does not have cannot be offered.
- **A voice this client does not know reads as the default.** `Settings.narrationVoice` is
  `NarrationVoice.catch(DEFAULT_NARRATION_VOICE)`. Without the catch, an older client reading
  a voice added later would find the whole settings record unreadable and lose every other
  setting with it.

## The samples

Every voice reads the same passage, so the comparison is fair. The passage describes what
a note is rather than quoting a real one:

> Hello. / Your next overview is ready. We'll walk through the premise, the core claim and
> the key points, then see how you might apply the learnings in real life. And at the end,
> I'll tell you honestly whether the full video is worth your time, if there are some key
> areas to watch, or if the overview has you covered.

It is two lines, so the renderer's 0.4 s gap falls after "Hello." as it would between two
sections of a note. The text lives in `apps/api/src/audio/voiceSampleLines.ts`. Clients never
see it: they ask the API which samples exist.

**A sample is an ordinary render.** It goes through the same queue, the same TTS pool and the
same R2 bucket as a note, keyed the same way on its words, voice and render version. Nothing
about storing or serving it is new, and it sounds exactly like a real note, because it was
made exactly like one.

**It is made once, on deploy.** `fly.toml` runs `scripts/seedVoiceSamples.js` as Fly's
`release_command`, before the new version's machines start:

1. It applies the migrations itself, since the release runs before any new machine has.
2. `seedVoiceSamples` queues any sample that is not already ready, with no account as its
   requester, and records the current set in `voice_samples`.
3. It renders what it queued there and then, draining the queue in the deploy. The app's
   machine stops when idle, so leaving the renders to it could strand them half-done.
4. It logs how many samples are ready and which voices are missing.

A sample that fails is left queued for the app's workers and **does not fail the deploy**.
The picker degrades rather than breaks (below), and nobody should have to roll back a
release because the TTS pool was cold. The next deploy queues the failed sample again. Run it
by hand with `npm run seed-voice-samples --workspace apps/api`.

**Superseded samples are deleted after 30 days.** Changing the passage, the list or the render
version changes every key. The next seed marks the old samples superseded, and the first seed
at least 30 days later deletes each one's file, render row and `voice_samples` row. The grace
period is for a client that fetched the list just before a deploy. A sample that becomes
current again (the text reverted) is no longer on its way out. Nothing else deletes audio on
a timer; this is only about samples.

`GET /api/audio/samples` is public, like the files, and answers the ready, current samples
with their `fileUrl` and `durationSeconds`. A client skips any entry whose voice it does not
know, rather than failing the whole list.

## Listening

`useVoiceSamplePlayer` plays one sample at a time. Pressing another stops the first. A note
that was playing is paused and **stays paused**, so comparing voices does not keep cutting
back to it. The row shows "Playing · 0:07 of 0:20", with the duration taken from the server
and the time from the audio element, and a ring that fills as it plays.

## Choosing

There is no Save button. Picking a row writes `narrationVoice` to the synced settings at once,
and the radio shows the pick while the write is still in flight. The live region then says,
once:

> **George is your voice now.** New audio uses it on every device. Notes already narrated keep
> their voice; you can re-record any of them from the player.

Nothing re-renders when the voice changes. `PlayerRuntime` hands the voice to the engine
(`setVoice`). A note loaded but not yet started is looked up again, so its bar can offer to
re-record. A note already playing carries on as it is.

## Old audio

Audio is found by a key that includes the voice, so after a switch from Heart to George, a
note narrated in Heart cannot be found by asking for George. Two pieces close that gap.

- **`POST /api/audio/lookup`** takes up to 32 keys and answers every render that exists under
  them, in any state. `peek` computes the note's key in all 15 voices and asks once. It
  prefers the chosen voice in whatever state it is in. Failing that, it takes narration
  ready in another voice. Failing that, it finds nothing, and the note renders in the chosen
  voice on first play.
- **The snapshot carries two voices.** `voice` is the reader's choice. `narratedVoice` is the
  voice of the narration the bar found. When they differ, the bar says "Narrated · Heart
  voice" and offers **Re-record in George** while stopped, paused or finished (43j). The
  button always names the voice the reader chose.

Re-recording asks for the chosen voice as `interactive`, goes through the usual preparing
state, and plays from the line the reader had reached. Only once it has landed is the older
file deleted, through `DELETE /api/audio/:key`. The API allows that only for the account that
asked for the render, never for a sample. A re-record that is cancelled or fails keeps the
older narration.

The voice the bar names is a link to the voice setting (43i). It goes to `/settings/voice`,
which on the full layout is Settings scrolled to the picker, and in the panel is the list on
its own page. The player lives above the router, so following the link does not stop the
note.

## Signed out

Narration needs an account, so without one there is nothing to choose a voice for. The picker
and the panel's row hide themselves (`CLAUDE.md`, "degrade visibly"). If the samples fail to
load, the play buttons go, the voices stay choosable, and "Try again" asks again (43d).

## Logging

There is no analytics layer. The API logs `narration voice chosen` with the voice whenever
settings are written with one, and every sample play is a request for a file whose key
`voice_samples` maps back to its voice. Between them they say which voices get sampled and
which get chosen.

## Where the build departs from the design

- **Settings is wider**, 53.5rem rather than 44rem, so the three columns fit "Playing · 0:07
  of 0:20" without wrapping, as they do at the design's 760.
- **The panel's back link sticks** under the masthead while the list scrolls, as the frame
  draws it (43h). The list is otherwise the full picker in one column.
- **The design file was read only up to 256 KiB.** Its last frame, 43j's panel label line, was
  cut off in the source and taken from the screenshot instead.
