# Questions to ask next

Questions at the foot of every new overview that a reader can take to their own assistant
to go further: up to nine, shown three at a time. Trello OV-266, raised 10 November 2026
after the owner looked at YouLearn's quick prompts; decided with the owner 14 November 2026.

## Why

`mcp-connector.md` and OV-235 keep reasoning in the reader's own assistant and out of the app.
The likeliest thing to overturn that is that most readers never connect one. A question
written for this source, one tap from the reader's assistant, gives every reader a way to go
deeper without building chat, at no extra running cost: the questions come from the call that
writes the note. **The app never answers a question itself.**

It's a guess, not evidence. The measure is whether testers tap them (OV-223).

## What the owner decided

- **On every kind of overview**: video, process, recipe video, podcast episode, article and
  recipe page.
- **Up to nine, shown three at a time**, so the reader can ask for different questions
  without another call (the owner). The extra questions are a fraction of a cent of output.
  They're ordered best first, the three in each turn take three different ideas, and a source
  with too few ideas gets fewer rather than padding.
- **For learning, not fact-checking** (the owner, prompted by Recall's chat prompts on a Katie
  Dill interview). Each question takes one specific idea, term or technique from the source
  and asks why it matters, how it works, or what goes wrong without it. Three different ideas,
  the ones most worth understanding.
- **Partly shaped by the reader, never forced** (the owner, after the first harness run). The
  profile How to apply uses (`personalisation.md`) picks which ideas the questions take. A
  question that links an idea to something the reader already does is written only where the
  connection is real and the answer would tell them something asking about the source alone
  wouldn't; "for me" bolted onto a general question is forced, and none is often right. Never
  invent a project or role for them (OV-236). A reader with no profile gets questions about the
  source alone.
- **Genuinely insightful** (the owner): questions a thoughtful reader would want answered after
  reading the note, which open up the reasoning behind an idea rather than restate it.
- **Never on a shared link.** They're written for the reader, so the share snapshot leaves them
  out (`PRIVATE_OVERVIEW_FIELDS`, `sharing.md`).
- **A Settings switch hides them**, as Resources has (OV-203). The questions are still written
  and kept, so turning it back on shows them on every overview that has them.
- **No backfill.** An overview written before them has `followUpQuestions: null` and shows none.

## Generation

One more structural section at the end of every prompt (`followUpQuestionsSection.ts`, and
`articleFollowUpQuestionsSection.ts` for articles and recipe pages). Each question is anchored
on an idea the note names, in its key points or chapters. Without a connection the assistant
gets the overview and not the transcript, so a question about a detail only the transcript
holds would leave it guessing. A connected assistant can still read the transcript through
`get_transcript`. The prompt rules out questions the note already answers in full and generic
ones, and each question names its idea, because it's read away from the note. A recipe's
questions are about technique ("why does frying the paste deepen the flavour?").

**Two lists, placed by code.** The model writes `followUpQuestions`, about the source, and
`readerQuestions`, up to three, often none. Asked for one list with "one in each three for the
reader", Sonnet ranked the source questions first and left its one reader question seventh of
nine, so it was rarely seen. `resolvedFollowUpQuestions` now builds the sets: each three gets
at most one reader question, second, and the rest are about the source. A set is never made of
reader questions alone, and the record refuses two in one three.

**A target, never a count to hit** (`docs/prototype/constraints.md`; OV-252). The prompt asks
for about 15 words. The record allows up to 25. Code drops a blank question or one over 25
words and keeps nine at most (`resolvedFollowUpQuestions`), so a long question costs that
question, never the overview or a retry. The schema sent to the model is a plain array of
strings, non-nullable, with no bounds.

**Where the reader goes in the prompt.** When How to apply is written, its section already
carries the reader, so the questions point to it rather than repeat it. Without it (switched
off, or a recipe note, which has no How to apply), the questions carry the reader themselves.

A podcast episode's prompt is the video's in a podcast's words (`inPodcastWords`), so its
questions say "episode".

## Record and readers

- `Overview.followUpQuestions`: up to nine `{ question, forReader }`, in the order they're shown,
  or null on an older record. `forReader` lets analytics compare taps and lets the design mark
  them if it wants. Overview
  schema 19, client 21 (`record-migrations.md`). Older clients hold these records back.
- **Markdown** (`overviewMarkdown`) ends on "Questions to ask next" when there are any, so a
  connected assistant reads them through `get_overview` and can offer them.
- **Analytics:** `capture.newOverview.finished` carries how many questions the note kept,
  never their text, and how many are for the reader (`readerQuestions`), which shows how often the
model finds a real connection. Fewer than nine means a source with few ideas, or some came back blank or
  too long.

## Taking a question to an assistant

The app never answers a question. A tap opens the reader's own assistant in a new tab, its text
box filled in where that works. Tested by the owner on 14 November 2026.

| Assistant | How the question arrives (`FOLLOW_UP_ASSISTANTS`) |
|---|---|
| Claude | `claude.ai/new?q=`, filled in, under Claude's own caution banner, which we can't change |
| ChatGPT | `chatgpt.com/?q=`, filled in |
| Gemini | `gemini.google.com/app?q=` opens but stays empty, so the prompt is copied and Gemini opened for the reader to paste |

**What it carries** (`followUpPrompt`):

- **Connected to The Overview:** an instruction to read the overview with `get_overview`, and its
  transcript with `get_transcript` rather than the web, citing its timestamps; then
  `<question>…</question>` and `<overview>title (The Overview id …)</overview>`. Without the
  instruction ChatGPT answered from the web and cited outside transcript sites.
- **Not connected:** `<question>…</question>` and the whole note as Markdown inside
  `<overview>…</overview>`.

**Too long for a link** (`followUpHandOff`): a link longer than 10,700 characters, the longest the
owner has seen fill in, is copied and the assistant opened instead, so a prompt never arrives cut
short. A typical 20-minute talk's note comes to about 10,400, so longer notes are copied until a
longer link is tested.

**Which assistant** (`followUpAssistantFor`): the synced setting "Ask follow-up questions in"
(`Settings.followUpAssistant`: Claude, ChatGPT or Gemini). Until the reader picks, a reader whose
connections are all to one known assistant, by the name its client registered with
(`connectionAssistant`), gets that one; anyone else is asked on their first tap. "Connected" is
whether a connection is to the assistant in use.

**Hiding them:** `SectionsEnabled.followUpQuestions`, on by default and for settings saved before it.

## Not built yet

- The chips and "Different questions", the assistant line and picker, the Settings rows, and their
  events (`overview.followUps.shown`, `.opened`, `.copied`, `settings.followUpAssistantChanged`,
  never the question text). These follow the Claude Design round on the card.
- The sharing dialog's "Kept private" list doesn't name the questions yet, because they aren't
  shown anywhere. It names them when the chips ship.
