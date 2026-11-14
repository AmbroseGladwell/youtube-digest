# Questions to ask next

Three questions at the foot of every new overview that a reader can take to their own
assistant to go further. Trello OV-266, raised 10 November 2026 after the owner looked at
YouLearn's quick prompts; decided with the owner 14 November 2026.

## Why

`mcp-connector.md` and OV-235 keep reasoning in the reader's own assistant and out of the app.
The likeliest thing to overturn that is that most readers never connect one. A question
written for this source, one tap from the reader's assistant, gives every reader a way to go
deeper without building chat, at no extra running cost: the questions come from the call that
writes the note. **The app never answers a question itself.**

It's a guess, not evidence. The measure is whether testers tap them (OV-223).

## What the owner decided

- **Three questions, on every kind of overview**: video, process, recipe video, podcast
  episode, article and recipe page.
- **Personalised.** Each question is fitted to the reader, from the same About you and learned
  items How to apply uses (`personalisation.md`), under the same rule (OV-236): fit what they
  already do, never invent a project or role for them. A reader with no profile gets questions
  about the source alone.
- **Never on a shared link.** They're written for the reader, so the share snapshot leaves them
  out (`PRIVATE_OVERVIEW_FIELDS`, `sharing.md`).
- **A Settings switch hides them**, as Resources has (OV-203). The questions are still written
  and kept, so turning it back on shows them on every overview that has them.
- **No backfill.** An overview written before them has `followUpQuestions: null` and shows none.

## Generation

One more structural section at the end of every prompt (`followUpQuestionsSection.ts`, and
`articleFollowUpQuestionsSection.ts` for articles and recipe pages). It asks for questions the
source raises but leaves open, ones that test whether it holds up, or ones about how it would
work in the reader's life. It never asks what the note already answers, never asks a generic
question, and each question names its idea, since the question is read away from the note.

**A target, never a count to hit** (`docs/prototype/constraints.md`; OV-252). The prompt asks
for about 15 words. The record allows up to 25. Code drops a blank question or one over 25
words and keeps the first three (`resolvedFollowUpQuestions`), so a long question costs that
question, never the overview or a retry. The schema sent to the model is a plain array of
strings, non-nullable, with no bounds.

**Where the reader goes in the prompt.** When How to apply is written, its section already
carries the reader, so the questions point to it rather than repeat it. Without it (switched
off, or a recipe note, which has no How to apply), the questions carry the reader themselves.

A podcast episode's prompt is the video's in a podcast's words (`inPodcastWords`), so its
questions say "episode".

## Record and readers

- `Overview.followUpQuestions`: up to three strings, or null on an older record. Overview
  schema 19, client 21 (`record-migrations.md`). Older clients hold these records back.
- **Markdown** (`overviewMarkdown`) ends on "Questions to ask next" when there are any, so a
  connected assistant reads them through `get_overview` and can offer them.
- **Analytics:** `capture.newOverview.finished` carries how many questions the note kept,
  never their text. Fewer than three means some came back blank or too long.

## Not built yet

- The chips, the assistant links, the synced "Ask follow-up questions in" setting, the
  Settings switch, and their events (`overview.followUps.*`). These follow a Claude Design round
  briefed with real questions from the harness.
- The sharing dialog's "Kept private" list doesn't name the questions yet, because they aren't
  shown anywhere. It names them when the chips ship.
