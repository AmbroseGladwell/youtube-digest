# Chats

OV-308, the first of four build cards for chat about one overview (OV-308 to OV-311). The
investigation behind them is OV-267, `docs/architecture/in-app-chat.md` (PR #343): GPT-6 Luna with the
whole transcript costs about $0.0003 a message, and answered only from the source.

OV-308 built the record, OV-309 the endpoint that answers and writes it, and OV-311 reading
chats over MCP. The panel inside the overview is OV-310.

## One record per conversation

A synced kind, `chat`, added at client version 22 (`sync-api.md`, "A kind a client was built
before"). Each record is one conversation about one overview:

- `id`: `chatRecordId(overviewId, conversationId)`, the overview's id, a colon and the
  conversation's own uuid. The overview comes first, so the server finds an overview's chats
  by the start of their ids, as it finds a project's membership records (`projects.md`).
- `overviewId`, and `startedAt`, the time of the first message.
- `messages`, in order. A reader's message is `{ from: "reader", text, at }`. An answer adds
  `citations` and `inSource`.
- **Citations are worked out by code** from the passages the model cited, never stated by it
  (`CLAUDE.md`, "Never let a model count, measure or time anything"):
  - `{ startMs, endMs }` for a stretch of a video or episode;
  - `{ paragraph }` for an article;
  - `{ chatId, message }` for a message in another chat about the same overview, by its
    place in that chat's `messages`;
  - `{ part, index, textHash }` for an item of the overview itself, since chat schema version
    2 (OV-319, "Citing the overview" below).
- **`inSource: false`** marks an answer the source doesn't back. Another chat and the
  overview are never the source: an answer resting only on them is not `inSource`. One that
  is not `inSource` but cites the overview is "From the overview" (`answeredFromOverview`);
  one that cites neither says the source doesn't cover the question.
- At most `MAX_CHAT_QUESTIONS` (50) questions and their answers, and 10,000 characters a
  message. A conversation past its length is refused whole, so OV-309 checks the count first
  (`chatQuestionCount`) and offers a new conversation.

**Never a field of the overview.** The overview record is replaced wholesale when it is made
again, so anything kept on it would be wiped (`CLAUDE.md`, the read and favourite lesson). A
regenerated overview keeps its chats: their citations point at moments in the source, which
don't move.

## Several chats, and one using another

An overview can have any number of chats, and each can draw on the others: a reader can
build on a decision or an answer from an earlier chat without repeating it. Each question
carries the overview's other live chats (`otherChatsInPrompt.ts`), cut to 24,000 characters
counted by code: the newest messages are kept first, then laid out oldest first, each with an
id such as `c1.m3`. A deleted chat is never sent, so it can't come back through another one.

An answer that uses another chat cites it with `{ chatId, message }`, which code checks
points at a real message in a live chat of the same overview, as it checks times against the
transcript. An earlier answer is context, not evidence: a fact about the source still cites
the source. OV-310 shows the citation as a link to that message. Whether the reader can
choose what to bring in, instead of every chat seeing the others, is for its design round.

The citation is in the schema from the start, so adding it later needs no schema version
bump.

**Notes**, the reader's own writing on an overview, should take the same shape when they are
built: a per-overview record, synced, deleted with its overview.

## The server writes it

The answer comes from our server, so the server writes the record and devices get it down the
feed. `appendChatMessages` (`apps/api/src/chats/`) starts a conversation with its first
messages and appends the rest:

- **Only while the overview is there.** It reads the overview in the same transaction and
  refuses one that is missing or deleted.
- **Never onto a conversation the reader deleted.** A tombstoned chat is refused, not brought
  back.
- It is written at the server's own versions (`serverClientContext`), with the server's clock.

No route lets a device write a chat.

## Asking

`POST /api/chats/:overviewId/messages` with `{ conversationId, text }` (`ChatQuestionRequest`):
a new conversation is a new uuid, a follow-up repeats its conversation's. Signed in only, on
our key, on GPT-6 Luna (`chatModel.ts`) for every plan. `ChatAnswerer` settles everything that
can refuse before the answer starts, so a refusal is an ordinary JSON error:

| Refusal                                                    | Status                       | Details                                                                                            |
| ---------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| The overview isn't held, or the conversation was deleted   | 404 `not_found`              |                                                                                                    |
| No transcript kept for it, or an article                   | 422 `transcript_unavailable` | `chat: "no-source"`                                                                                |
| The conversation has `MAX_CHAT_QUESTIONS` questions        | 400 `invalid_request`        | `conversation: "full"`                                                                             |
| The month's, the day's or the global day's allowance spent | 429 `too_many_requests`      | `quota`, `retryAfterSeconds`, `resetsOn` for the month (`tiers.md`, "Questions about an overview") |
| No key on this server                                      | 503 `unavailable`            |                                                                                                    |
| The provider failed before answering                       | 502 `generation_failed`      |                                                                                                    |

**The answer streams** as server-sent events (`ChatStreamEvent`): `text` events carry the
answer as it arrives, then one `answered` event carries both messages as stored and the
record's rev, or one `failed` event says nothing was stored. The model replies in JSON,
`{ answer, passages, chatMessages, inSource }`, answer first, and `answerSoFar` reads the
answer's text out of the reply while the rest is still arriving. Since OV-319 the reply also
carries `overviewParts`, the ids of the overview's items it rests on.

**The prompt** is OV-267's `fullTranscript` shape, with the overview added (`chatPrompt.ts`):
the instructions, the overview with an id on each item an answer can cite, and the whole transcript in one-minute
passages with ids (`transcriptPassages.ts`), as the first message, which never changes, so
follow-ups and the overview's other conversations read it from the cache
(`prompt_cache_key` is per overview). Then the other conversations, then this conversation's
history, then the question.

**Citations are code's.** `citationsOf` turns passage ids into `{ startMs, endMs }`, the
overview's item ids into `{ part, index, textHash }` and other chats' message ids into
`{ chatId, message }`, drops any id the model wasn't given, and sets `inSource` only when the
answer cites the transcript.

**A provider refusing for now** (429 or 5xx) is asked again after its `retry-after`, at most 5
seconds, or after 1 then 3 seconds, before anything streams. A third refusal, any other
failure, or a reply that can't be read gives the message back and stores nothing; the tokens
the provider billed still go into the cost tally, as `message-failed`.

**Stopped or abandoned.** When the reader stops an answer, or the connection goes, before
the answer is stored, the server stops asking the provider, stores nothing and gives the
question back (`api.chat.stopped`). The provider reports tokens only at the end, so what it
billed for the part already written isn't priced.

**Costs and logs.** Each answer's tokens and list-price cost go into `account_costs`, area
`chat` (`unit-economics.md`). `api.chat.answered` logs the plan, model, tokens, cached share,
cost, `inSource`, the citations of the source and of other chats, how many other chats'
messages went in, the month's count and the time; never the question or the answer.

**Always on us.** Every plan asks on our key, whatever key it makes overviews with, and
"Only ever use my key" doesn't change that (owner, 16 Nov 2026). Settings › API keys says so
under that switch: the reader's key is only used to make overviews
(`OWN_KEY_FOR_OVERVIEWS_ONLY`).

## Measured through the endpoint

`apps/api/src/scripts/chatHarnessCheck.ts` runs the real endpoint in process, on an in-memory
Postgres, against OpenAI on our key, and reads its own log line for tokens and cost. Run on 16
Nov 2026 with `modelPrices.ts` as checked on 9 Nov (Luna $0.10 in, $0.01 cached, $0.50 out per
million). The overview in the prompt was a fixture, since the spike kept only the notes' text.
Latency wasn't measured: the in-process clock doesn't move.

**OV-267's question set** (6 sources of 10 to 89 minutes, 6 questions each, one conversation
per source, twice): answered or declined rightly 72 of 72, declined all 24 the source doesn't
cover, cited the right moment 46 of 48 (10 of 12 for questions needing two moments far apart),
named the expected detail 48 of 48. That matches OV-267's `fullTranscript` arm. A message cost
$0.00021 at the median, with 99% of its prompt read from the cache; the first of a conversation
cost up to $0.0022.

**The worst case:** the library has nothing over 89 minutes, so the two longest were joined end
to end into a 169-minute source of about 33,000 tokens. Two 30-question conversations on it,
the second carrying the first (all 60 of its messages fitted the budget):

|                             | First question | Each later question (median) | 30 questions | Prompt tokens, first to last |
| --------------------------- | -------------- | ---------------------------- | ------------ | ---------------------------- |
| Alone                       | $0.0042        | $0.00042                     | $0.016       | 32,800 to 35,100             |
| With the other conversation | $0.0045        | $0.00046                     | $0.018       | 35,200 to 37,500             |

So 30 questions of history and a full other conversation add about 10%. The cap was raised
to 50 on 16 Nov 2026, after this run, because a reader deep in a conversation shouldn't be cut
off; 50 questions has not been measured. The extra history is read from the cache like the rest.

**A new conversation reads the transcript from the cache (OV-313).** In that run the second
conversation's first question paid to cache the whole prompt again, at 1.25× input, although
the transcript was the same. A probe of five calls on one transcript (`chatCacheProbe.ts`)
found why: the other conversations went as a second `system` message, which OpenAI folds into
the first, so the transcript was no longer the prefix it had cached. A different question
after the transcript, the other chats inside the question, or the other chats as a `user`
message each read all of it (16,922 of 16,933 tokens). They now go as a `user` message. Checked
again through the endpoint on the 169-minute source: the second conversation's first question
cost $0.00041, reading 99% of its prompt from the cache, where it had cost $0.0045.

What still costs is the first question about an overview whose transcript hasn't been asked
about in the last 30 minutes, the cache's lifetime on Chat Completions (`spend.md`): about $0.004
on a source that long, $0.002 at 89 minutes. Every later question, in any conversation about it,
is about a tenth of that.

## Citing the overview

OV-319. An answer can rest on the overview's own items, not only on the transcript: "Why is
this marked dubious?" is answered by the overview's reason, "What should I do first?" by its
first step, and "How do I apply this?" by How to apply, which may go beyond the source on
purpose.

**The items, and their ids.** `overviewParts` lists the items an answer can cite, in the
note's order, and `overviewMarkdown(overview, { partIds: true })` writes each with its id in
the prompt: the verdict (`verdict`), why it is dubious (`dubious1`), key points (`kp1`), the
steps it gives (`step1`), How to apply (`apply1`), what it sells (`sells`), Watch it anyway
(`anyway`), chapters (`ch1`), and a recipe's ingredients (`ing1`) and method (`method1`). The
premise, big picture and core claim have none: they are cited from the transcript. A test
holds the ids in the prompt to exactly the parts `citationsOf` accepts. An article's own parts
wait for chat on articles (OV-320).

**What the prompt asks.** Cite the item an answer rests on, and the transcript as well where
it backs the same point. The verdict, the dubious reasons, what it sells and Watch it anyway
are the overview's judgement, not the source's words, so a question about them is answered
from the item, citing the moment it refers to where there is one. An answer never speaks of the
overview as a third party ("the overview suggests") or in the first person: it gives the answer
and marks a line only against the source, naming the section when the question is about one
("Watch it anyway says…"). An answer from How to apply adds that it goes beyond the source when
it does (design 319k). `inSource` stays about the transcript alone.

**A regenerated overview** keeps its id, its chats and their citations, but its items can move
or change. A citation keeps the item's place and a hash of its text (`overviewPartHash`,
FNV-1a, so the server and every client compute it alike without an async digest).
`citedOverviewPart` follows the text to wherever it moved within its part, falls back to the
part's section when no item still holds it, and to nothing when the section is gone.

