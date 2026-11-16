# Chats

OV-308, the first of four build cards for chat about one overview (OV-308 to OV-311). The
investigation behind them is OV-267, `docs/architecture/in-app-chat.md` (PR #343): GPT-6 Luna with the
whole transcript costs about $0.0003 a message, and answered only from the source.

OV-308 built the record and OV-309 the endpoint that answers and writes it. The panel inside
the overview is OV-310, and reading chats over MCP is OV-311.

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
    place in that chat's `messages`.
- **`inSource: false`** marks an answer saying the source doesn't cover the question. Another
  chat is never the source: an answer resting only on one is not `inSource`.
- At most `MAX_CHAT_QUESTIONS` (30) questions and their answers, and 10,000 characters a
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

| Refusal | Status | Details |
|---|---|---|
| The overview isn't held, or the conversation was deleted | 404 `not_found` | |
| No transcript kept for it, or an article | 422 `transcript_unavailable` | `chat: "no-source"` |
| The conversation has `MAX_CHAT_QUESTIONS` questions | 400 `invalid_request` | `conversation: "full"` |
| The month's, the day's or the global day's allowance spent | 429 `too_many_requests` | `quota`, `retryAfterSeconds`, `resetsOn` for the month (`tiers.md`, "Questions about an overview") |
| No key on this server | 503 `unavailable` | |
| The provider failed before answering | 502 `generation_failed` | |

**The answer streams** as server-sent events (`ChatStreamEvent`): `text` events carry the
answer as it arrives, then one `answered` event carries both messages as stored and the
record's rev, or one `failed` event says nothing was stored. The model replies in JSON,
`{ answer, passages, chatMessages, inSource }`, answer first, and `answerSoFar` reads the
answer's text out of the reply while the rest is still arriving.

**The prompt** is OV-267's `fullTranscript` shape, with the overview added for context
(`chatPrompt.ts`): the instructions, the overview and the whole transcript in one-minute
passages with ids (`transcriptPassages.ts`), as the first message, which never changes, so
follow-ups and the overview's other conversations read it from the cache
(`prompt_cache_key` is per overview). Then the other conversations, then this conversation's
history, then the question.

**Citations are code's.** `citationsOf` turns passage ids into `{ startMs, endMs }` and other
chats' message ids into `{ chatId, message }`, drops any id the model wasn't given, and sets
`inSource` only when the answer cites the transcript.

**A provider refusing for now** (429 or 5xx) is asked again after its `retry-after`, at most 5
seconds, or after 1 then 3 seconds, before anything streams. A third refusal, any other
failure, or a reply that can't be read gives the message back and stores nothing; the tokens
the provider billed still go into the cost tally, as `message-failed`.

**Costs and logs.** Each answer's tokens and list-price cost go into `account_costs`, area
`chat` (`unit-economics.md`). `api.chat.answered` logs the plan, model, tokens, cached share,
cost, `inSource`, the citations of the source and of other chats, how many other chats'
messages went in, the month's count and the time; never the question or the answer.

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

## Privacy

`/privacy` has a section, "Asking questions about an overview", added with OV-309, which first
writes chats: what goes to OpenAI, that it is always on our key, how conversations are kept and
deleted, what is counted and logged. `/terms` names the allowance (`legal-pages.md`).