**Over MCP**, `get_chat` writes an overview citation as `item 2 of the overview's "The steps
it gives"`, or as the section and "an item since changed", and an answer from the overview alone as "Answered from
the overview, not from what the video says".

**Clients before it.** The new citation moved the `chat` schema to version 2, at client
version 23. A chat written since is held back by an older client, which counts it towards the
stale-client banner, rather than failing to parse (`record-migrations.md`). Nothing new goes to
the model: the overview already did.

**Logs and analytics.** `api.chat.answered` and `reader.chat.answered` count overview
citations (`overviewCitations`) beside those of the source and of other chats.

## No transcript, no chat

The server answers only from what the account holds itself (`transcript-storage.md`). A video
or episode without a stored transcript is refused with `chat: "no-source"`, and so is every
article: the server keeps no article's text (OV-295), so `{ paragraph }` citations wait until it
does. The panel hides itself on that refusal (degrade visibly).

## Deleting

- **One conversation:** `DELETE /api/chats/:overviewId/:conversationId` tombstones it. A retry of
  one already deleted answers 204. On a device, `ChatStore.deleteChat` removes it and journals
  the delete, which the outbox pushes like any other.
- **With its overview:** deleting an overview tombstones its chats, in a sweep run after the
  overview's own tombstone commits and on every retry of the delete (`tombstoneChats`, through
  `tombstoneLiveRecords`, which the membership sweep uses too). A chat written before the
  overview went is caught, and none can be written after, because the write refuses a
  deleted overview. This follows projects' membership records rather than sharing the
  overview's transaction, which would need the ids before the transaction opens. A device
  removes the overview's chats when it deletes the overview, or when it pulls the overview's
  tombstone, without journaling them, since the server's delete takes them.
- **With the account:** chats are rows in `records`, which go with the account
  (`account-deletion.md`). `accountDeletion.test.ts` seeds one.

## On the device

`IndexedDbChatStore` reads the `chats` object store (database version 7), indexed by overview:
`listChats(overviewId)` oldest first, `getChat(id)`, and `deleteChat(id)`. Nothing shows them
yet; OV-310 builds the panel.

## In the app

OV-310's plumbing, ahead of the panel the Design round draws:

- **`ChatApi`** in `@overview/sync` (`createFetchChatApi`): `ask` posts the question and reads
  the server-sent events, handing each piece of text to a callback and settling as `answered`
  or `failed`; a refusal before the answer starts throws the API's own error. `usage` reads
  `/api/chat-usage`.
- **`chatStore`** joins `Stores`, so the panel reads an overview's conversations from the
  device (`useChatsQuery`), and a sync pull refreshes them. `useDeleteChatMutation` takes one
  out of the list at once and journals the delete.
- **`useAskQuestion`** asks and follows the answer: `answering` with the text so far, then the
  stored exchange goes straight into the conversation (`withAnswer`) and sync brings the record
  down behind it; `failed`; or `waiting`, with the wait `chatWaitOf` read from the refusal (the
  month with its reset date, the day, everyone's day, a full conversation, or nothing to answer
  from, which hides the panel). Stop aborts it, and the server gives the question back.
- **`chatOffered`** hides chat signed out, on someone else's shared overview, and for every
  article and recipe page.
- **Where a tapped question goes:** `Settings.questionsAnsweredHere`, answered here by default
  (`follow-up-questions.md`, "Answered here").
- **Events**, `reader.chat.*`: opened (from a question, typed, or the menu), closed, asked (from
  a question or typed, new conversation or not), answered (in the source, citations of each
  kind), answerFailed, stopped, waited (which wait), citationFollowed (to what; for the overview,
  the part and, unless it changed since, the item's place, never its text), answerCopied, continuedIn
  (assistant, filled in or copied, connected), conversationOpened and conversationDeleted. Never
  the question or the answer.

### Beside the note (design 310a, 310d–310p)

On the web, chat is a column on the right (`ChatPanel`, `useChatPanel`): the note's column eases
left as it opens (320ms, `.layout` in `ReaderPage.module.scss`), and the chat sits under the bar,
sticky and fixed in height, 400px wide (360px under 1280px), so the note scrolls on its own beside
it. Its field takes focus as it opens; Esc stops an answer being written, or else closes the chat
and returns focus to what opened it. On a phone and in the extension's panel it is a sheet instead
(`ChatSheet`, design 310g, 310h, 310o).

- **Motion and focus beside the note** (design 310a-4–310a-6, 310aq): a question tapped under the
  note, or typed in its field, travels into the chat as its question, 520ms ease-out, following
  the chat as it slides in (`bubbleTravel`); none with reduced motion. Closing plays the opening
  backwards. F6 moves between the note and the chat, which isn't modal. A question answered here
  shows "Answered here · just now" under its bubble, read from the synced conversations, and that
  opens its conversation (`useChatPanel.answeredHere`).
- **The sheet:** 64px from the top on a phone, under the masthead in the panel. Raised it is a
  modal dialog holding focus, over a scrim. Its handle (a button, "Lower chat" / "Raise chat") or
  its header drags it, following the finger with resistance past either rest (`sheetDrag`); let
  go, it springs (420ms) to the nearer rest, or where it was flicked faster than 0.5px/ms.
  Lowered, it shows only the conversation's title and a line, and the read-aloud bar moves up
  above it. A citation that plays (the video beside the panel, an episode's audio) lowers it to
  "Playing 3:28–4:23 from the answer"; reading a cited stretch in the transcript lowers it to say
  so; "Back to the conversation" raises it.
- **Ways in:** a question under the note (answered here, `follow-up-questions.md`), the note's own
  field "Ask about this video" (`NoteAskField`, which fades out while chat is open), and Chat in the
  overview's menu. With chat closed, a question starts a new conversation; with it open, it asks
  in the open one; the menu reopens the most recent, or a new one.
- **A conversation:** the reader's question in OV-266's bubble, the answer as plain text under three
  dots and then a caret while it streams, with Stop in Send's place. Stopping keeps what was
  written, says "Stopped. This one didn't count." and stores nothing. A failure says so, with Try
  again. The answer is announced once, when final ("Answer: … 1 moment cited.", or "Not in the
  video: …").
- **Citations:** each stretch of the source is a pill under the answer, from the record's times,
  named "Play the video, 3:28 to 4:23". Following one tints the key point holding it
  (`citedLineIndex`) and, where a player can seek (the video beside the extension's panel, an
  episode's own audio), plays from there; on the web, which has no player for the video, it offers
  the video at that time on YouTube or the transcript, as a note's moment does.
- **The overview cited** (OV-319, design 319a–319ac; handoff `design_handoff_ov319_citing/`): each
  part of the overview an answer rests on is an outlined pill with the note's mark
  (`ChatOverviewCitation`), named by the note's own heading: Step 2, Key point 3, How to apply,
  Verdict, What it's selling, Watch it anyway?, "Chapter: Dosing", "Ingredient: …", Method step 4,
  and "Why it's dubious" for a dubious reason. A section the note doesn't number is numbered only
  when one answer cites two of its items ("How to apply, 1"). Its accessible name adds the item's
  opening words. They come first in the answer's one row of pills, in the note's order, then the
  video's in time order (`overviewCitationViews`). An answer from the overview alone has no label:
  "Not in the video" is only for one that cites neither. Following one keeps chat open, switches
  to Chapters for a chapter, opens folded steps or the dubious reasons when it has to, brings the
  part to about 90px below the top, tints it and gives it focus (`CitedOverviewPartContext`, the
  global `[data-cited-part]` rule); the verdict, What it's selling and Watch it anyway are tinted
  whole. A polite status says "Showing Step 2 in the overview. Escape returns to the answer." and
  Escape does, a second closing chat. On a phone and in the panel the sheet lowers to "Showing
  Step 2 from the answer", and raising it returns focus to the pill. One tint at a time, until
  another citation is followed or chat closes. An item rewritten since reads "Step 2 · since
  changed" and leads to its section's heading; a section no longer in the overview is muted text,
  "What it's selling · no longer in the overview", not a link.
- **Under the latest answer:** Copy, and "Continue in {assistant}" (`chatHandOffPrompt`): connected,
  it names the overview and the conversation for the assistant to read with `get_chat`; otherwise
  it carries the note and the conversation. With no assistant chosen it opens OV-266's menu as
  "Continue in".
- **An overview's conversations** (design 310q–310u) sit behind the header's count, and the note's
  "3 conversations about this video" opens them: newest first, the open one tinted, New
  conversation at the top. A new conversation is nothing until its first question. Deleting is at
  once, with Undo in a toast for six seconds; the delete is made when the toast goes, or at once if
  the reader leaves the overview first (`useChatPanel`).
- **Another conversation cited** (design 310w–310y): a link with a speech mark, "From your
  conversation · 12 Nov" over its first question, before the answer's pills, since a pill plays
  and a link opens words. Following it opens that conversation at the cited message, outlined for
  a moment with focus on it, and the header says when it was and how many questions it holds; a
  link at the top goes back to the citation. One since deleted reads "From a conversation you
  deleted", muted, not a link. That a new conversation can see the others is said once, in its
  empty state, and otherwise only by these citations.
- **What's left and the waits** (design 310ab–310ai): nothing shows while more than ten questions are
  left this month; at ten or fewer a muted line under the field says how many, "on us". The list's
  foot always says "84 of 100 questions left this month, on us. More on 1 December.", and Settings ›
  Plan has a cell for it beside the overviews. A wait takes the field's place (`ChatWaitBlock`,
  copy in `chatWaitCopy`), with the questions above it hidden: a spent month names when it's back
  and offers only plans that give more (Free: See plans; BYO Plus: See Plus; Plus: nothing); the
  day's limit and everyone's day say tomorrow and offer nothing. A month already spent shows its
  wait as chat opens, from `/api/chat-usage`. At 50 questions a conversation offers New
  conversation in the field's place, and its header adds "· 50 questions". Offline, the field
  gives way to "You're offline"; past conversations stay readable. No words four seconds after
  asking says "Still working on it…"; words stopping for six say the connection is slow
  (`useSlowAnswer`). Each plan's allowance lives in `chatAllowances` in `@overview/domain`, which
  the server and the app both read.
- **Questions to ask next** sit above the field: the set of three before the first answer, with
  Different questions, then up to two not yet asked (`chatSuggestions`); none while the reader
  types.

## Over MCP

A connected assistant reads chats under `overviews:read` (OV-311; `mcp-connector.md`, "Chats"):
`list_chats` by overview, by project or across the library, `get_chat` with each citation as a
timestamp link, and a line at the end of `get_overview` naming its conversations. Nothing an
assistant can call writes to a chat.

## Privacy

`/privacy` has a section, "Asking questions about an overview", added with OV-309, which first
writes chats: what goes to OpenAI, that it is always on our key, how conversations are kept and
deleted, what is counted and logged. `/terms` names the allowance (`legal-pages.md`).
